---
sidebar_position: 3
---

# Documents

The documents section lets you manage structured documents for your site. Documents are flexible content entries that can be used for guides, datasheets, whitepapers, or any structured text content.

## Document Listing

Documents are not a standalone sidebar item -- open **Assets** in the sidebar and switch to the **Documents** tab (route `/media/documents`). The listing shows all documents for the currently selected site. See [Assets](../media) for the surrounding media library.

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

## Password-Protected Documents

Uploaded documents can be encrypted with a password to restrict access. When a document is private, the file data is encrypted at rest — even a database breach cannot reveal the content without the password.

### Making a Document Private

1. Click the **lock icon** on a document card (only shown for uploaded files).
2. Enter a password (minimum 8 characters) and confirm it.
3. Click **Set Privacy**.

The file is immediately encrypted. A lock badge appears on the document card.

### Downloading a Private Document

1. Click **Download** on a private document.
2. Enter the document password in the prompt.
3. The file downloads after verification.

### Sharing Private Documents

Copy the document's download link and share it along with the password. Recipients see a clean password page — no account or login required.

### Removing Privacy

1. Click the **lock icon** on a private document.
2. Enter the current password (or leave empty if your server has an admin recovery key configured).
3. Click **Remove Privacy**.

The file is decrypted and becomes publicly downloadable again.

:::warning
If the server does not have a `DOCUMENT_ENCRYPTION_KEY` configured and you forget the password, **the file is unrecoverable**. Always store passwords in a secure location.
:::

## Deleting a Document

1. Open the document or select it from the listing.
2. Click **Delete** and confirm.

:::note Deletes are recoverable
Deleting a document is a **soft delete** -- it moves to [Trash](../trash) and can be restored for **30 days** before automatic purge.
:::

## Permissions

| Action | Required Role |
|--------|--------------|
| View documents | Viewer |
| Create/edit documents | Editor |
| Delete documents | Editor |
