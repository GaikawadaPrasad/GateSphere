"""S3-compatible object storage (MinIO locally, Supabase S3 in staging).

Only the interface is stable; the endpoint/credentials come from settings.
File-upload validation (content-type, size, extension) is the caller's responsibility —
see docs/security/file-upload-security.md.
"""

from __future__ import annotations

import contextlib

import boto3
from botocore.client import Config

from app.core.config import settings

_s3 = boto3.client(
    "s3",
    endpoint_url=settings.S3_ENDPOINT_URL,
    region_name=settings.S3_REGION,
    aws_access_key_id=settings.S3_ACCESS_KEY,
    aws_secret_access_key=settings.S3_SECRET_KEY,
    config=Config(signature_version="s3v4"),
)

def _is_internal_docker_host(url: str) -> bool:
    return "://minio" in url or "://localhost" in url or "://127.0.0.1" in url


# Client-facing presign client:
# When the backend is inside a local Docker network (e.g. endpoint http://minio:9000)
# but browsers run on host (e.g. public URL http://localhost:9000), generate presigned URLs using
# the public/client-accessible host so the browser's DNS resolves and the SigV4 Host header matches.
# For cloud S3 providers (Supabase *.storage.supabase.co, AWS S3, Cloudflare R2), S3_ENDPOINT_URL
# is already the public S3 SigV4 endpoint and must be used directly by boto3.
_client_endpoint = (settings.S3_PUBLIC_URL or "").rstrip("/")
_s3_presign = (
    boto3.client(
        "s3",
        endpoint_url=_client_endpoint,
        region_name=settings.S3_REGION,
        aws_access_key_id=settings.S3_ACCESS_KEY,
        aws_secret_access_key=settings.S3_SECRET_KEY,
        config=Config(signature_version="s3v4"),
    )
    if _is_internal_docker_host(settings.S3_ENDPOINT_URL)
    and _client_endpoint
    and _client_endpoint != settings.S3_ENDPOINT_URL.rstrip("/")
    else _s3
)


def ensure_bucket() -> None:
    buckets = {b["Name"] for b in _s3.list_buckets().get("Buckets", [])}
    if settings.S3_BUCKET not in buckets:
        _s3.create_bucket(Bucket=settings.S3_BUCKET)


def put_object(key: str, body: bytes, content_type: str) -> str:
    _s3.put_object(Bucket=settings.S3_BUCKET, Key=key, Body=body, ContentType=content_type)
    return public_url(key)


def presigned_get(key: str, expires: int = 3600) -> str:
    return _s3_presign.generate_presigned_url(
        "get_object", Params={"Bucket": settings.S3_BUCKET, "Key": key}, ExpiresIn=expires
    )


def presigned_put(key: str, content_type: str, expires: int = 900) -> str:
    """A time-limited URL the client PUTs the file to directly (must send the same
    Content-Type header)."""
    return _s3_presign.generate_presigned_url(
        "put_object",
        Params={"Bucket": settings.S3_BUCKET, "Key": key, "ContentType": content_type},
        ExpiresIn=expires,
    )


def object_head(key: str) -> dict | None:
    """`{content_length, content_type}` if the object exists, else None."""
    try:
        r = _s3.head_object(Bucket=settings.S3_BUCKET, Key=key)
    except _s3.exceptions.ClientError:
        return None
    return {"content_length": r.get("ContentLength"), "content_type": r.get("ContentType")}


def object_bytes(key: str, length: int) -> bytes | None:
    """First `length` bytes of the object (for magic-number sniffing), or None."""
    rng = f"bytes=0-{max(length - 1, 0)}"
    try:
        r = _s3.get_object(Bucket=settings.S3_BUCKET, Key=key, Range=rng)
        return r["Body"].read()
    except _s3.exceptions.ClientError:
        return None


def delete_object(key: str) -> None:
    with contextlib.suppress(_s3.exceptions.ClientError):
        _s3.delete_object(Bucket=settings.S3_BUCKET, Key=key)


def public_url(key: str) -> str:
    base = (settings.S3_PUBLIC_URL or "").rstrip("/")
    if "supabase.co" in base and not base.endswith("/object/public") and not base.endswith("/storage/v1/s3"):
        if base.endswith("/storage/v1"):
            base = f"{base}/object/public"
        else:
            base = f"{base}/storage/v1/object/public"
    return f"{base}/{settings.S3_BUCKET}/{key}"


PUBLIC_PREFIX = f"{settings.S3_PUBLIC_URL.rstrip('/')}/{settings.S3_BUCKET}/"


def key_from_url(url: str) -> str | None:
    """Return the object key for a URL that belongs to our managed bucket, else None."""
    if not url:
        return None
    clean_url = url.split("?")[0].split("#")[0].strip()
    if clean_url.startswith(PUBLIC_PREFIX):
        return clean_url[len(PUBLIC_PREFIX) :]
    s3_prefix = f"s3://{settings.S3_BUCKET}/"
    if clean_url.startswith(s3_prefix):
        return clean_url[len(s3_prefix) :]
    bucket_prefix = f"/{settings.S3_BUCKET}/"
    idx = clean_url.find(bucket_prefix)
    if idx != -1:
        return clean_url[idx + len(bucket_prefix) :]
    return None
