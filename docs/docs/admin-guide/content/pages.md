---
sidebar_position: 2
---

# Pages

Pages are static content entries for your site -- think "About", "Contact", "Services", or custom landing pages. Unlike blog posts, pages are not date-ordered and do not appear in RSS feeds.

![Pages management](/img/screenshots/admin-pages.png)

## Page Listing

Navigate to **Pages** in the sidebar. The listing shows all pages for the currently selected site.

### List View Columns

| Column | Description |
|--------|-------------|
| **Title** | The page title in the current locale. |
| **Slug** | The URL path for this page. |
| **Status** | Draft or Published. |
| **Page type** | The type classification of the page. |
| **Updated** | When the page was last modified. |

### Filtering

- **Search** -- filter pages by title.
- **Status filter** -- show only Draft or Published pages.
- **Page type filter** -- filter by page type.

## Creating a Page

1. Click the **New Page** button.
2. Fill in the page details:
   - **Title** -- the page title (required).
   - **Slug** -- auto-generated from the title, but editable.
   - **Page type** -- select the type of page (if applicable).
   - **Status** -- Draft or Published.
3. Click **Save** to create the page.

## Page Types

Pages can be assigned a type that defines their purpose and structure. Common page types include general content pages, landing pages, and custom types defined by your site's needs.

## Page Sections

Pages in OpenYapper are composed of **sections**. Each section is a content block within the page, allowing you to build complex page layouts:

### Adding a Section

1. Open the page detail view.
2. Scroll to the **Sections** area.
3. Click **Add Section**.
4. Fill in the section details:
   - **Section title** -- an internal label for the section.
   - **Content** -- the section body (Markdown).
   - **Order** -- the position of this section within the page.
5. Save the section.

### Section Editor

The section editor provides the same Markdown editing experience as the blog editor, including:

- Live preview.
- Toolbar for formatting.
- Image embedding from the media library.

### Reordering Sections

Drag and drop sections to change their order, or update the order number manually.

### Deleting a Section

Click the delete icon on a section and confirm. The section and its content are removed permanently.

## Localizations

Pages support multilingual content. To add translations:

1. Open the page detail view.
2. Switch to the desired locale using the locale selector.
3. Enter the translated title and section content.
4. Save.

Each locale has independent title and section content. Shared fields (slug, page type) remain the same across locales.

## Editing a Page

1. Click on a page in the listing to open the detail view.
2. Modify the title, slug, status, or sections as needed.
3. Click **Save** to apply changes.

## Deleting a Page

1. Open the page or select it from the listing.
2. Click **Delete** and confirm.

:::caution
Deleted pages are permanently removed and cannot be recovered.
:::

## Permissions

| Action | Required Role |
|--------|--------------|
| View pages | Read |
| Create/edit pages | Write, Admin, Master |
| Delete pages | Write, Admin, Master |
