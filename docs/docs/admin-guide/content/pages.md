---
sidebar_position: 2
---

# Pages

Pages are static content entries for your site -- think "About", "Contact", "Services", or custom landing pages. Unlike blog posts, pages are not date-ordered and do not appear in RSS feeds.

## Page Listing

Navigate to **Pages** in the sidebar. The listing shows all pages for the currently selected site, split into **Active** and **Archived** tabs. A **Create Page** button sits in the header.

![The Pages listing with route, type, and status columns](/img/screenshots/content/pages-list.webp)

### List View Columns

| Column | Description |
|--------|-------------|
| **Route** | The URL path for the page (e.g. `/`, `/about`, `/contact`). |
| **Type** | The page type classification (e.g. Landing, Static, Contact). |
| **Status** | Draft or Published. |
| **Created** | When the page was created. |
| **Actions** | A per-row menu (**⋮**) for edit, clone, delete, etc. |

### Filtering

- **Search** -- matches by **ID, route, or slug**.
- **Status filter** -- chips for **All**, **Draft**, and **Published**, each with a count.
- **Type filter** -- the **All types** dropdown filters by page type.

## Creating a Page

1. Click the **Create Page** button.
2. Provide the page details (route, type, status).
3. Save to create the page, then open it to add and arrange [sections](#page-sections).

## Page Types

Pages can be assigned a type that defines their purpose and structure. Common page types include general content pages, landing pages, and custom types defined by your site's needs.

## Page Sections

Pages in Forja are composed of **sections**. Each section is a content block within the page, allowing you to build complex page layouts.

### Section Types

Every section has a `section_type` that determines its purpose and the fields available for editing. The **Add Section** picker offers these types:

| Section Type | Description |
|--------------|-------------|
| **Hero** | Full-width banner with headline. |
| **Features** | Feature cards grid. |
| **Cta** | Call-to-action block. |
| **Gallery** | Image gallery. |
| **Testimonials** | Customer testimonials. |
| **Pricing** | Pricing table. |
| **Faq** | FAQ accordion. |
| **Contact** | Contact form. |
| **Custom** | Custom section for content that doesn't fit a predefined type. |
| **Stats** | Key metrics display. |
| **Team** | Team member cards. |
| **Timeline** | Chronological events. |
| **LogoCloud** | Partner / client logos. |
| **Newsletter** | Email subscription. |
| **Video** | Video embed. |
| **Divider** | Visual separator. |
| **Text** | Rich text block. |

Each section also carries a `display_order` value that controls its position on the page, and all section content can be **localized per locale** (see [Localizations](#localizations) below).

:::note
The public rendering library (`@forjacms/sections`) can also render a few context-specific types -- Portfolio, Projects, TagCloud, Blog, and Legal -- that are populated by their respective content areas rather than added manually as generic page sections.
:::

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

1. Open the page, or use the per-row **⋮** menu in the listing.
2. Click **Delete** and confirm.

:::note Deletes are recoverable
Deleting a page is a **soft delete** -- it moves to [Trash](../trash) and can be restored for **30 days** before automatic purge. (Deleting an individual *section* within a page, by contrast, is immediate and not sent to Trash.)
:::

## Permissions

| Action | Required Role |
|--------|--------------|
| View pages | Viewer |
| Create/edit pages | Editor |
| Delete pages | Editor |
