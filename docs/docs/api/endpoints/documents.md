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
| GET | `/documents/{id}` | Read | Get document with localizations |
| PUT | `/documents/{id}` | Author | Update a document |
| DELETE | `/documents/{id}` | Editor | Delete a document |
| GET | `/documents/{id}/download` | None | Download the uploaded file (public) |

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

The download endpoint is public (no authentication required). It returns the file with appropriate `Content-Type` and `Content-Disposition` headers.

```bash
curl -O https://your-domain.com/api/v1/documents/{id}/download
```

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
