---
sidebar_position: 5
---

# S3 Storage Configuration

By default, OpenYapper stores uploaded media files on the local filesystem. For production deployments -- especially on ephemeral platforms like Railway -- you should configure S3-compatible object storage for persistent media.

## Supported Providers

OpenYapper works with any S3-compatible storage provider:

| Provider | Endpoint Required | Notes |
|----------|------------------|-------|
| **AWS S3** | No | Uses default AWS endpoints |
| **MinIO** | Yes | Self-hosted, open-source alternative |
| **Cloudflare R2** | Yes | S3-compatible, no egress fees |
| **DigitalOcean Spaces** | Yes | S3-compatible object storage |
| **Backblaze B2** | Yes | S3-compatible API available |

## Configuration

Set the following environment variables to enable S3 storage:

| Variable | Required | Description |
|----------|----------|-------------|
| `STORAGE_PROVIDER` | **Yes** | Set to `s3` to enable S3 storage (default: `local`) |
| `STORAGE_S3_BUCKET` | **Yes** | Name of the S3 bucket |
| `STORAGE_S3_REGION` | **Yes** | AWS region (e.g., `us-east-1`, `eu-central-1`) |
| `STORAGE_S3_PREFIX` | No | Optional key prefix for all uploads (e.g., `media/`) |
| `STORAGE_S3_ENDPOINT` | No | Custom endpoint URL for non-AWS providers |
| `AWS_ACCESS_KEY_ID` | **Yes** | AWS access key ID |
| `AWS_SECRET_ACCESS_KEY` | **Yes** | AWS secret access key |

AWS credentials are read from the standard AWS SDK credential chain, which also supports instance profiles, environment variables, and shared credential files.

## Provider-Specific Examples

### AWS S3

```bash
STORAGE_PROVIDER=s3
STORAGE_S3_BUCKET=my-openyapper-media
STORAGE_S3_REGION=us-east-1
STORAGE_S3_PREFIX=uploads/
AWS_ACCESS_KEY_ID=AKIA...
AWS_SECRET_ACCESS_KEY=wJal...
```

### Cloudflare R2

```bash
STORAGE_PROVIDER=s3
STORAGE_S3_BUCKET=openyapper-media
STORAGE_S3_REGION=auto
STORAGE_S3_ENDPOINT=https://<account-id>.r2.cloudflarestorage.com
STORAGE_S3_PREFIX=media/
AWS_ACCESS_KEY_ID=<r2-access-key>
AWS_SECRET_ACCESS_KEY=<r2-secret-key>
```

You can find your R2 access keys in the Cloudflare dashboard under **R2** > **Manage R2 API Tokens**.

### MinIO (Self-Hosted)

```bash
STORAGE_PROVIDER=s3
STORAGE_S3_BUCKET=openyapper
STORAGE_S3_REGION=us-east-1
STORAGE_S3_ENDPOINT=http://minio:9000
STORAGE_S3_PREFIX=media/
AWS_ACCESS_KEY_ID=minioadmin
AWS_SECRET_ACCESS_KEY=minioadmin
```

For Docker Compose, add a MinIO service:

```yaml
services:
  minio:
    image: minio/minio
    command: server /data --console-address ":9001"
    ports:
      - "9000:9000"
      - "9001:9001"
    environment:
      MINIO_ROOT_USER: minioadmin
      MINIO_ROOT_PASSWORD: minioadmin
    volumes:
      - minio-data:/data

volumes:
  minio-data:
```

After starting MinIO, create the bucket via the MinIO Console at `http://localhost:9001` or with the `mc` CLI:

```bash
mc alias set local http://localhost:9000 minioadmin minioadmin
mc mb local/openyapper
```

### DigitalOcean Spaces

```bash
STORAGE_PROVIDER=s3
STORAGE_S3_BUCKET=openyapper-media
STORAGE_S3_REGION=nyc3
STORAGE_S3_ENDPOINT=https://nyc3.digitaloceanspaces.com
STORAGE_S3_PREFIX=media/
AWS_ACCESS_KEY_ID=<spaces-access-key>
AWS_SECRET_ACCESS_KEY=<spaces-secret-key>
```

## Key Prefix

The `STORAGE_S3_PREFIX` variable adds a prefix to all object keys. This is useful for organizing files within a shared bucket:

```
STORAGE_S3_PREFIX=production/media/
```

Uploaded files are then stored as `production/media/<uuid>/<filename>` in the bucket.

## Bucket Policy

Ensure the IAM user or access key has the following permissions on the bucket:

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "s3:PutObject",
        "s3:GetObject",
        "s3:DeleteObject",
        "s3:ListBucket"
      ],
      "Resource": [
        "arn:aws:s3:::my-openyapper-media",
        "arn:aws:s3:::my-openyapper-media/*"
      ]
    }
  ]
}
```

## Migrating from Local to S3

If you have existing media stored locally and want to migrate to S3:

1. Upload existing files from the `static/media/` directory to your S3 bucket, preserving the directory structure.
2. Update the environment variables to point to S3.
3. Restart the application.

New uploads will go to S3. Existing media URLs served by the API will also resolve through S3 once the files are uploaded.
