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
- **Timeline** -- A merged feed of your posts, incoming follows, likes, boosts, and comments. Post entries show the actual title, excerpt, and any comment previews -- not just a generic "published a post" notice. Edit or delete published posts inline. Cancel scheduled posts from the timeline before they go out.

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
- **Blocked Actors** -- Block individual Fediverse actors. Accessible from the dashboard via the quick link.

### Instance Blocklist (Sysadmin Only)

Instance blocking is managed under **Settings > Federation**, which is restricted to sysadmins (`isMaster`). From there you can:

- View and unblock currently blocked instances
- Import a blocklist in bulk: paste domains one per line, or upload a `.csv` or `.txt` file
- Duplicates are detected and skipped automatically

A common use case is importing community-curated lists such as [#FediBlock](https://fediblock.org/) to quickly protect your instance from known bad actors.

### Instance Health

The Federation dashboard shows delivery health per remote instance so you can spot problem servers at a glance:

- View success and failure rates for every instance you deliver to
- See the timestamp of the last delivery attempt per instance
- Instances with a consistently high failure rate surface a **suggested block** so you can clean up your delivery queue proactively

## Scheduled Posts

Quick posts can be scheduled for future publication using the Schedule button in the composer. The publish scheduler checks every 60 seconds and automatically publishes and federates due posts.

After a quick post is published, you can still edit its body from the timeline. Saving the edit sends an **Update** activity to all followers so remote servers reflect the correction. Deleting a published post sends a **Delete** activity, removing it from followers' timelines on supported platforms.

Blog posts with a future `publish_start` date are also auto-federated when they become published.

## System Administration

Sysadmins (`isMaster`) can access additional settings under **Settings > Federation**:

- **Instance Blocklist** -- View, import, and manage blocked instances (see above).
- **Signature Algorithm** -- Choose between RSA-SHA256 (default, universal compatibility) and Ed25519 (modern, opt-in).
- **Key Rotation** -- Rotate signing keys. Old keys remain valid for 48 hours to allow remote servers to re-fetch.

## Security

- All inbound activities pass through a 6-layer security pipeline (rate limiting, block checks, HTTP signature verification, payload validation, content sanitization, business logic)
- Outbound HTTP requests include SSRF protection (private IP rejection)
- Private keys are encrypted at rest using AES-256-GCM
- Content from the Fediverse is sanitized before storage (no scripts, iframes, or event handlers)
