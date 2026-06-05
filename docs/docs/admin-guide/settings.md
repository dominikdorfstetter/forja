---
sidebar_position: 16
---

# Settings

The settings page lets you configure site-specific options. Settings are scoped to the currently selected site and organized into tabs — which tabs you see depends on your role and which modules are enabled.

## Accessing Settings

Navigate to **Site Settings** in the sidebar (under the Administration group). The page is organized into **tabs**.

## Settings Tabs Overview

| Tab | Visible To | Condition |
|-----|-----------|-----------|
| **Overview** | Admin, Owner | Always |
| **Content** | Admin, Owner | Always |
| **Modules** | Admin, Owner | Always |
| **SEO** | Admin, Owner | Always |
| **Favicon** | Admin, Owner | Always |
| **Code Injection** | Admin, Owner | Always |
| **AI** | Admin, Owner | AI module enabled |
| **AI Usage** | Admin, Owner | AI module enabled |
| **Forms** | Admin, Owner | Forms module enabled |
| **Members** | Admin, Owner | Always |
| **API Keys** | Admin, Owner | Always |
| **Webhooks** | Admin, Owner | Always |
| **Danger Zone** | Owner | Always |

:::tip Personal preferences
Language, theme, autosave, and page size are managed in the **Preferences** panel, accessible from the user account menu (profile avatar → Preferences) — not from the site settings page.
:::

---

## Overview Tab

Shows a compact site info bar (slug, ID with copy button, creation date) and site-level statistics. Requires **Admin** or **Owner** role.

## Content Tab

Core content configuration. Requires **Admin** or **Owner** role.

### Upload Limits

| Setting | Description |
|---------|-------------|
| **Max media file size** | Maximum upload size for images and files (1–500 MB). |
| **Max document file size** | Maximum upload size for document attachments (1–100 MB). |

### Feature Toggles

| Toggle | Description |
|--------|-------------|
| **Analytics** | Enable site analytics tracking. |
| **Maintenance mode** | Put the site into maintenance mode (public API returns 503). When active, a warning banner appears on every dashboard page with a quick "Turn Off" button. |
| **Editorial workflow** | Enable the review workflow for blog posts (Draft → In Review → Published). Only visible when the site has 2 or more members. |

### Document Security

| Setting | Description |
|---------|-------------|
| **Password minimum length** | Minimum length for document passwords (4–128). |
| **Password regex** | Optional regex pattern that document passwords must satisfy. |

### Preview Templates

Configure URLs to frontend template dev servers for content preview. Built-in templates (like the Astro blog) are read-only. Custom templates can be added by URL.

## Modules Tab

Enable or disable content modules for the site. Requires **Admin** or **Owner** role.

| Module | Description |
|--------|-------------|
| **Blog** | Blog posts, categories, and tags. |
| **Pages** | Static pages with sections. |
| **Portfolio** | Resume / portfolio entries and skills. |
| **Legal** | Legal pages (privacy policy, terms of service, etc.). |
| **Documents** | File/document management and attachments. |
| **Forms** | Structured form builder with custom fields, submissions, and GDPR retention. |
| **AI** | AI-powered content assist features. |

Disabling a module hides its sidebar entry and API endpoints for this site. Existing data is preserved and reappears if you re-enable the module.

## SEO Tab

The SEO tab contains two sections: **SEO Defaults** and **robots.txt Configuration**.

### SEO Defaults

Site-wide fallback values for content that lacks custom SEO metadata. These are applied at response time in the content detail endpoints (blog posts, pages) — they are never stored on the content itself.

| Setting | Description |
|---------|-------------|
| **Title template** | Pattern for `<title>` tags. Use `{{title}}` for the content title and `{{site_name}}` for the site name. Example: `{{title}} \| {{site_name}}`. A live preview shows how the template renders. |
| **Default meta description** | Fallback `<meta name="description">` used when content has no custom description. A character counter shows the recommended 160-character limit. |
| **Default OG image** | Fallback Open Graph image (selected from the media library) used when content has no cover image. The cascade is: content cover image → default OG image → site logo. |

### robots.txt Configuration

Control how search engine crawlers access your site. Changes are reflected immediately at the public `GET /sites/<slug>/robots.txt` endpoint.

- Add/remove **User-Agent blocks** (e.g. `*`, `Googlebot`)
- Add/remove **Allow/Disallow directives** per block
- A live **preview panel** shows the rendered robots.txt
- The `Sitemap:` directive is automatically appended when a Site URL is configured
- **Reset to Defaults** restores the default "allow all" rule

## Favicon Tab

Upload a source image (512×512 px+ recommended) to generate a complete favicon package. The generated variants include:

- `favicon.ico` (multi-resolution: 16, 32, 48px)
- `favicon-16x16.png`, `favicon-32x32.png`
- `apple-touch-icon.png` (180×180)
- `android-chrome-192x192.png`, `android-chrome-512x512.png`

After uploading, the page shows a **variant preview grid**, colour pickers for theme/background colour, and a ready-to-paste HTML snippet. Icons are stored separately from the media library. The site's `favicon_url` is automatically updated for backwards compatibility.

## Code Injection Tab

Inject custom HTML, CSS, or JavaScript into your site's templates. Useful for analytics scripts (Google Analytics, Plausible), search engine verification tags (Google Search Console), chat widgets, tracking pixels, or custom meta tags.

| Field | Description |
|-------|-------------|
| **Head code** | Injected into the `<head>` section of every page. |
| **Footer code** | Injected before the closing `</body>` tag. |

Both fields have a **10,000-character limit** (enforced on backend and shown in UI). A **warning banner** reminds you that injected code runs on your live site. Templates fetch these values from the site settings API and render them in the appropriate document locations.

## AI Tab

Configure the AI provider for content assist features. Requires **Admin** or **Owner** role and the **AI module** to be enabled.

| Setting | Description |
|---------|-------------|
| **LLM Provider** | The AI service provider (e.g., OpenAI, Anthropic). |
| **API Key** | Your provider API key (stored encrypted). |
| **Model** | The model to use for generation (e.g., `gpt-4o`, `claude-sonnet-4-20250514`). |
| **Temperature** | Controls randomness (0 = deterministic, 1 = creative). |
| **Max tokens** | Maximum number of tokens per AI response. |
| **System prompts** | Custom instructions sent to the LLM for content generation and SEO tasks. |

For full details on capabilities, see the [AI Content Assist](./ai-content-assist) guide.

## AI Usage Tab

Shows AI usage statistics for the current site — total generations and recent 30-day activity. Requires **Admin** or **Owner** role and the **AI module** to be enabled.

## Forms Tab

Configure bot protection for forms. Requires **Admin** or **Owner** role and the **Forms module** to be enabled. Protection stays opt-in per form (set a form to *Mandatory* protection); this tab chooses how the token is verified.

Pick a **Provider** mode:

- **ALTCHA (self-hosted)** — the default and recommended option. Open-source proof-of-work verified on your own server: no signup, no third-party requests, no cookies (GDPR-friendly). Enabling it needs no input — a signing key is generated and stored encrypted. The panel shows the **challenge URL** to point your ALTCHA widget at (`/api/v1/public/forms/<form-slug>/altcha-challenge` on your public API host). Use **Regenerate key** to rotate the signing key (this invalidates challenges visitors are mid-solve).
- **Custom captcha vendor** — the original remote-verify model. Forja forwards the submitted token to your vendor's siteverify endpoint:

  | Setting | Description |
  |---------|-------------|
  | **Provider label** | A human-readable name for the captcha provider (e.g. "Cloudflare Turnstile"). |
  | **Verify URL** | The provider's siteverify endpoint URL. |
  | **Secret** | The captcha provider secret (stored encrypted). Use the show/hide toggle to view. |

For full details, see the [Forms guide](./content/forms).

## Members Tab

Manage site members — invite users, assign roles, remove members. Requires **Admin** or **Owner** role.

See the [Members guide](./members) for full details.

## API Keys Tab

Create and manage API keys with permission levels (Read, Write, Admin, Master). Requires **Admin** or **Owner** role.

See the [API Keys guide](./api-keys) for full details.

## Webhooks Tab

Configure webhook endpoints, view delivery logs, test deliveries, and monitor statistics. Requires **Admin** or **Owner** role.

See the [Webhooks guide](./webhooks) for full details.

## Danger Zone Tab

Critical site operations. Visible only to **Owner** users.

- **Delete site** — permanently remove the site and all its content. Requires confirmation.

## Saving Settings

After making changes to any tab, click **Save**. Settings take effect immediately.

## Permissions

| Action | Required Role |
|--------|--------------|
| View settings | Viewer |
| Modify settings | Admin, Owner |
| Delete site | Owner |
