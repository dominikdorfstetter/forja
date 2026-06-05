import { describe, it, expect } from 'vitest';
import type { TFunction } from 'i18next';
import {
  REDIRECT_STATUS_CODES,
  isPermanentRedirect,
  isRedirectStatusCode,
  redirectChipProps,
  redirectFormLabel,
  type RedirectStatusCode,
} from '@/utils/redirectStatus';

// Identity translator — returns the key itself so we can assert on key
// routing without standing up the full i18n setup.
const tIdentity = ((k: string) => k) as unknown as TFunction;

describe('redirectStatus', () => {
  it('exposes the four allowed codes in stable order', () => {
    expect(REDIRECT_STATUS_CODES).toEqual([301, 302, 307, 308]);
  });

  it('narrows arbitrary numbers to the allowed domain', () => {
    expect(isRedirectStatusCode(301)).toBe(true);
    expect(isRedirectStatusCode(308)).toBe(true);
    expect(isRedirectStatusCode(200)).toBe(false);
    expect(isRedirectStatusCode(303)).toBe(false);
  });

  it('treats 301 and 308 as permanent, 302 and 307 as temporary', () => {
    expect(isPermanentRedirect(301)).toBe(true);
    expect(isPermanentRedirect(308)).toBe(true);
    expect(isPermanentRedirect(302)).toBe(false);
    expect(isPermanentRedirect(307)).toBe(false);
  });

  it('routes each code to a distinct form-label i18n key', () => {
    const keys = REDIRECT_STATUS_CODES.map((c) => redirectFormLabel(c, tIdentity));
    expect(new Set(keys).size).toBe(REDIRECT_STATUS_CODES.length);
    expect(keys).toEqual([
      'forms.redirect.fields.permanent',
      'forms.redirect.fields.temporary',
      'forms.redirect.fields.temporaryStrict',
      'forms.redirect.fields.permanentStrict',
    ]);
  });

  it('routes each code to a distinct table chip label and the right color', () => {
    const expected: Record<RedirectStatusCode, { label: string; color: string }> = {
      301: { label: 'redirects.table.permanent', color: 'primary' },
      302: { label: 'redirects.table.temporary', color: 'secondary' },
      307: { label: 'redirects.table.temporaryStrict', color: 'secondary' },
      308: { label: 'redirects.table.permanentStrict', color: 'primary' },
    };
    for (const code of REDIRECT_STATUS_CODES) {
      expect(redirectChipProps(code, tIdentity)).toEqual(expected[code]);
    }
  });
});
