/**
 * CSP nonce extracted from the <meta property="csp-nonce"> tag injected by the backend.
 * Shared across Emotion caches and ClerkProvider so every injected <style> tag
 * carries the nonce attribute required by our Content-Security-Policy.
 */
const raw =
  document.querySelector('meta[property="csp-nonce"]')?.getAttribute('content') || undefined;

// In dev the backend placeholder is never replaced — treat it as absent.
export const cspNonce = raw && raw !== '{{CSP_NONCE}}' ? raw : undefined;
