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

### Media Folders

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | `/sites/{site_id}/media-folders` | Read | List media folders for a site |
| POST | `/sites/{site_id}/media-folders` | Author | Create a media folder |
| PUT | `/media-folders/{id}` | Author | Update a media folder |
| DELETE | `/media-folders/{id}` | Author | Delete a media folder |

## List Media Folders

Returns all media folders for a site, ordered by display order.

```bash
curl -H "X-API-Key: oy_live_abc123..." \
  https://your-domain.com/api/v1/sites/{site_id}/media-folders
```

**Response** `200 OK`

```json
[
  {
    "id": "770e8400-e29b-41d4-a716-446655440000",
    "site_id": "550e8400-e29b-41d4-a716-446655440000",
    "parent_id": null,
    "name": "Photos",
    "display_order": 0,
    "created_at": "2025-01-15T12:00:00Z",
    "updated_at": "2025-01-15T12:00:00Z"
  }
]
```

## Create a Media Folder

Creates a new media folder. Supports nesting via optional `parent_id`.

```bash
curl -X POST \
  -H "X-API-Key: oy_live_abc123..." \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Photos",
    "parent_id": null,
    "display_order": 0
  }' \
  https://your-domain.com/api/v1/sites/{site_id}/media-folders
```

**Response** `201 Created` -- Returns the created `MediaFolderResponse`.

## Update a Media Folder

Updates a media folder's name, parent, or display order. All fields are optional.

```bash
curl -X PUT \
  -H "X-API-Key: oy_live_abc123..." \
  -H "Content-Type: application/json" \
  -d '{"name": "Updated Photos"}' \
  https://your-domain.com/api/v1/media-folders/{id}
```

**Response** `200 OK` -- Returns the updated `MediaFolderResponse`.

## Delete a Media Folder

Deletes a media folder. Media files in the folder are not deleted -- they become unassigned.

```bash
curl -X DELETE \
  -H "X-API-Key: oy_live_abc123..." \
  https://your-domain.com/api/v1/media-folders/{id}
```

**Response** `204 No Content`

## File Size Limits

File size limits are configurable per site via site settings. The default maximum is 50 MB.

## Allowed File Types

Images (JPEG, PNG, WebP, GIF, SVG, TIFF, BMP, ICO), Video (MP4, WebM, OGG, AVI, MOV), Audio (MP3, WAV, OGG, AAC, FLAC), Documents (PDF, Markdown, Plain text), and common archive formats.
