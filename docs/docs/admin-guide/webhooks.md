---
sidebar_position: 10
---

# Webhooks

Webhooks allow you to receive real-time HTTP notifications when events happen in your Forja site. When a configured event occurs (e.g., a blog post is published), Forja sends an HTTP POST request to your specified URL with details about the event.

## Use Cases

- **Deploy on publish** -- trigger a static site rebuild when content changes.
- **Sync to external systems** -- push content updates to a search index, CDN, or analytics platform.
- **Notifications** -- send a Slack or Discord message when new content is published.
- **Backup** -- trigger a backup process when content is modified.

## Accessing Webhooks

Navigate to **Site Settings** in the sidebar, then open the **Webhooks** tab. The page shows all configured webhooks for the currently selected site.

## Webhook Listing

| Column | Description |
|--------|-------------|
| **Name** | A descriptive name for the webhook. |
| **URL** | The target endpoint that receives the POST request. |
| **Events** | The events this webhook listens to. |
| **Status** | Active or Inactive. |
| **Last delivery** | Timestamp and status of the most recent delivery. |

## Creating a Webhook

1. Click the **New Webhook** button.
2. Fill in the webhook details:
   - **Name** -- a descriptive name (e.g., "Deploy trigger", "Slack notification").
   - **URL** -- the endpoint URL that will receive the POST request. Must be a valid HTTPS URL.
   - **Secret** -- an optional shared secret. When provided, Forja signs the payload with this secret so your endpoint can verify the request is authentic.
   - **Events** -- select one or more events to listen to (see [Available Events](#available-events) below).
3. Click **Save**. The webhook is created in an **Active** state.

## Available Events

Forja supports 27 webhook events across all content types:

### Blog Events

| Event | Triggered When |
|-------|---------------|
| `blog.created` | A new blog post is created. |
| `blog.updated` | A blog post is updated. |
| `blog.deleted` | A blog post is deleted. |
| `blog.published` | A blog post is published. |

### Page Events

| Event | Triggered When |
|-------|---------------|
| `page.created` | A new page is created. |
| `page.updated` | A page is updated. |
| `page.deleted` | A page is deleted. |
| `page.published` | A page is published. |

### Legal Events

| Event | Triggered When |
|-------|---------------|
| `legal.created` | A new legal document is created. |
| `legal.updated` | A legal document is updated. |
| `legal.deleted` | A legal document is deleted. |
| `legal.published` | A legal document is published. |

### CV Events

| Event | Triggered When |
|-------|---------------|
| `cv.created` | A new CV entry is created. |
| `cv.updated` | A CV entry is updated. |
| `cv.deleted` | A CV entry is deleted. |
| `cv.published` | A CV entry is published. |

### Project Events

| Event | Triggered When |
|-------|---------------|
| `project.created` | A new project is created. |
| `project.updated` | A project is updated. |
| `project.deleted` | A project is deleted. |
| `project.published` | A project is published. |

### Document & Media Events

| Event | Triggered When |
|-------|---------------|
| `document.created` | A new document is created. |
| `document.updated` | A document is updated. |
| `document.deleted` | A document is deleted. |
| `media.created` | A new media file is uploaded. |
| `media.deleted` | A media file is deleted. |

### Navigation Events

| Event | Triggered When |
|-------|---------------|
| `navigation.created` | A navigation item is created. |
| `navigation.updated` | A navigation menu or item is updated. |
| `navigation.deleted` | A navigation item is deleted. |

:::info
The available events may vary depending on your Forja version. The webhook creation form always shows the current list of supported events.
:::

## Hosting Platform Templates

When creating a webhook, you can choose from pre-configured templates for popular hosting platforms:

| Template | Description | Default Debounce |
|----------|-------------|------------------|
| **Vercel** | Deploy hook for Vercel. URL auto-validated against `api.vercel.app`. | 30 seconds |
| **Netlify** | Build hook for Netlify. URL auto-validated against `api.netlify.com`. | 30 seconds |
| **Cloudflare** | Deploy hook for Cloudflare Pages. URL auto-validated against `api.cloudflare.com`. | 30 seconds |
| **Custom** | Any endpoint. No URL validation or defaults. | None |

Templates pre-fill the webhook name, URL pattern, default events (content creation, updates, deletes, and publishes), and debounce settings. The template picker auto-detects the hosting provider when you paste a URL.

## Debounce

Debounce prevents rapid-fire webhook deliveries when multiple events occur in quick succession (e.g., saving a blog post triggers several update events).

- **Debounce seconds** -- configurable per webhook (0--300 seconds). Set to 0 for immediate delivery.
- When debounce is active, events within the debounce window are accumulated and delivered as a single **batch** payload.
- The batch payload includes `event_count` and `batch_window_seconds` metadata.

:::tip
A 30-second debounce is recommended for deploy hooks, where you only need to trigger one rebuild regardless of how many content items changed.
:::

## Editing a Webhook

Click on a webhook in the listing to open its detail view. Modify the name, URL, secret, events, or debounce settings and save.

## Activating and Deactivating

Toggle a webhook's active status to temporarily stop or resume deliveries without deleting the webhook configuration.

## Delivery Logs

Each webhook maintains a delivery log showing the history of all delivery attempts:

### Viewing Delivery Logs

1. Click on a webhook to open its detail view.
2. Navigate to the **Deliveries** tab.
3. Each delivery entry shows:
   - **Timestamp** -- when the delivery was attempted.
   - **Event** -- the event that triggered the delivery.
   - **Status code** -- the HTTP response status code from your endpoint.
   - **Response time** -- how long your endpoint took to respond.
   - **Status** -- Success, Failed, or Pending.

### Retry Behavior

If a delivery fails (your endpoint returns an error or is unreachable), Forja retries the delivery with exponential backoff.

## Testing a Webhook

To verify your webhook is configured correctly:

1. Open the webhook detail view.
2. Click the **Test** button.
3. Forja sends a test payload to your endpoint.
4. Check the delivery log to see the result.

The test payload contains sample data and is clearly marked as a test event.

## Webhook Payload

Webhook payloads are sent as JSON in the POST request body. A typical payload looks like:

```json
{
  "event": "blog.published",
  "timestamp": "2025-01-15T10:30:00Z",
  "site_id": "uuid-of-site",
  "data": {
    "id": "uuid-of-blog-post",
    "title": "My New Post",
    "slug": "my-new-post",
    "status": "published"
  }
}
```

If a secret is configured, the request includes a signature header that your endpoint can use to verify authenticity.

## Deleting a Webhook

1. Open the webhook or select it from the listing.
2. Click **Delete** and confirm.

Deleting a webhook also removes its delivery history.

## Analytics

Each webhook has an **Analytics** section showing delivery performance:

- **Summary cards** -- total deliveries, success rate (color-coded: green for 95%+, yellow for 80%+, red below 80%), and pending retry count.
- **By-event table** -- breakdown of deliveries per event type with total, successful, and failed counts.
- **Time windows** -- toggle between 1 hour, 24 hours, 7 days, and 30 days.

Analytics data comes from the `GET /webhooks/{id}/stats` API endpoint.

## Permissions

| Action | Required Role |
|--------|--------------|
| View webhooks | Admin, Owner |
| Create/edit webhooks | Admin, Owner |
| Delete webhooks | Admin, Owner |
| View delivery logs | Admin, Owner |
| View analytics | Admin, Owner |
| Test webhooks | Admin, Owner |
