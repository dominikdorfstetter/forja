const API_KEY = 'api_key';
const GUEST_FLAG = 'api_key_is_guest';

/**
 * Migrate API key from localStorage to sessionStorage.
 *
 * Defense-in-depth: sessionStorage is cleared when the tab closes,
 * limiting the window for XSS exfiltration compared to localStorage
 * which persists indefinitely.
 */
export function migrateApiKeyStorage(): void {
  try {
    const key = localStorage.getItem(API_KEY);
    if (key) {
      sessionStorage.setItem(API_KEY, key);
      localStorage.removeItem(API_KEY);
    }
  } catch {
    // Storage access may fail in sandboxed/private environments
  }
}

/** Read the API key from sessionStorage. */
export function getApiKey(): string | null {
  try {
    return sessionStorage.getItem(API_KEY);
  } catch {
    return null;
  }
}

/** Store an API key in sessionStorage. */
export function setApiKey(key: string): void {
  try {
    sessionStorage.setItem(API_KEY, key);
  } catch {
    // Storage access may fail in sandboxed/private environments
  }
}

/** Remove the API key from sessionStorage. */
export function clearApiKey(): void {
  try {
    sessionStorage.removeItem(API_KEY);
    sessionStorage.removeItem(GUEST_FLAG);
  } catch {
    // Storage access may fail in sandboxed/private environments
  }
}

/** Mark the currently-stored API key as a guest/demo session. Callers MUST
 *  invoke this immediately after `setApiKey` for a demo activation — the
 *  flag is what lets the auth context flip into guest mode and stop
 *  rendering the welcome screen. */
export function markCurrentKeyAsGuest(): void {
  try {
    sessionStorage.setItem(GUEST_FLAG, '1');
  } catch {
    // Storage access may fail in sandboxed/private environments
  }
}

/** Check whether the current API key is a guest/demo key.
 *
 *  Reads the explicit `GUEST_FLAG` marker rather than sniffing the key's
 *  prefix — the demo key is now randomly generated per server boot
 *  (security fix), so the old `dk_guest_*` prefix check no longer
 *  matches. Callers that activate demo mode must set the marker via
 *  `markCurrentKeyAsGuest()`. */
export function isGuestApiKey(): boolean {
  if (getApiKey() === null) return false;
  try {
    return sessionStorage.getItem(GUEST_FLAG) === '1';
  } catch {
    return false;
  }
}
