---
sidebar_position: 12
---

# API Keys

API keys provide programmatic access to the Forja API. They are used by frontend templates, CI/CD pipelines, scripts, and external integrations to authenticate requests without a Clerk user session.

## Accessing API Keys

Navigate to **Site Settings** in the sidebar, then open the **API Keys** tab. The page shows all API keys for the **currently selected site** — keys are always scoped to one site, so there is no site picker when creating a key.

## API Key Listing

| Column | Description |
|--------|-------------|
| **Name** | A descriptive name for the key. |
| **Key prefix** | The first few characters of the key (the full key is never shown again after creation). |
| **Permission** | The permission level: Master, Admin, Write, or Read. |
| **Status** | Active or Blocked. |
| **Created** | When the key was created. |
| **Last used** | When the key was last used to make an API request. |

## Creating an API Key

1. Click the **New API Key** button.
2. Fill in the details:
   - **Name** -- a descriptive name that identifies the purpose of this key (e.g., "Astro blog frontend", "CI deploy script").
   - **Permission level** -- select the appropriate permission level:
     - **Read** -- can only read data. Best for public-facing frontends.
     - **Write** -- can read and write data. Suitable for content editors or automation scripts.
     - **Admin** -- full access to the site. Use for administrative integrations.
     - **Master** -- system-wide access. Use sparingly and only for trusted system integrations.
   - **Usage quotas** -- the maximum number of requests the key may make per **hour**, **day**, and **month**. Defaults are 1,000 / 10,000 / 100,000. Raise these for a key that backs a content-heavy site whose static build fans out into many requests per page (see [Rate limits and quotas](#rate-limits-and-quotas) below).
3. Click **Create**. The key is created for the currently selected site.

:::caution
The full API key is displayed **only once** after creation. Copy it immediately and store it securely. You will not be able to see the full key again.
:::

## Editing an API Key

To change an existing key's **name** or **usage quotas** without rotating it:

1. Open the row actions menu (**⋮**) for the key in the listing.
2. Click **Edit**.
3. Adjust the name or the hourly/daily/monthly quotas and click **Save**.

The change takes effect immediately — the limiter reads the quota from the key record on every request, so you do not need to recreate the key or restart anything.

## Using an API Key

Include the API key in the `X-API-Key` header of your HTTP requests:

```bash
curl -H "X-API-Key: your-api-key-here" \
  https://your-forja-instance.com/api/v1/sites
```

## Permission Levels

API keys follow the same four-tier permission model as user roles:

| Level | What It Can Do |
|-------|---------------|
| **Read** | Fetch content, media URLs, navigation, taxonomy, settings. |
| **Write** | Everything Read can do, plus create/update/delete content and media. |
| **Admin** | Everything Write can do, plus manage members, webhooks, redirects, and site settings. |
| **Master** | Full system access across all sites. |

:::tip
Follow the principle of least privilege. Give each API key only the permissions it needs. A frontend that only displays content should use a **Read** key.
:::

## Rate limits and quotas

Each API key is rate-limited on two independent axes:

- **Calendar quotas** — the hourly, daily, and monthly request ceilings you set per key (see [Editing an API Key](#editing-an-api-key)). When a window is exhausted, further requests get `429 Too Many Requests` until the window rolls over. These are the limits to raise if a legitimate integration is being throttled.
- **Burst cap** — a per-key requests-per-second ceiling that protects against sudden spikes regardless of the calendar quota. It defaults to 100 req/s and is configured server-side via the `RATE_LIMIT_BURST_PER_SECOND` environment variable (see [Environment Variables](../deployment/environment-variables.md)).

:::tip
If a static-site build is hitting the limit, prefer raising the **hourly quota** on the key over disabling limits. Also make sure the site fetches shared "chrome" (site, locales, menus, social, legal) once per build rather than once per page — the reference Astro template memoizes these, and the API additionally [caches them server-side](cache.md).
:::

## Blocking an API Key

If an API key is compromised or no longer needed but you want to keep the record:

1. Click on the API key in the listing.
2. Click **Block**. The key immediately stops working for API requests.
3. A blocked key can be unblocked later if needed.

## Revoking (Deleting) an API Key

To permanently remove an API key:

1. Click on the API key in the listing.
2. Click **Delete** and confirm.

The key is permanently removed and can no longer be used. If any integration was using this key, it will stop working immediately.

## Best Practices

- **Name keys descriptively** -- use names like "Production frontend" or "Staging deploy" so you can identify their purpose later.
- **Use Read-only keys for frontends** -- your public-facing website only needs to read content.
- **Rotate keys periodically** -- create a new key, update your integrations, then delete the old key.
- **Never commit keys to version control** -- store them in environment variables or a secrets manager.
- **Monitor last-used dates** -- if a key has not been used in a long time, consider revoking it.

## Permissions

| Action | Required Role |
|--------|--------------|
| View API keys | Admin, Owner |
| Create API keys | Admin, Owner |
| Edit API keys (name, quotas) | Admin, Owner |
| Block/unblock API keys | Admin, Owner |
| Delete API keys | Admin, Owner |
