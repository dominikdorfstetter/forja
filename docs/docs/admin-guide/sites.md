---
sidebar_position: 4
---

# Sites

Forja is a multi-site CMS. Each site is an independent space with its own content, media, navigation, settings, and members. You can manage multiple sites from a single Forja installation.

## Viewing Your Sites

There is no "Sites" item in the sidebar. Open the **site launcher** from the **site selector** at the top of the sidebar (click the switch-site icon next to the current site name), or navigate to `/sites`.

The launcher -- titled **Choose a site** -- presents the sites you can access as cards rather than a table. Each card shows:

- **Name** -- the display name of the site.
- **Slug** -- the site's URL-safe identifier.
- **Status** -- an **Active** badge for the currently selected site.
- **Your role** -- your permission level on that site (Owner, Admin, Editor, Author, Reviewer, or Viewer).

From the launcher you can also **Create Site** or open **Recently deleted** to restore a soft-deleted site.

:::note Demo mode
When the instance runs in demo mode, the launcher shows an **Explore the Demo Site** banner with a **Join Demo Site** option. This banner does not appear on a normal (non-demo) installation.
:::

## Creating a Site

1. Click the **Create Site** button on the sites listing page.
2. Fill in the required fields:
   - **Name** -- a descriptive name for your site (e.g., "My Portfolio", "TechBites Magazine").
   - **Domain** -- the domain where this site will be published (e.g., `example.com`).
   - **Description** -- an optional description of the site's purpose.
3. Click **Save** to create the site.

After creating a site, navigate to **Site Settings > Overview** to set the **Site URL** (e.g., `https://example.com`). This canonical URL is used for sitemap generation, SEO meta tags, and preview links. If not set, these features are gracefully omitted.

After creation, you are automatically assigned as the site's **Owner**. The new site appears in the site selector dropdown.

## Editing a Site

1. From the sites listing, click on the site you want to edit, or click the edit icon.
2. The site detail page opens, showing all editable fields.
3. Update the fields as needed:
   - **Name** and **description** can be changed at any time.
   - **Domain** updates affect how the site is identified.
4. Click **Save** to apply your changes.

## Danger Zone

**Site Settings > Danger Zone** groups the destructive, site-wide actions. Every action here is guarded by a **type-to-confirm** dialog: you must type the site name (or the literal confirmation phrase shown) before the action is enabled.

### Export the site

Produces a downloadable **ZIP archive** of the site: an `archive.json` snapshot of the site, its settings, locales, content (blogs, pages), taxonomy, and navigation, plus the site's owned media files.

1. Click **Export** in the Danger Zone.
2. The export runs **asynchronously** -- the page shows the job moving through *queued → running → ready*. You can leave the page; the job continues server-side.
3. When the job is **ready**, the download starts automatically (or click the download link).

The download link is signed and **expires 7 days** after the export is built. Only one export can be queued or running per site at a time -- start a new one only after the previous finishes. Export is available to the site **Owner** or a site **Admin**.

### Reset content

Moves **all of the site's content and owned media into Trash** -- blogs, pages, CV/portfolio, legal documents, documents, social links, and navigation. The site itself stays intact: members, settings, and locales are kept, so the site remains usable (just empty).

Because reset uses the normal Trash, the cleared items follow the **30-day Trash grace window** and can be restored from [Trash](./trash) like any other deleted content. The confirmation dialog reports how many items were moved per category.

### Transfer ownership

Hands the **Owner** role to another existing member of the site. Pick the new owner from the member list and confirm. The previous owner is demoted (typically to Admin); only the current Owner can transfer ownership.

### Delete the site

:::danger
Deleting a site removes it from the dashboard and takes all of its content, media, navigation, settings, and member assignments offline.
:::

:::tip Deletion is recoverable for 30 days
Deleting a site is a **soft delete**, not an immediate wipe. The site enters a **30-day grace window** during which it can be fully restored (see [Restoring a Deleted Site](#restoring-a-deleted-site)). Only after 30 days does an automatic purge **permanently** delete the site and everything scoped to it -- that step cannot be undone.
:::

1. Click **Delete site** in the Danger Zone.
2. Type the site name to confirm.
3. On success you are redirected away from the (now-deleted) site, since it can no longer be opened.

Only the site **Owner** can delete a site.

## Restoring a Deleted Site

Soft-deleted sites remain recoverable for **30 days**. Navigate to the **Deleted Sites** page from the sites area. It lists every site still inside the grace window, each with a **countdown** showing how many days remain before the automatic purge.

Click **Restore** on a row to bring the site back -- its content, media, settings, members, and locales return exactly as they were at deletion. Once the 30-day window lapses the site is purged and no longer appears here; restoring it is then impossible.

Restoring a site requires the **Owner** role (system administrators can restore any site).

## Switching Between Sites

Use the **site selector** at the top of the sidebar to switch between sites. When you switch sites, the entire dashboard context updates to show content and settings for the selected site.

## Site Detail Page

The site detail page provides a comprehensive view of a single site:

- **General information** -- name, domain, description, and status.
- **Statistics** -- quick counts of blogs, pages, media, and other content.
- **Members** -- a summary of users with access to this site.
- **Settings shortcut** -- a link to the site's settings page.

## Permissions

| Action | Required Role |
|--------|--------------|
| View sites | Viewer |
| Create a site | Any authenticated user |
| Edit a site | Admin, Owner |
| Export the site | Admin, Owner |
| Reset content | Owner |
| Transfer ownership | Owner |
| Delete a site | Owner |
| Restore a deleted site | Owner (or system admin) |

## Next Steps

- [Dashboard](./dashboard) -- return to the home dashboard for the selected site.
- [Blogs](./content/blogs) -- start creating blog content for your site.
- [Members](./members) -- invite other users to collaborate on your site.
- [Settings](./settings) -- configure site-specific settings.
