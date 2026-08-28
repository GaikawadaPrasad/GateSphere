# API — Upload pipeline (`/api/v1/uploads`)

The **only** way a file enters GateSphere. The client asks for a presigned `PUT` URL for one
of the fixed **kinds** (`app/modules/uploads/catalogue.py`), uploads the bytes straight to
S3/MinIO, **confirms** the upload, then passes the returned `file_url` to a domain endpoint
(attachment / photo / evidence).

Two gates protect a stored file URL (NFR-SEC-07):
1. `ManagedFileUrl` (pydantic) — the URL must be an object in our bucket; an external URL is `422`.
2. `uploads.guard.ensure_confirmed` (service layer) — the object must have a `managed_files`
   row with `status = "confirmed"`. `POST /uploads` creates it `pending`; `POST
   /uploads/{id}/confirm` HEADs the object, checks the real size against the kind's cap and
   **sniffs the leading bytes** (`sniff.detect`) against the kind's allow-list. A mismatch
   deletes the object and marks the row `rejected` (`422 UPLOAD_REJECTED`).

## Kinds (catalogue)

| kind | prefix | content types | max | key scope |
|---|---|---|---|---|
| `visitor_photo` | `visitors/photos` | jpeg·png·webp | 5 MB | community |
| `id_document` | `kyc/ids` | jpeg·png·webp·pdf | 10 MB | community |
| `staff_photo` | `domestic-staff/photos` | jpeg·png·webp | 5 MB | community |
| `ticket_attachment` | `complaints/attachments` | images·pdf·doc·docx·xls·xlsx | 15 MB | community |
| `incident_evidence` | `incidents/evidence` | images·pdf·mp4·mov | 25 MB | community |
| `delivery_photo` | `deliveries/photos` | images | 5 MB | community |
| `vehicle_evidence` | `vehicles/violations` | images | 10 MB | community |
| `announcement_media` | `communication/media` | images·pdf | 15 MB | community |
| `payment_proof` | `billing/proofs` | images·pdf | 10 MB | community |
| `user_avatar` | `users/avatars` | images | 3 MB | user |

## Endpoints

| Method & path | Body | Success | Notes |
|---|---|---|---|
| `GET /uploads/health` | – | `200` | liveness |
| `GET /uploads/kinds` | – | `200` | the catalogue as JSON |
| `POST /uploads` | `PresignRequest` | `200` `PresignResponse` | `404` unknown kind; `422 CONTENT_TYPE_NOT_ALLOWED` / `FILE_TOO_LARGE` / `COMMUNITY_REQUIRED` |
| `POST /uploads/{file_id}/confirm` | – | `200` `ConfirmResponse` | `422 NO_OBJECT` (nothing PUT) / `UPLOAD_REJECTED` (size or magic-byte check failed — object deleted) |
| `GET /uploads/download?key=…` | – | `200` `DownloadResponse` | presigned GET for a private object; `404` if missing |

**PresignRequest**: `kind`, `filename`, `content_type`, `size_bytes` (≤ 100 MB), `community_id?`.
**PresignResponse**: `file_id`, `kind`, `key`, `upload_url`, `method="PUT"`, `required_headers`
(`{"Content-Type": …}` — the client MUST send it), `file_url` (final public URL), `max_bytes`,
`expires_in` (900 s), `confirm_url`.
**ConfirmResponse**: `file_id`, `status` (`confirmed`), `file_url`, `detected_content_type`, `size_bytes`.

## Client flow

1. `POST /uploads` → `{file_id, upload_url, required_headers, file_url, confirm_url}`.
2. `PUT <upload_url>` with the file bytes and the `Content-Type` header from `required_headers`.
3. `POST <confirm_url>` → `200` once the bytes pass the size + magic-number check.
4. `POST /complaints/tickets/{id}/attachments` (or the relevant endpoint) with `{file_url, …}` —
   fails `422 FILE_NOT_CONFIRMED` if step 3 was skipped.

## Audit

`upload.presign`, `upload.confirm`, `upload.reject` — logged with `kind` / `key` / `status` / `reason`.
