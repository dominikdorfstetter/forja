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

/** Keys introduced by first-class legal references on nav items + legal slugs. */
const KEYS = [
  'navigation.brokenLink',
  'navigation.brokenLinkHint',
  'legalDetail.fields.slug',
  'legalDetail.slugHint',
  'legalDetail.slugLockedHint',
  'legalDetail.messages.slugUpdated',
  'legalDetail.messages.slugLocked',
  'errorCodes.LEGAL_SLUG_IMMUTABLE.message',
  'errorCodes.LEGAL_SLUG_IMMUTABLE.action',
];

function get(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((cur, part) => {
    if (cur && typeof cur === 'object' && part in (cur as Record<string, unknown>)) {
      return (cur as Record<string, unknown>)[part];
    }
    return undefined;
  }, obj);
}

describe('legal nav links i18n coverage (all 11 locales)', () => {
  it('every locale defines a non-empty string for every new key', () => {
    const missing: string[] = [];
    for (const [locale, dict] of Object.entries(LOCALES)) {
      for (const key of KEYS) {
        const value = get(dict, key);
        if (typeof value !== 'string' || value.length === 0) {
          missing.push(`${locale}: ${key}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });
});
