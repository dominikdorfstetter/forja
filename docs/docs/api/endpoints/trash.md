---
sidebar_position: 21
---

# Trash

Trash holds soft-deleted content items (blogs, pages, projects, CV entries, skills, media, documents, legal, social, menu items). Items can be restored or permanently deleted.

## Endpoints

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | `/sites/{site_id}/trash?page&page_size` | Admin | List soft-deleted items for a site (paginated, newest-deleted first) |
| GET | `/sites/{site_id}/trash/count` | Admin | Get count of soft-deleted items (used for the sidebar badge) |
| POST | `/trash/{id}/restore?entity_type` | Admin | Restore a soft-deleted item |
| DELETE | `/trash/{id}?entity_type` | Admin | Permanently delete a soft-deleted item (cannot be undone) |

## Entity Types

The `entity_type` query parameter specifies which content type to act on. Supported values:

| Entity Type | Description |
|-------------|-------------|
| `blog` | Blog post |
| `page` | Static page |
| `project` | Portfolio project |
| `cv_entry` | CV / résumé entry |
| `skill` | Skill |
| `media` | Uploaded media file |
| `document` | Document |
| `legal` | Legal document |
| `social` | Social link |
| `menu` | Navigation menu |
| `menu_item` | Navigation menu item |

## Soft Delete Behaviour

When content is deleted through the normal delete endpoints, it is soft-deleted — the item is marked as deleted (`deleted_at` set, `is_deleted = TRUE`) but remains in the database. The trash listing returns only items scoped to the current site.

The list is paginated via `page` / `page_size` (default page 1, 10 per page, max 100), ordered newest-deleted first. The response is `{ items, total }`, where `total` is the site-wide count across all entity types — not the length of the returned page.

## Restore

`POST /trash/{id}/restore` reverses the soft-delete: `deleted_at` is cleared, `is_deleted` is set to `FALSE`, and the item reappears in normal listings. The request must include the correct `entity_type` so the system knows which table to update.

## Permanent Delete

`DELETE /trash/{id}` with the correct `entity_type` physically removes the row from the database. This action **cannot be undone**. Use with care.

## Sidebar Count

The `GET /sites/{site_id}/trash/count` endpoint returns a lightweight count that powers the trash badge in the admin sidebar:

```json
{
  "count": 12
}
```
