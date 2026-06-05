/**
 * Pure classifier for a document's private-share lifecycle state.
 *
 * The backend exposes three signals (`private_access_expires_at`,
 * `private_locked_until`, `is_private`); this module collapses them into
 * a single discriminant so the grid, detail page, and dialogs can render
 * the same badge from the same source of truth.
 */

export type DocumentPrivacyState =
  | 'public'
  | 'active'
  | 'expiring' // < EXPIRING_SOON_MS until expiry
  | 'expired'
  | 'locked';

export const EXPIRING_SOON_MS = 60 * 60 * 1000; // 1 hour

export interface PrivacyStateInput {
  is_private?: boolean;
  private_access_expires_at?: string | null;
  private_locked_until?: string | null;
}

export function classifyPrivacyState(
  doc: PrivacyStateInput,
  now: Date = new Date(),
): DocumentPrivacyState {
  if (!doc.is_private) return 'public';
  if (doc.private_locked_until) return 'locked';
  if (doc.private_access_expires_at) {
    const exp = new Date(doc.private_access_expires_at).getTime();
    const remaining = exp - now.getTime();
    if (remaining <= 0) return 'expired';
    if (remaining <= EXPIRING_SOON_MS) return 'expiring';
  }
  return 'active';
}

/**
 * The set of TTL options surfaced in the admin's privacy dialog.
 * Values are durations in milliseconds; `null` means "never expires".
 */
export const TTL_PRESETS: ReadonlyArray<{ key: string; ms: number | null }> = [
  { key: 'never', ms: null },
  { key: '1h', ms: 60 * 60 * 1000 },
  { key: '6h', ms: 6 * 60 * 60 * 1000 },
  { key: '24h', ms: 24 * 60 * 60 * 1000 },
  { key: '7d', ms: 7 * 24 * 60 * 60 * 1000 },
  { key: '30d', ms: 30 * 24 * 60 * 60 * 1000 },
] as const;

/**
 * Convert a TTL preset key to an ISO timestamp suitable for the backend
 * `expires_at` field. Returns `null` for the "never" preset.
 */
export function ttlPresetToIso(presetKey: string, now: Date = new Date()): string | null {
  const preset = TTL_PRESETS.find((p) => p.key === presetKey);
  if (!preset || preset.ms === null) return null;
  return new Date(now.getTime() + preset.ms).toISOString();
}
