---
sidebar_position: 20
title: Bulk Operations
description: Perform actions on multiple content items at once
---

# Bulk Operations

Bulk operations let you act on multiple blog posts or pages at the same time. Instead of editing items one by one, you can select several and apply a single action to all of them.

## Where Bulk Operations Are Available

Bulk operations are available on the following list views:

- **Blogs** -- the blog post listing page.
- **Pages** -- the page listing page.

## Selecting Items

### Individual Selection

Click the **checkbox** on the left side of any row to select that item. Click it again to deselect.

### Select All

Click the **Select All** checkbox in the table header to select every item on the current page. Click it again to deselect all.

:::note
Selection persists across pagination. If you select items on page 1, navigate to page 2, and select more items there, all selections are retained. Forja tracks selected item IDs, not page positions.
:::

## Bulk Actions Toolbar

When one or more items are selected, a toolbar appears above the content list. The toolbar shows the number of selected items and the available actions:

| Action | Description |
|--------|-------------|
| **Publish** | Sets the selected items to Published status. They become publicly visible. |
| **Unpublish** | Moves the selected items back to Draft status. They are removed from public view. |
| **Archive** | Archives the selected items. Archived content is hidden from default listings but not deleted. |
| **Delete** | Permanently deletes the selected items. A confirmation dialog appears before deletion. |

### Confirmation Dialog

Destructive actions (especially Delete) trigger a confirmation dialog that shows:

- The **number of items** that will be affected.
- The **action** that will be performed.
- A **Cancel** button to abort and an **OK** / **Confirm** button to proceed.

:::warning
Deleting content via bulk operations is permanent. Deleted items cannot be recovered. Double-check the selection count in the confirmation dialog before proceeding.
:::

## Permissions

Bulk actions respect your role and permissions. Only items you have write access to will be affected by the operation. If your selection includes items you cannot modify (for example, items on a site where you have read-only access), those items are skipped and a notice is shown.

| Action | Required Role |
|--------|--------------|
| Publish | Write, Admin, Master |
| Unpublish | Write, Admin, Master |
| Archive | Write, Admin, Master |
| Delete | Admin, Master |

## Tips

- Use bulk **Publish** after preparing a batch of blog posts for a launch.
- Use bulk **Archive** to clean up old content without permanently deleting it.
- The selection count in the toolbar helps you verify you have the right items before acting.
- If you need to select items across many pages, consider using search or filters first to narrow the list, then use **Select All**.

## Next Steps

- [Blogs](./content/blogs) -- manage individual blog posts.
- [Pages](./content/pages) -- manage individual pages.
- [Audit Log](./audit-log) -- review a history of all actions, including bulk operations.
