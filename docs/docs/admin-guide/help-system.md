---
sidebar_position: 21
title: Help System
description: Keyboard shortcuts, quick tour, and contextual help
---

# Help System

Forja includes several built-in help features to make the admin dashboard easier to learn and use. These range from a keyboard shortcuts reference to an interactive tour and contextual tooltips.

## Keyboard Shortcuts Dialog

Press **`?`** from anywhere in the admin dashboard to open the keyboard shortcuts dialog. You can also open it from the **Help** menu in the top bar.

The dialog lists all available shortcuts, organized by category:

| Category | Example Shortcuts |
|----------|------------------|
| **Navigation** | `Cmd+K` / `Ctrl+K` -- open command palette |
| **Editing** | Standard text editing shortcuts within the content editor |
| **Actions** | `?` -- open keyboard shortcuts dialog |

:::tip
Learning a few keyboard shortcuts can dramatically speed up your workflow. Start with `Cmd+K` / `Ctrl+K` for the command palette and `?` for the shortcuts reference -- those two alone cover most navigation needs.
:::

### Common Shortcuts

| Key | Action |
|-----|--------|
| `Cmd+K` / `Ctrl+K` | Open the command palette |
| `?` | Open keyboard shortcuts dialog |
| `Escape` | Close the current dialog or modal |

## Quick Tour

Forja provides an interactive walkthrough that highlights key areas of the admin interface. The tour is shown automatically on your first visit and can be restarted at any time.

### What the Tour Covers

The tour steps through the main UI areas in order:

1. **Sidebar** -- where you navigate between sections (Dashboard, Blogs, Pages, Media, etc.).
2. **Top bar** -- site selector, command palette trigger, notifications, and user menu.
3. **Content area** -- the main workspace where content lists, editors, and settings appear.

### Restarting the Tour

If you want to see the tour again:

1. Open the **Help** menu in the top bar.
2. Click **Restart Tour**.

The tour replays from the beginning.

## Contextual Help Tooltips

Certain features in the admin dashboard have small hotspot indicators -- typically a pulsing dot or an info icon -- that provide additional context when you hover or click.

### How Tooltips Work

- **Appear on first encounter** -- tooltips show up the first time you visit a feature that has contextual help.
- **Dismiss individually** -- close a tooltip by clicking its dismiss button. It will not appear again.
- **State persists** -- dismissed tooltips stay dismissed across sessions. The help state is stored per user.

### Resetting Tooltips

If you want to see all contextual help tooltips again:

1. Go to your **Profile** page, or open the **Help** menu.
2. Click **Reset Help Tooltips**.

All previously dismissed tooltips will reappear on their respective features.

## API Documentation Viewer

Forja embeds the backend's Swagger UI directly in the admin dashboard, making it easy for developers to explore and test API endpoints.

### Accessing the API Docs

Navigate to **`/api-docs`** in the admin dashboard, or find the link in the **Help** menu.

### What Is Available

The API documentation viewer shows:

- All available REST endpoints grouped by resource (blogs, pages, media, sites, etc.).
- Request and response schemas for each endpoint.
- Authentication requirements.
- The ability to send test requests directly from the browser.

:::note
The API documentation viewer is most useful for developers building integrations or custom frontends on top of Forja. If you are a content author, you likely won't need it day-to-day.
:::

## Next Steps

- [Command Palette](./command-palette) -- learn more about keyboard-driven navigation.
- [Profile](./profile) -- manage your account and reset help preferences.
- [API Keys](./api-keys) -- generate keys for API access.
