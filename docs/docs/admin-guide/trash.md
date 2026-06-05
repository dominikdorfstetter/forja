---
sidebar_position: 20
---

# Trash

The Trash view shows all soft-deleted content across your site. Deleted items are recoverable for 30 days before they are automatically purged.

## What Goes to Trash

When you delete any of these content types, they are moved to Trash instead of being permanently removed:

| Content Type | What's Shown in Trash |
|---|---|
| **Blog posts** | Blog title (from default locale) |
| **Pages** | Page title (from default locale) |
| **Projects** | Project title (from default locale), or slug |
| **CV entries** | Company name |
| **Skills** | Skill name |
| **Media files** | Original filename |
| **Documents** | Document title (from default locale), or filename |
| **Legal documents** | Legal document title (from default locale) |
| **Social links** | The social platform / link |
| **Navigation** | Menus and individual menu items |

The site **Danger Zone > Reset content** action populates Trash in bulk: it soft-deletes the site's content and owned media at once. Items of the types listed above appear here and are restored exactly like individually deleted content.

:::note
Form definitions and collection records are not listed in this Trash view. (Collection records have their own configurable retention; form *submissions* are governed by the forms retention worker.)
:::

:::note Deleted sites are restored elsewhere
A soft-deleted **site** also has a 30-day grace window, but it is **not** restored from this Trash view -- it is restored from the dedicated **Deleted Sites** page. See [Sites > Restoring a Deleted Site](./sites#restoring-a-deleted-site).
:::

## Accessing Trash

Navigate to **Trash** in the sidebar. The sidebar icon shows a **badge** with the number of items currently in Trash.

## Restoring Items

To restore a single item, click the **Restore** icon in the item's row. The item reappears in its original list (blogs, pages, projects, CV entries, skills, media, or documents).

To restore multiple items:

1. Select items using the checkboxes.
2. Click the **Restore** button in the toolbar.

:::tip
Restoring a media file brings back the database record and makes the file accessible again at its original URL. Storage files are preserved during soft-delete.
:::

## Permanent Deletion

Permanent deletion is irreversible and requires **Admin** or **Owner** role.

To permanently delete a single item, click the **Delete permanently** icon and confirm.

To permanently delete multiple items:

1. Select items using the checkboxes.
2. Click **Delete permanently** in the toolbar.
3. Confirm in the dialog.

To permanently delete all items, click **Empty Trash** and confirm.

:::caution
Permanent deletion of media files also removes the original file and all generated variants from storage. This cannot be undone.
:::

## Auto-Purge

Items in Trash are automatically purged after **30 days**. Each item shows a countdown badge indicating how many days remain before auto-purge.

## Permissions

| Action | Required Role |
|--------|--------------|
| View Trash | Viewer |
| Restore items | Editor |
| Permanent delete | Admin |
| Empty Trash | Admin |
