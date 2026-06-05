---
sidebar_position: 5
---

# Legal

The legal section helps you manage legal documents and cookie consent for your site. The admin page is organized into two tabs: **Legal Documents** and **Cookie Consent**.

## Structure

Legal content in Forja follows a two-level hierarchy:

- **Legal documents** -- top-level records (e.g., "Privacy Policy", "Terms of Service", "Imprint") with a publishing workflow and version history.
- **Legal items** -- individual sections or clauses within a document. Each item has its own title and content.

## Legal Documents Tab

Navigate to **Legal** in the sidebar. The **Legal Documents** tab shows a table of all legal documents for the currently selected site.

| Column | Description |
|--------|-------------|
| **Title** | The document title (e.g., "Privacy Policy"). |
| **Status** | Draft, Published, or Archived — reflects the actual content status. |
| **Updated** | When the document was last modified. |

### Status Filter

Use the status filter above the table to show only documents in a specific state (Draft, Published, etc.). When no documents match the filter, an empty table is shown rather than hiding the table entirely.

### Bulk Actions

The table supports context-sensitive row actions and bulk operations:

- Select multiple documents using checkboxes.
- Bulk publish, unpublish, or delete selected documents.
- Row actions adapt based on the document's current status.

### Creating a Legal Document

Click the **New Document** button to open the creation wizard. The wizard guides you through:

- **Document type** -- select the type (Privacy Policy, Terms of Service, Imprint, etc.).
- **Title** -- auto-generated from the type, editable.
- **Slug** -- auto-generated from the title.

The document is created as a Draft.

### Document Detail Page

Click on a document to open the detail page with the Tiptap editor. Features include:

- **Rich text editing** -- full block editor with Markdown storage.
- **Deep-linkable tabs** -- tabs for content, localizations, and version history are URL-addressable.
- **Context-aware breadcrumbs** -- breadcrumbs and back link are visible during loading and error states.
- **Publish gate** -- validates that the document has required content before allowing publication.

### Version History

The version history panel shows previous versions of a legal document:

- View the content of any previous version.
- **Create new version** -- snapshot the current content and start a new revision.

### Publishing

Legal documents follow a publishing workflow:

| Action | Description |
|--------|-------------|
| **Publish** | Make the document publicly available via the API. Triggers `legal.published` webhook. |
| **Unpublish** | Revert to Draft status. |

## Cookie Consent Tab

The **Cookie Consent** tab provides a dedicated CRUD interface for managing cookie consent groups and items:

### Cookie Groups

Cookie groups represent consent categories (e.g., "Essential Cookies", "Analytics Cookies", "Marketing Cookies"):

- **Add group** -- create a new consent category with a title and description.
- **Reorder groups** -- use arrow up/down buttons to rearrange groups. Positions are assigned sequentially on move.
- **Publish/unpublish** -- toggle visibility of individual consent groups.
- **Delete** -- simplified single-confirm delete dialog.

### Cookie Items

Within each group, manage individual cookie items:

- **Add item** -- add a cookie entry with name, description, provider, and duration.
- **Drag-and-drop reorder** -- reorder items within a group.
- **Edit/delete** -- inline editing and removal.

:::tip
Your frontend template can fetch cookie consent groups and items via the API to render a GDPR-compliant cookie consent banner.
:::

## Localizations

Legal content supports multilingual translations:

1. Open a legal document or item.
2. Switch to the desired locale using the locale selector.
3. Enter the translated title and content.
4. Save.

:::tip
Legal documents often have locale-specific requirements. Make sure to provide accurate translations for each locale your site supports.
:::

## Deleting a Legal Document

:::caution
Deleting a legal document removes it and **all of its items**. Deleted documents go to the Trash where they can be restored.
:::

1. Open the document or select it from the listing.
2. Click **Delete** and confirm.

## Permissions

| Action | Required Role |
|--------|--------------|
| View legal content | Viewer |
| Create/edit legal documents and items | Editor |
| Delete legal documents and items | Editor |
| Publish/unpublish legal documents | Editor |
