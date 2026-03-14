---
sidebar_position: 5
---

# Site Modules

Forja uses a module system to control which features are available for each site. Modules let you enable only what you need -- a personal blog can skip legal documents and CV entries, while a portfolio site can enable everything.

## Available Modules

| Module | Description | Default |
|--------|-------------|---------|
| **Blog** | Blog posts with scheduling, review workflow, RSS, and localizations | Enabled |
| **Pages** | Static pages with sections and localizations | Enabled |
| **CV** | Curriculum vitae entries (work experience, education, skills) | Disabled |
| **Legal** | Legal documents with structured groups and items (privacy policy, ToS) | Disabled |
| **Documents** | General-purpose document library | Disabled |
| **AI** | AI-powered content generation, SEO, excerpts, and translations. See [AI Content Assist](./ai-content-assist). | Disabled |
| **Federation** | ActivityPub federation -- syndicate posts to the Fediverse, receive interactions. See [Federation](./federation). | Disabled |

## Choosing Modules During Site Creation

When you create a new site, the creation wizard includes a **Modules** step:

1. Click **Create Site** from the dashboard or site switcher.
2. Fill in the site basics (name, slug, description).
3. On the **Modules** step, toggle each module on or off. Blog and Pages are enabled by default.
4. Continue through workflow and language steps, then confirm.

The selected modules take effect immediately after site creation.

## Changing Modules After Creation

You can enable or disable modules at any time:

1. Navigate to **Settings** in the sidebar.
2. Open the **Modules** tab.
3. Toggle the desired modules on or off.
4. Click **Save**.

:::info
Disabling a module **hides** its UI and API endpoints but does not delete any data. If you re-enable the module later, all previously created content is still there.
:::

## What Happens When a Module is Disabled

| Aspect | Behavior |
|--------|----------|
| **Sidebar navigation** | The module's menu item is removed (not greyed out) |
| **API endpoints** | Requests return `403 Forbidden` with a message like "The 'blog' module is not enabled for this site" |
| **Data** | Preserved in the database -- nothing is deleted |
| **Related features** | Features that depend on the module are also hidden (e.g. disabling AI hides all AI buttons in the editor) |

## Module Dependencies

Modules are currently independent -- enabling one does not require another. However, some features work best in combination:

- **AI** generates blog drafts, so it is most useful when **Blog** is also enabled.
- **Blog** posts can reference **Documents** as attachments, but this is optional.

## Permissions

| Action | Required Role |
|--------|--------------|
| View module settings | Admin |
| Change module settings | Admin, Master |
