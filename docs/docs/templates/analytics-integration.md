---
sidebar_position: 3
---

# Analytics Integration

The `@forja/analytics` library is a lightweight, privacy-first tracking script that records pageviews from your frontend site. It uses `navigator.sendBeacon()` for reliable delivery and never sets cookies or stores personal data.

## Installation

```bash
npm install @forja/analytics
```

## Quick Start

```typescript
import { init, trackPageview } from '@forja/analytics';

init({
  siteId: 'your-site-uuid',
  apiKey: 'your-read-api-key',
  endpoint: 'https://your-api.com/api/v1',
});

trackPageview();
```

## Configuration

```typescript
import { init } from '@forja/analytics';

init({
  siteId: string,     // Your Forja site UUID (required)
  apiKey: string,     // Read-level API key (required)
  endpoint: string,   // API base URL, e.g. "https://api.example.com/api/v1" (required)
  debug?: boolean,    // Log tracking events to the console (default: false)
});
```

:::tip
Use a **Read-level** API key for the tracking script. The same key you use to fetch content can also record pageviews -- no separate write key is needed.
:::

## Tracking Methods

### Manual Tracking

Track individual pageviews explicitly:

```typescript
import { trackPageview } from '@forja/analytics';

// Auto-detects the current path from window.location.pathname
trackPageview();

// Or specify a custom path
trackPageview('/custom/path');
```

### Auto-Tracking (SPAs)

For single-page applications, `autoTrack()` automatically records pageviews on initial load and route changes:

```typescript
import { init, autoTrack } from '@forja/analytics';

init({ /* config */ });

const cleanup = autoTrack();

// Call cleanup() when you want to stop tracking (e.g. on unmount)
```

Auto-tracking hooks into `popstate` events and monkey-patches `pushState` / `replaceState` to detect client-side navigation.

## Astro Integration

Add the tracking script to your Astro layout so it runs on every page:

```astro
---
// src/layouts/BaseLayout.astro
---
<html>
  <head><!-- ... --></head>
  <body>
    <slot />
    <script>
      import { init, trackPageview } from '@forja/analytics';

      init({
        siteId: import.meta.env.PUBLIC_CMS_SITE_ID,
        apiKey: import.meta.env.PUBLIC_CMS_API_KEY,
        endpoint: import.meta.env.PUBLIC_CMS_API_URL,
      });

      trackPageview();
    </script>
  </body>
</html>
```

For Astro sites with View Transitions, use `autoTrack()` instead so route changes are captured:

```astro
<script>
  import { init, autoTrack } from '@forja/analytics';

  init({ /* config */ });
  autoTrack();
</script>
```

## How It Works

1. On each tracked pageview, the library sends a POST request to `/sites/{site_id}/analytics/pageview` with the page path and referrer.
2. The server extracts the client IP and User-Agent from request headers, computes a **daily rotating SHA-256 hash**, and stores only the hash (16 hex characters).
3. The referrer is reduced to its domain -- full URLs are discarded.
4. No cookies, local storage, or fingerprinting techniques are used.

## Transport

- Uses `navigator.sendBeacon()` when available (reliable during page unload).
- Falls back to `fetch()` with `keepalive: true`.
- Errors are silently ignored -- tracking never blocks or breaks your site.
- Bot traffic (`navigator.webdriver`) and non-browser environments are automatically skipped.

## Verifying Integration

1. Set `debug: true` in the `init()` config.
2. Open your site and navigate between pages.
3. Check the browser console for tracking log messages.
4. In the Forja admin dashboard, navigate to the **Dashboard** -- the analytics widget should show your visits within a few seconds.
