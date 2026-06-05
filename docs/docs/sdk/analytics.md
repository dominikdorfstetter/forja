---
sidebar_position: 3
---

# Analytics Tracker

`@forjacms/analytics` is a lightweight, privacy-first pageview tracker for Forja CMS. It sends pageview events to your Forja backend with zero cookies, zero PII, and zero dependencies.

:::info This is separate from the Content SDK
The Content SDK (`@forjacms/client`) also has an `analytics` resource for querying reports and per-page stats. This package is the **browser-side tracker** you embed on your site to record pageviews.
:::

## Installation

```bash
npm install @forjacms/analytics
```

## Quick Start

```typescript
import { init, trackPageview } from '@forjacms/analytics';

init({
  siteId: 'your-site-uuid',
  apiKey: 'your-read-api-key',
  endpoint: 'https://your-api.com/api/v1',
});

trackPageview();            // tracks current page
trackPageview('/custom');   // tracks a specific path
```

## API

### `init(config)`

Initialize the tracker. Must be called before `trackPageview` or `autoTrack`.

| Parameter | Type | Required | Description |
|-----------|------|----------|-------------|
| `siteId` | `string` | Yes | Your Forja site UUID |
| `apiKey` | `string` | Yes | API key with at least Read permission |
| `endpoint` | `string` | Yes | Forja API base URL (e.g., `https://your-api.com/api/v1`) |
| `debug` | `boolean` | No | Enable console debug logging (default: `false`) |

### `trackPageview(path?)`

Track a single pageview. Uses `window.location.pathname` if no path is provided.

- Sends a `POST` to `/sites/{siteId}/analytics/pageview`
- Uses `fetch` with `keepalive: true` for reliability during page unload
- Automatically skips bots (`navigator.webdriver`) and non-browser environments
- Silently ignores fetch errors -- analytics never break the page

### `autoTrack()`

Auto-track pageviews on client-side route changes (for SPAs). Returns a cleanup function.

```typescript
const cleanup = autoTrack();

// Later, stop tracking
cleanup();
```

Listens for:
- `popstate` events (browser back/forward)
- `history.pushState` calls
- `history.replaceState` calls

Fires an initial pageview on setup. The cleanup function removes all listeners and restores the original `history` methods.

## Framework Integration

### Astro

```astro
<script>
  import { init, autoTrack } from '@forjacms/analytics';

  init({
    siteId: import.meta.env.PUBLIC_FORJA_SITE_ID,
    apiKey: import.meta.env.PUBLIC_FORJA_API_KEY,
    endpoint: import.meta.env.PUBLIC_FORJA_ENDPOINT,
  });

  autoTrack();
</script>
```

### React / Next.js

```tsx
import { useEffect } from 'react';
import { init, autoTrack } from '@forjacms/analytics';

function App() {
  useEffect(() => {
    init({ siteId: '...', apiKey: '...', endpoint: '...' });
    return autoTrack();
  }, []);

  return <>{/* your app */}</>;
}
```

### Vue / Nuxt

```vue
<script setup>
import { onMounted, onUnmounted } from 'vue';
import { init, autoTrack } from '@forjacms/analytics';

let cleanup: () => void;
onMounted(() => {
  init({ siteId: '...', apiKey: '...', endpoint: '...' });
  cleanup = autoTrack();
});
onUnmounted(() => cleanup?.());
</script>
```

## Privacy

- **No cookies** -- nothing is stored in the browser
- **No PII** -- no IP addresses, user agents, or fingerprints are collected
- **Referrer only** -- only `document.referrer` is sent (and only if non-empty)
- **Bot filtering** -- automated browsers (`navigator.webdriver`) are excluded
- **Fire-and-forget** -- errors are silently swallowed so analytics never degrade UX

:::tip
Because Forja analytics uses no cookies, you do **not** need a cookie consent banner for analytics tracking. It is GDPR-compliant by default.
:::
