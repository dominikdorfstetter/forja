---
title: Storage Architecture
sidebar_position: 6
description: Media file storage with local filesystem and S3-compatible backends.
---

# Storage Architecture

OpenYapper supports two storage backends for media files: **local filesystem** (default) and **S3-compatible object storage**. Both implement the same `StorageBackend` trait, making them interchangeable via configuration.

## StorageBackend Trait

All storage operations go through a common interface:

```rust
#[async_trait]
pub trait StorageBackend: Send + Sync {
    /// Store file data, returning the public URL
    async fn store(&self, path: &str, data: &[u8], content_type: &str) -> Result<String, ApiError>;

    /// Delete the file at the given path
    async fn delete(&self, path: &str) -> Result<(), ApiError>;

    /// Check if a file exists
    async fn exists(&self, path: &str) -> Result<bool, ApiError>;

    /// Get the public URL for a storage path
    fn public_url(&self, path: &str) -> String;

    /// Health check with disk/bucket info
    async fn health_check(&self) -> StorageHealthInfo;
}
```

The storage backend is initialized at startup and stored in `AppState` as `Arc<dyn StorageBackend>`, making it available to all handlers.

## Local Filesystem Storage

The default storage provider writes files to a directory on the local filesystem. Rocket's `FileServer` is mounted to serve these files over HTTP.

### How It Works

1. Files are written to the configured upload directory (default: `./uploads`).
2. Subdirectories are created automatically as needed.
3. Rocket mounts a static file server at the configured base URL (default: `/uploads`).
4. Public URLs are of the form `/uploads/<path>`.

### Health Check

The local storage health check uses `statvfs` to report disk usage:

```json
{
  "provider": "local",
  "status": "up",
  "total_bytes": 107374182400,
  "available_bytes": 53687091200,
  "used_percent": 50.0
}
```

### Configuration

| Environment Variable | Purpose | Default |
|---------------------|---------|---------|
| `STORAGE_PROVIDER` | Set to `local` | `local` |
| `STORAGE_LOCAL_UPLOAD_DIR` | Directory path for file storage | `./uploads` |
| `STORAGE_LOCAL_BASE_URL` | URL prefix for serving files | `/uploads` |

## S3-Compatible Storage

For production deployments, OpenYapper supports S3-compatible object storage (AWS S3, MinIO, DigitalOcean Spaces, etc.) via the AWS SDK for Rust.

### How It Works

1. Files are uploaded to the configured S3 bucket using `PutObject`.
2. An optional key prefix (e.g., `media/`) is prepended to all paths.
3. Public URLs are constructed from the bucket name and region, or from a custom endpoint.
4. Deletion uses `DeleteObject`; existence checks use `HeadObject`.

### Public URL Formats

**AWS S3:**
```
https://<bucket>.s3.<region>.amazonaws.com/<prefix><path>
```

**Custom endpoint (MinIO, etc.):**
```
<endpoint>/<bucket>/<prefix><path>
```

### Health Check

The S3 health check calls `HeadBucket` to verify bucket accessibility:

```json
{
  "provider": "s3",
  "status": "up",
  "bucket": "my-media-bucket"
}
```

### Configuration

| Environment Variable | Purpose | Default |
|---------------------|---------|---------|
| `STORAGE_PROVIDER` | Set to `s3` | `local` |
| `STORAGE_S3_BUCKET` | S3 bucket name | Required for S3 |
| `STORAGE_S3_REGION` | AWS region | `us-east-1` |
| `STORAGE_S3_PREFIX` | Key prefix (e.g., `media/`) | (none) |
| `STORAGE_S3_ENDPOINT` | Custom endpoint URL (for MinIO) | (none, uses AWS) |

AWS credentials are resolved via the standard AWS SDK credential chain (`AWS_ACCESS_KEY_ID`, `AWS_SECRET_ACCESS_KEY`, instance profiles, etc.).

## Upload Flow

When a user uploads a file through the admin dashboard or API:

```
Client                    Handler                  Service                  Storage
  │                         │                        │                        │
  │  POST /api/v1/media     │                        │                        │
  │  (multipart form)       │                        │                        │
  │ ───────────────────────▶│                        │                        │
  │                         │  Parse multipart       │                        │
  │                         │  Extract file bytes    │                        │
  │                         │  Validate type/size    │                        │
  │                         │ ──────────────────────▶│                        │
  │                         │                        │  Generate path         │
  │                         │                        │  (site_id/uuid.ext)    │
  │                         │                        │ ──────────────────────▶│
  │                         │                        │                        │ Store file
  │                         │                        │                        │ Return URL
  │                         │                        │  ◀──────────────────── │
  │                         │                        │                        │
  │                         │                        │  Generate variants     │
  │                         │                        │  (thumbnail, etc.)     │
  │                         │                        │ ──────────────────────▶│
  │                         │                        │                        │ Store variants
  │                         │                        │  ◀──────────────────── │
  │                         │                        │                        │
  │                         │                        │  Insert media record   │
  │                         │                        │  + variant records     │
  │                         │                        │  into PostgreSQL       │
  │                         │  ◀──────────────────── │                        │
  │  200 OK + MediaResponse │                        │                        │
  │ ◀─────────────────────── │                        │                        │
```

### File Path Convention

Files are stored with a path structure of:

```
<site_id>/<uuid>.<extension>
```

Variants are stored alongside the original:

```
<site_id>/<uuid>_thumbnail.webp
<site_id>/<uuid>_small.webp
<site_id>/<uuid>_medium.webp
```

## Media Variants

When an image is uploaded, the `ImageService` generates multiple variants:

| Variant | Purpose |
|---------|---------|
| `original` | The uploaded file as-is |
| `thumbnail` | Small preview (e.g., 150x150) |
| `small` | Small display size |
| `medium` | Medium display size |
| `large` | Large display size |
| `webp` | WebP format conversion |
| `avif` | AVIF format conversion |

Variant metadata (URL, dimensions, file size) is stored in the `media_variants` table and linked to the parent `media` record.

## Database Records

Each upload creates:
1. One row in `media` -- file metadata (name, content type, size, storage path, site_id).
2. One or more rows in `media_variants` -- one per generated variant.

Deleting a media record cascades to its variants and removes the files from storage.

## Request Size Limits

File uploads are constrained by the security configuration:

| Setting | Default | Environment Variable |
|---------|---------|---------------------|
| Max file upload | 50 MB | `APP__SECURITY__MAX_FILE_SIZE` |
| Max form data | 10 MB | `APP__SECURITY__MAX_FORM_SIZE` |
| Max request body | 10 MB | `APP__SECURITY__MAX_BODY_SIZE` |

The form data limit is automatically raised to match the file upload limit so that multipart uploads are not rejected prematurely.
