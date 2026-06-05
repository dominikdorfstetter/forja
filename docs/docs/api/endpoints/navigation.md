---
sidebar_position: 8
---

# Navigation

Navigation is organized into **menus** (e.g., primary, footer, sidebar) and **items** within those menus. Items support hierarchical nesting (parent/child) and per-locale titles.

## Endpoints

### Menus

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | `/sites/{site_id}/menus` | Read | List all menus for a site |
| POST | `/sites/{site_id}/menus` | Author | Create a navigation menu |
| GET | `/menus/{id}` | Read | Get a menu by ID |
| GET | `/sites/{site_id}/menus/slug/{slug}` | Read | Get a menu by slug |
| PUT | `/menus/{id}` | Author | Update a menu |
| DELETE | `/menus/{id}` | Editor | Delete a menu (cascades to items) |
| GET | `/menus/{menu_id}/tree?locale` | Read | Get the full navigation tree |

### Items

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | `/sites/{site_id}/navigation` | Read | List root navigation items (primary menu) |
| GET | `/menus/{menu_id}/items` | Read | List all items for a menu |
| GET | `/navigation/{id}` | Read | Get a navigation item by ID |
| GET | `/navigation/{parent_id}/children` | Read | Get children of an item |
| POST | `/sites/{site_id}/navigation` | Author | Create an item (site-scoped) |
| POST | `/menus/{menu_id}/items` | Author | Create an item in a menu |
| PUT | `/navigation/{id}` | Author | Update an item |
| DELETE | `/navigation/{id}` | Editor | Delete an item |
| POST | `/sites/{site_id}/navigation/reorder` | Author | Batch-reorder items (flat) |
| POST | `/menus/{menu_id}/items/reorder` | Author | Batch-reorder items (with hierarchy) |

### Item Localizations

| Method | Path | Permission | Description |
|--------|------|------------|-------------|
| GET | `/navigation/{id}/localizations` | Read | Get localizations for an item |
| PUT | `/navigation/{id}/localizations` | Author | Upsert localizations for an item |

## Navigation Tree

The tree endpoint returns the full hierarchical structure for a menu, with localized titles. Pass an optional `locale` query parameter to get titles in a specific language.

```bash
curl -H "X-API-Key: oy_live_abc123..." \
  "https://your-domain.com/api/v1/menus/{menu_id}/tree?locale=en"
```

**Response** `200 OK`

```json
[
  {
    "id": "item-uuid",
    "title": "Home",
    "link_type": "internal",
    "url": "/",
    "display_order": 0,
    "children": [
      {
        "id": "child-uuid",
        "title": "About",
        "link_type": "internal",
        "url": "/about",
        "display_order": 0,
        "children": []
      }
    ]
  }
]
```

## Reorder Items

The menu-level reorder endpoint supports updating both position and parent in a single call, enabling drag-and-drop rearrangement:

```bash
curl -X POST \
  -H "X-API-Key: oy_live_abc123..." \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      {"id": "item-1", "parent_id": null, "display_order": 0},
      {"id": "item-2", "parent_id": "item-1", "display_order": 0},
      {"id": "item-3", "parent_id": null, "display_order": 1}
    ]
  }' \
  https://your-domain.com/api/v1/menus/{menu_id}/items/reorder
```

**Response** `204 No Content`
