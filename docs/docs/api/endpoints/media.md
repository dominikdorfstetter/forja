---
sidebar_position: 7
---

# Media

The media library manages uploaded files (images, videos, audio, documents) with automatic variant generation for images, MIME type detection, deduplication, and per-locale metadata.

## Endpoints

### Media Files

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | `/sites/{site_id}/media?page&per_page&search&mime_category&folder_id` | Read | List media files (paginated, searchable) |
| GET | `/media/{id}` | Read | Get media file with variants |
| POST | `/media` | Author | Create a media record (JSON metadata) |
| POST | `/media/upload` | Author | Upload a file (multipart/form-data) |
| PUT | `/media/{id}` | Author | Update media metadata |
| DELETE | `/media/{id}` | Author | Soft delete + remove from storage |

### Metadata

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | `/media/{id}/metadata` | Read | List metadata for a media file |
| POST | `/media/{id}/metadata` | Read | Create metadata |
| PUT | `/media/metadata/{metadata_id}` | Read | Update metadata |
| DELETE | `/media/metadata/{metadata_id}` | Read | Delete metadata |

## List Media

Supports full-text search across filename, alt text, caption, and title. Filter by MIME category (`image`, `video`, `audio`, `document`) or folder.

```bash
curl -H "X-API-Key: oy_live_abc123..." \
  "https://your-domain.com/api/v1/sites/{site_id}/media?search=hero&mime_category=image&page=1"
```

## Upload a File

Use multipart/form-data with the following fields:

- `file` -- The file to upload
- `site_ids` -- JSON array of site UUIDs, e.g., `["uuid1"]`
- `folder_id` -- Optional folder UUID
- `is_global` -- Optional boolean (default: false)

The API automatically detects the MIME type via magic bytes, computes a SHA-256 checksum for deduplication, and generates image variants (thumbnail, small, medium, large) for image files.

```bash
curl -X POST \
  -H "X-API-Key: oy_live_abc123..." \
  -F "file=@photo.jpg" \
  -F 'site_ids=["550e8400-..."]' \
  https://your-domain.com/api/v1/media/upload
```

**Response** `201 Created` -- Returns the media record with generated variants.

If the same file (by checksum) has been uploaded before, the existing record is returned with `200 OK` instead.

## File Size Limits

File size limits are configurable per site via site settings. The default maximum is 50 MB.

## Allowed File Types

Images (JPEG, PNG, WebP, GIF, SVG, TIFF, BMP, ICO), Video (MP4, WebM, OGG, AVI, MOV), Audio (MP3, WAV, OGG, AAC, FLAC), Documents (PDF, Markdown, Plain text), and common archive formats.
