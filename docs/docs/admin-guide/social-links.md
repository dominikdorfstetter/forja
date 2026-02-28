---
sidebar_position: 9
---

# Social Links

Social links let you manage the social media profiles and external links displayed on your site. These typically appear in the header, footer, or a dedicated section of your frontend template.

![Social links management](/img/screenshots/admin-social-links.png)

## Accessing Social Links

Navigate to **Social Links** in the sidebar. The page shows all social links for the currently selected site.

## Social Links List

The listing displays your configured social links with:

| Column | Description |
|--------|-------------|
| **Platform** | The social media platform (e.g., GitHub, Twitter/X, LinkedIn, YouTube). |
| **URL** | The full URL to your profile. |
| **Order** | The display position. |

## Adding a Social Link

1. Click the **Add Link** button.
2. Fill in the details:
   - **Platform** -- select the social media platform from the dropdown (GitHub, Twitter/X, LinkedIn, YouTube, Instagram, Mastodon, etc.) or enter a custom platform name.
   - **URL** -- the full URL to your profile on that platform (e.g., `https://github.com/yourusername`).
   - **Label** -- an optional display label. If not provided, the platform name is used.
   - **Order** -- the display position relative to other links.
3. Click **Save**.

## Editing a Social Link

Click on a social link in the list to edit it. Modify the platform, URL, label, or order and save.

## Reordering Social Links

Drag and drop social links to change their display order. The order determines how they appear on your site's frontend.

## Deleting a Social Link

Click the delete icon on a social link and confirm. The link is removed immediately.

## Supported Platforms

OpenYapper includes icons and labels for common platforms:

- GitHub
- Twitter / X
- LinkedIn
- YouTube
- Instagram
- Mastodon
- Facebook
- Bluesky
- Dev.to
- Stack Overflow
- Dribbble
- Behance
- Medium
- RSS

Custom platforms can be added by typing a platform name that is not in the predefined list.

## How Social Links Are Used

Your frontend template fetches social links via the API and renders them with the appropriate icons. The exact placement and styling depends on your frontend template.

## Permissions

| Action | Required Role |
|--------|--------------|
| View social links | Read |
| Add/edit social links | Write, Admin, Master |
| Delete social links | Write, Admin, Master |
| Reorder social links | Write, Admin, Master |
