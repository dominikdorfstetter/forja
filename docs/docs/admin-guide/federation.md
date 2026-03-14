---
sidebar_position: 19
---

# Federation (ActivityPub)

Forja supports ActivityPub federation, allowing your blog to participate in the Fediverse. Followers on Mastodon, Pleroma, Misskey, and other ActivityPub-compatible platforms can follow your blog and see new posts in their timelines.

## Enabling Federation

1. Go to **Settings > Modules**
2. Toggle **Federation** on and save
3. Navigate to the **Federation** page in the sidebar

When enabled, Forja generates a cryptographic keypair for your site and creates an ActivityPub actor. Your Fediverse handle (e.g., `@myblog@yourdomain.com`) is displayed on the Federation dashboard.

## Federation Dashboard

The dashboard is split into two columns:

### Social Feed (left)
- **Quick Post Composer** -- Post short notes (up to 500 characters) directly to the Fediverse, similar to Mastodon or Bluesky. Posts can be scheduled for future publication.
- **Timeline** -- A merged feed of your posts, incoming follows, likes, boosts, and comments. Edit or delete published posts inline.

### Profile & Settings (right)
- **Profile Card** -- Your Fediverse handle (with copy button), follower count, and activity stats.
- **Edit Profile** -- Set a bio and avatar for your Fediverse presence. Use the media picker to choose an uploaded image.
- **Moderation Settings** -- Choose how inbound comments are handled:
  - *Queue All* -- All comments require manual approval (default)
  - *Auto Approve* -- Comments appear immediately
  - *Followers Only* -- Auto-approve comments from followers, queue others
- **Auto-publish** -- When enabled, publishing a blog post automatically syndicates it to the Fediverse.
- **Pinned Posts** -- Pin up to 3 blog posts to your Fediverse profile.

## Blog Post Federation

When you publish a blog post (manually or via the scheduler), it's syndicated as an ActivityPub `Article` with:
- Title and excerpt as a preview
- Blog tags converted to hashtags for Fediverse discoverability
- Link back to the full post on your site

The **Federation Preview** on the blog detail page (Settings tab) shows how the post will appear on Mastodon.

## Managing Followers, Comments, and Blocks

Access these from the Federation dashboard via the quick links:

- **Followers** -- View and manage Fediverse followers. Remove followers if needed.
- **Comments** -- Moderate inbound replies. Approve, reject, or delete.
- **Activity Log** -- View all inbound and outbound federation events. Retry failed deliveries.
- **Blocklist** -- Block entire instances or individual actors.

## Scheduled Posts

Quick posts can be scheduled for future publication using the Schedule button in the composer. The publish scheduler checks every 60 seconds and automatically publishes and federates due posts.

Blog posts with a future `publish_start` date are also auto-federated when they become published.

## System Administration

Sysadmins (`isMaster`) can access additional settings under **Settings > Federation**:

- **Signature Algorithm** -- Choose between RSA-SHA256 (default, universal compatibility) and Ed25519 (modern, opt-in).
- **Key Rotation** -- Rotate signing keys. Old keys remain valid for 48 hours to allow remote servers to re-fetch.

## Security

- All inbound activities pass through a 6-layer security pipeline (rate limiting, block checks, HTTP signature verification, payload validation, content sanitization, business logic)
- Outbound HTTP requests include SSRF protection (private IP rejection)
- Private keys are encrypted at rest using AES-256-GCM
- Content from the Fediverse is sanitized before storage (no scripts, iframes, or event handlers)
