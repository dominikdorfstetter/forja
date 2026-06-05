---
sidebar_position: 13
---

# Cache

Forja keeps a short-lived **server-side cache** of public, read-only content so that high-traffic reads — and especially static-site builds that fan out into many requests per page — are served from memory instead of hitting the database every time. The cache is transparent: you never have to use it, but you can inspect and control it from the admin.

## What is cached

Only responses that are **identical for every caller of a site** are cached — public content reads such as social links, locales, navigation menus, legal documents, published blogs and projects, skills, CV entries, and pages by route. Anything that varies by the calling user (for example the per-role site context) is never cached.

Caching happens **after** authentication, so an API key is always validated and its quota still counts; the cache only skips the database work on a hit. Cached entries expire automatically after a short time-to-live, and any content edit **immediately clears** the affected site's cache, so published changes are never stale.

## Inspecting and controlling the cache (site admins)

Open **Site Settings → Overview**. The **Cache** panel shows:

- **Entry count** — how many responses are currently cached for this site.
- **Resources** — which cached resources are present (e.g. `social`, `locales`, `blogs:by-slug:my-post`).

Two actions are available:

| Action | Effect |
|--------|--------|
| **Invalidate** | Clears every cached entry for the site. The next request for each resource is served fresh from the database and re-cached. |
| **Rebuild** | Clears the cache **and** immediately re-warms the deterministic per-site resources (social links, locales). The remaining resources refill on demand as they are requested. |

You normally never need these — content edits invalidate automatically — but they are useful after a bulk import, a data fix applied outside the admin, or when you simply want to confirm the freshest data is being served.

## System-wide cache (system admins)

System administrators get an **overall cache** panel on the **System Dashboard** showing the total number of cached entries across all sites, a per-site breakdown, and an **Invalidate all** action that clears the entire cache. A warning is shown if the cache backend (Redis) is unavailable, in which case caching is disabled and every read goes straight to the database.

## Configuration

The cache requires Redis (`REDIS_URL`). Its time-to-live backstop is set with the `RESPONSE_CACHE_TTL_SECS` environment variable (default 60 seconds). See [Environment Variables](../deployment/environment-variables.md). If Redis is not configured, caching is silently disabled and the API continues to serve every read from the database.

## Permissions

| Action | Required Role |
|--------|--------------|
| View / invalidate / rebuild a site's cache | Admin, Owner (for that site) |
| View overall cache / invalidate all | System admin |
