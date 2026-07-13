import { describe, it, expect } from 'vitest';

import ar from '../locales/ar.json';
import deAT from '../locales/de-AT.json';
import de from '../locales/de.json';
import en from '../locales/en.json';
import es from '../locales/es.json';
import fr from '../locales/fr.json';
import itLocale from '../locales/it.json';
import nl from '../locales/nl.json';
import pl from '../locales/pl.json';
import pt from '../locales/pt.json';
import uk from '../locales/uk.json';

const LOCALES: Record<string, unknown> = { ar, 'de-AT': deAT, de, en, es, fr, it: itLocale, nl, pl, pt, uk };

const EXTRA_KEYS = [
  'layout.sidebar.uiStrings',
  'errorCodes.ERR_STRINGS_KEY_TAKEN.message',
  'errorCodes.ERR_STRINGS_KEY_TAKEN.action',
  'errorCodes.ERR_STRINGS_LIMIT_EXCEEDED.message',
  'errorCodes.ERR_STRINGS_LIMIT_EXCEEDED.action',
];

function get(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((cur, part) => {
    if (cur && typeof cur === 'object' && part in (cur as Record<string, unknown>)) {
      return (cur as Record<string, unknown>)[part];
    }
    return undefined;
  }, obj);
}

/** Every leaf path of the canonical (en) uiStrings namespace. */
function leafPaths(obj: unknown, prefix: string): string[] {
  if (typeof obj !== 'object' || obj === null) return [prefix];
  return Object.entries(obj as Record<string, unknown>).flatMap(([key, value]) =>
    leafPaths(value, `${prefix}.${key}`),
  );
}

describe('uiStrings i18n coverage (all 11 locales)', () => {
  const keys = [...leafPaths(get(en, 'uiStrings'), 'uiStrings'), ...EXTRA_KEYS];

  it('derives the key list from the canonical en catalog', () => {
    expect(keys.length).toBeGreaterThan(30);
    // The dialog editor + key search replaced the detail-page flow.
    expect(keys).toContain('uiStrings.dialog.createTitle');
    expect(keys).toContain('uiStrings.dialog.clearHint');
    expect(keys).toContain('uiStrings.list.searchPlaceholder');
    expect(keys.some((key) => key.startsWith('uiStrings.detail.'))).toBe(false);
  });

  it('every locale defines a non-empty string for every uiStrings key', () => {
    const missing: string[] = [];
    for (const [locale, dict] of Object.entries(LOCALES)) {
      for (const key of keys) {
        const value = get(dict, key);
        if (typeof value !== 'string' || value.length === 0) {
          missing.push(`${locale}: ${key}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });
});
