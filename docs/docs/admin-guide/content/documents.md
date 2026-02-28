---
sidebar_position: 3
---

# Documents

The documents section lets you manage structured documents for your site. Documents are flexible content entries that can be used for guides, datasheets, whitepapers, or any structured text content.

![Documents management](/img/screenshots/admin-documents.png)

## Document Listing

Navigate to **Documents** in the sidebar. The listing shows all documents for the currently selected site.

### List View Columns

| Column | Description |
|--------|-------------|
| **Title** | The document title. |
| **Status** | Draft or Published. |
| **Created** | When the document was created. |
| **Updated** | When the document was last modified. |

### Searching

Use the search field to filter documents by title.

## Creating a Document

1. Click the **New Document** button.
2. Fill in the document details:
   - **Title** -- the document title (required).
   - **Content** -- the document body in Markdown.
   - **Status** -- Draft or Published.
3. Click **Save** to create the document.

## Editing a Document

1. Click on a document in the listing to open the detail view.
2. Modify the title, content, or status as needed.
3. Click **Save** to apply changes.

## Localizations

Documents support multilingual content:

1. Open the document detail view.
2. Switch to the desired locale using the locale selector.
3. Enter the translated title and content.
4. Save.

## Deleting a Document

1. Open the document or select it from the listing.
2. Click **Delete** and confirm.

:::caution
Deleted documents are permanently removed and cannot be recovered.
:::

## Permissions

| Action | Required Role |
|--------|--------------|
| View documents | Read |
| Create/edit documents | Write, Admin, Master |
| Delete documents | Write, Admin, Master |
