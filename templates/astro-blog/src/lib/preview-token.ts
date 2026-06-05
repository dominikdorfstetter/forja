// ---------------------------------------------------------------------------
// Preview token validation — verifies short-lived JWTs from the admin panel.
// Uses Node crypto (no external dependencies).
// ---------------------------------------------------------------------------

import { createHmac } from "node:crypto";

// Read at runtime via process.env — import.meta.env is baked at build time
// and the Docker image is built without this secret.
const PREVIEW_SECRET = process.env.PREVIEW_TOKEN_SECRET ?? '';

interface PreviewClaims {
  sub: string;
  iat: number;
  exp: number;
  purpose: string;
}

function base64UrlDecode(str: string): string {
  const padded = str + "=".repeat((4 - (str.length % 4)) % 4);
  return Buffer.from(padded, "base64url").toString("utf-8");
}

function base64UrlEncode(data: Buffer): string {
  return data.toString("base64url");
}

/** Validate a preview token and return the site_id it grants access to, or null. */
export function validatePreviewToken(token: string): string | null {
  if (!PREVIEW_SECRET) return null;

  const parts = token.split(".");
  if (parts.length !== 3) return null;

  const [header, payload, signature] = parts;

  // Verify HMAC-SHA256 signature
  const expected = base64UrlEncode(
    createHmac("sha256", PREVIEW_SECRET).update(`${header}.${payload}`).digest(),
  );

  if (signature !== expected) return null;

  try {
    const claims: PreviewClaims = JSON.parse(base64UrlDecode(payload));

    // Check expiry
    if (claims.exp < Date.now() / 1000) return null;

    // Check purpose
    if (claims.purpose !== "preview") return null;

    return claims.sub;
  } catch {
    return null;
  }
}
