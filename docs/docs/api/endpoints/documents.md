---
sidebar_position: 4
---

# Documents

Documents are file-based resources (PDFs, guides, downloads) that can be organized into folders, localized, and attached to blog posts. Documents support both URL references and inline file uploads (base64-encoded).

## Endpoints

### Folders

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | `/sites/{site_id}/document-folders` | Read | List document folders |
| POST | `/sites/{site_id}/document-folders` | Author | Create a document folder |
| PUT | `/document-folders/{id}` | Author | Update a document folder |
| DELETE | `/document-folders/{id}` | Editor | Delete a document folder |

### Documents

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | `/sites/{site_id}/documents?folder_id&page&per_page` | Read | List documents (paginated, filterable by folder) |
| POST | `/sites/{site_id}/documents` | Author | Create a document |
| GET | `/documents/{id}` | Read | Get document (lightweight; omits localizations) |
| GET | `/documents/{id}/detail` | Read | Get document with localizations ([ADR 0003](https://github.com/dominikdorfstetter/forja/blob/main/docs/adr/0003-uniform-content-route-convention.md)) |
| PUT | `/documents/{id}` | Author | Update a document |
| DELETE | `/documents/{id}` | Editor | Delete a document |
| GET | `/documents/{id}/download?token` | None | Download the uploaded file (public; private docs need token) |
| POST | `/documents/{id}/verify-access` | None | Verify password for a private document, get access token |
| POST | `/documents/{id}/privacy` | Editor | Encrypt a document's file with a password |
| DELETE | `/documents/{id}/privacy` | Editor | Decrypt a document, removing password protection |

### Localizations

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| POST | `/documents/{id}/localizations` | Author | Create a document localization |
| PUT | `/documents/localizations/{loc_id}` | Read | Update a document localization |
| DELETE | `/documents/localizations/{loc_id}` | Read | Delete a document localization |

### Blog Attachments

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | `/blogs/{blog_id}/documents` | Read | List documents attached to a blog |
| POST | `/blogs/{blog_id}/documents` | Read | Attach a document to a blog |
| DELETE | `/blogs/{blog_id}/documents/{doc_id}` | Read | Detach a document from a blog |

## Create a Document

Documents can reference an external URL or contain an inline file (base64-encoded). File size is validated against the site's configurable maximum.

```bash
curl -X POST \
  -H "X-API-Key: oy_live_abc123..." \
  -H "Content-Type: application/json" \
  -d '{
    "document_type": "pdf",
    "url": "https://example.com/guide.pdf"
  }' \
  https://your-domain.com/api/v1/sites/{site_id}/documents
```

**Response** `201 Created`

## Download a Document

The download endpoint is public (no API key required). For public documents, it returns the file directly. For private (password-protected) documents, it returns an HTML password page or requires an access token.

```bash
# Public document
curl -O https://your-domain.com/api/v1/documents/{id}/download

# Private document — first get a token
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"password": "your-password"}' \
  https://your-domain.com/api/v1/documents/{id}/verify-access

# Then download with the token
curl -O "https://your-domain.com/api/v1/documents/{id}/download?token=ACCESS_TOKEN"
```

## Private Documents

Uploaded documents can be password-protected. When a document is marked as private, its file data is encrypted at rest using AES-256-GCM with a key derived from the password via Argon2id.

### Set Privacy

```bash
curl -X POST \
  -H "X-API-Key: oy_live_abc123..." \
  -H "Content-Type: application/json" \
  -d '{"password": "s3cure-passw0rd"}' \
  https://your-domain.com/api/v1/documents/{id}/privacy
```

### Remove Privacy

Requires either the document password or server-side admin recovery (if `DOCUMENT_ENCRYPTION_KEY` is configured).

```bash
curl -X DELETE \
  -H "X-API-Key: oy_live_abc123..." \
  -H "Content-Type: application/json" \
  -d '{"password": "s3cure-passw0rd"}' \
  https://your-domain.com/api/v1/documents/{id}/privacy
```

### Shared Links

When someone opens a direct link to a private document (e.g., `https://your-domain.com/api/v1/documents/{id}/download`), they see a server-rendered HTML password page. After entering the correct password, the file downloads automatically. Access tokens are valid for 1 hour.

## Attach Documents to Blogs

```bash
curl -X POST \
  -H "X-API-Key: oy_live_abc123..." \
  -H "Content-Type: application/json" \
  -d '{
    "document_id": "doc-uuid",
    "display_order": 0
  }' \
  https://your-domain.com/api/v1/blogs/{blog_id}/documents
```
