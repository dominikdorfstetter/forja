---
sidebar_position: 16
---

# Settings

The settings page lets you configure site-specific options that control how your site behaves and appears. Settings are scoped to the currently selected site.

![Settings](/img/screenshots/admin-settings.png)

## Accessing Settings

Navigate to **Settings** in the sidebar. The settings page is organized into **tabs**. Which tabs you see depends on your role and which modules are enabled for the site.

## Settings Tabs Overview

| Tab | Visible To | Condition |
|-----|-----------|-----------|
| **Preferences** | All users | Always |
| **Site Settings** | Admin, Master | Always |
| **Modules** | Admin, Master | Always |
| **AI Settings** | Admin, Master | AI module enabled |
| **Federation Settings** | Master | Federation module enabled |
| **System Info** | Master | Always |
| **Legal** | Admin, Master | Legal module enabled |

---

## Preferences Tab

Personal settings that apply to your account on this site. Available to all users.

| Setting | Description |
|---------|-------------|
| **Language** | The UI language for the admin dashboard. |
| **Theme** | Light or dark mode. |
| **Autosave** | Toggle automatic saving of content while editing. |
| **Page size** | Number of items to display per page in listings. |

## Site Settings Tab

Core configuration for the site. Requires **Admin** or **Master** role.

### General

| Setting | Description |
|---------|-------------|
| **Site name** | The display name of your site. Used in the admin dashboard and can be used by your frontend template. |
| **Site description** | A brief description of your site. Useful for SEO meta tags. |
| **Domain** | The primary domain for your site. |
| **Default locale** | The default language for content when no locale is specified. |
| **Timezone** | The timezone used for content scheduling and timestamps. |
| **Contact email** | Public contact email for the site. |
| **Preview template URL** | URL of the frontend template used for content previews. |

### Feature Toggles

| Toggle | Description |
|--------|-------------|
| **Analytics** | Enable site analytics tracking. |
| **Maintenance mode** | Put the site into maintenance mode (public API returns 503). |
| **Editorial workflow** | Enable the review workflow for blog posts (Draft > In Review > Published). |

### File Upload Limits

Configure the maximum allowed file size for media uploads.

## Modules Tab

Enable or disable content modules for the site. Requires **Admin** or **Master** role.

| Module | Description |
|--------|-------------|
| **Blog** | Blog posts, categories, and tags. |
| **Pages** | Static pages with sections. |
| **CV** | Resume / portfolio entries and skills. |
| **Legal** | Legal pages (privacy policy, terms of service, etc.). |
| **Documents** | File/document management and attachments. |
| **AI** | AI-powered content assist features. |
| **Federation** | Cross-site content federation. |

Disabling a module hides its sidebar entry and API endpoints for this site. Existing data is preserved and reappears if you re-enable the module.

## AI Settings Tab

Configure the AI provider for content assist features. Requires **Admin** or **Master** role and the **AI module** to be enabled.

| Setting | Description |
|---------|-------------|
| **LLM Provider** | The AI service provider (e.g., OpenAI, Anthropic). |
| **API Key** | Your provider API key (stored encrypted). |
| **Model** | The model to use for generation (e.g., `gpt-4o`, `claude-sonnet-4-20250514`). |
| **Temperature** | Controls randomness (0 = deterministic, 1 = creative). |
| **Max tokens** | Maximum number of tokens per AI response. |
| **System prompts** | Custom instructions sent to the LLM for content generation and SEO tasks. |

For full details on capabilities, see the [AI Content Assist](./ai-content-assist) guide.

## Federation Settings Tab

Core federation configuration for sharing content across Forja instances. Visible only to **Master** users when the **Federation module** is enabled.

See the [Federation](./federation) guide for details.

## System Info Tab

Server and platform information. Visible only to **Master** users.

- **Server version** -- the running Forja backend version.
- **Services health** -- status of connected services (database, cache, storage, AI provider).
- **Storage info** -- disk or S3 usage statistics.

## Legal Tab

Cookie consent and legal notice configuration. Requires **Admin** or **Master** role and the **Legal module** to be enabled.

- Configure cookie consent banner text, categories, and behavior.
- Manage links to privacy policy and terms of service pages.

---

## SEO Settings

Search engine optimization settings:

| Setting | Description |
|---------|-------------|
| **Meta title template** | A template for page titles (e.g., `%s | My Site`). |
| **Meta description** | The default meta description for pages without one. |
| **Social image** | The default Open Graph image used when sharing links to your site. |

## Content Settings

Options that control content behavior:

| Setting | Description |
|---------|-------------|
| **Blog posts per page** | The number of blog posts to display per page in listings. |
| **Enable comments** | Whether comments are enabled on blog posts (if supported by your frontend). |
| **Default post status** | Whether new posts start as Draft or Published by default. |

## RSS Settings

Configuration for the auto-generated RSS feed:

| Setting | Description |
|---------|-------------|
| **RSS enabled** | Whether to generate an RSS feed for this site. |
| **RSS title** | The title of the RSS feed. |
| **RSS description** | The description of the RSS feed. |
| **RSS items count** | How many items to include in the feed. |

## Saving Settings

After making changes to any setting, click **Save** at the bottom of the page. Settings take effect immediately.

## Resetting to Defaults

If available, click the **Reset to defaults** option to revert all settings to their default values. Confirm the action when prompted.

## Permissions

| Action | Required Role |
|--------|--------------|
| View settings | Read |
| Modify settings | Admin, Master |
| Reset settings | Admin, Master |
