/**
 * Redirect status_code helpers — keep the admin UI in lockstep with the
 * API contract pinned by issue #743. The domain is `301 | 302 | 307 | 308`;
 * 307/308 preserve the request method and are the modern recommendation
 * for any redirect that should survive a POST/PUT.
 *
 * Centralised here so the form dialog, the listing chip, and any future
 * surface cannot drift from each other.
 */

import type { ChipProps } from '@mui/material';
import type { TFunction } from 'i18next';

export type RedirectStatusCode = 301 | 302 | 307 | 308;

export const REDIRECT_STATUS_CODES: readonly RedirectStatusCode[] = [
  301, 302, 307, 308,
] as const;

export function isRedirectStatusCode(code: number): code is RedirectStatusCode {
  return code === 301 || code === 302 || code === 307 || code === 308;
}

/** Permanent: 301 (legacy) and 308 (method-preserving). */
export function isPermanentRedirect(code: RedirectStatusCode): boolean {
  return code === 301 || code === 308;
}

const FORM_LABEL_KEYS: Record<RedirectStatusCode, string> = {
  301: 'forms.redirect.fields.permanent',
  302: 'forms.redirect.fields.temporary',
  307: 'forms.redirect.fields.temporaryStrict',
  308: 'forms.redirect.fields.permanentStrict',
};

const TABLE_LABEL_KEYS: Record<RedirectStatusCode, string> = {
  301: 'redirects.table.permanent',
  302: 'redirects.table.temporary',
  307: 'redirects.table.temporaryStrict',
  308: 'redirects.table.permanentStrict',
};

export function redirectFormLabel(code: RedirectStatusCode, t: TFunction): string {
  return t(FORM_LABEL_KEYS[code]);
}

export function redirectChipProps(
  code: RedirectStatusCode,
  t: TFunction,
): { label: string; color: ChipProps['color'] } {
  return {
    label: t(TABLE_LABEL_KEYS[code]),
    color: isPermanentRedirect(code) ? 'primary' : 'secondary',
  };
}
