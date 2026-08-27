"""S3-compatible object storage (MinIO locally, Supabase S3 in staging).

Only the interface is stable; the endpoint/credentials come from settings.
File-upload validation (content-type, size, extension) is the caller's responsibility —
see docs/security/file-upload-security.md.
"""

from __future__ import annotations

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


def ensure_bucket() -> None:
    buckets = {b["Name"] for b in _s3.list_buckets().get("Buckets", [])}
    if settings.S3_BUCKET not in buckets:
        _s3.create_bucket(Bucket=settings.S3_BUCKET)


def put_object(key: str, body: bytes, content_type: str) -> str:
    _s3.put_object(Bucket=settings.S3_BUCKET, Key=key, Body=body, ContentType=content_type)
    return f"{settings.S3_PUBLIC_URL}/{settings.S3_BUCKET}/{key}"


def presigned_get(key: str, expires: int = 3600) -> str:
    return _s3.generate_presigned_url(
        "get_object", Params={"Bucket": settings.S3_BUCKET, "Key": key}, ExpiresIn=expires
    )
