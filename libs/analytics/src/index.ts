/**
 * @forja/analytics — Privacy-first pageview tracker for Forja CMS.
 *
 * No cookies. No IP storage. No PII. GDPR-compliant by design.
 *
 * Usage:
 *   import { init, trackPageview } from '@forja/analytics';
 *   init({ siteId: '...', apiKey: '...', endpoint: 'https://your-api.com/api/v1' });
 *   trackPageview();           // tracks current page
 *   trackPageview('/custom');   // tracks a specific path
 */

export interface ForjaAnalyticsConfig {
  /** Your Forja site UUID */
  siteId: string;
  /** API key with at least Read permission */
  apiKey: string;
  /** Forja API base URL (e.g., "https://your-api.com/api/v1") */
  endpoint: string;
  /** Enable debug logging (default: false) */
  debug?: boolean;
}

let config: ForjaAnalyticsConfig | null = null;

function log(...args: unknown[]) {
  if (config?.debug) {
    console.log('[forja-analytics]', ...args);
  }
}

/**
 * Initialize the analytics tracker.
 */
export function init(options: ForjaAnalyticsConfig): void {
  config = options;
  log('Initialized', { siteId: options.siteId, endpoint: options.endpoint });
}

/**
 * Track a pageview. If no path is provided, uses `window.location.pathname`.
 *
 * Sends a POST request to the Forja analytics endpoint.
 * Uses `fetch` with `keepalive: true` for reliability during page unload.
 */
export function trackPageview(path?: string): void {
  if (!config) {
    console.warn('[forja-analytics] Not initialized. Call init() first.');
    return;
  }

  // Skip bots, prerender, and non-browser environments
  if (typeof window === 'undefined') return;
  if (navigator.webdriver) return;

  const payload = {
    path: path ?? window.location.pathname,
    referrer: document.referrer || undefined,
  };

  const url = `${config.endpoint}/sites/${config.siteId}/analytics/pageview`;
  const headers = {
    'Content-Type': 'application/json',
    'X-API-Key': config.apiKey,
  };

  log('Tracking pageview', payload);

  fetch(url, {
    method: 'POST',
    headers,
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch(() => {
    // Silently ignore errors — analytics should never break the page
  });
}

/**
 * Auto-track pageviews on route changes (for SPAs).
 *
 * Listens for `popstate` events and monkey-patches `history.pushState`
 * / `history.replaceState` to detect client-side navigation.
 *
 * Returns a cleanup function to remove listeners.
 */
export function autoTrack(): () => void {
  if (typeof window === 'undefined') return () => {};

  // Track initial pageview
  trackPageview();

  // Track browser back/forward
  const onPopState = () => trackPageview();
  window.addEventListener('popstate', onPopState);

  // Patch pushState and replaceState
  const originalPush = history.pushState.bind(history);
  const originalReplace = history.replaceState.bind(history);

  history.pushState = (...args: Parameters<typeof history.pushState>) => {
    originalPush(...args);
    trackPageview();
  };

  history.replaceState = (...args: Parameters<typeof history.replaceState>) => {
    originalReplace(...args);
    trackPageview();
  };

  return () => {
    window.removeEventListener('popstate', onPopState);
    history.pushState = originalPush;
    history.replaceState = originalReplace;
  };
}
