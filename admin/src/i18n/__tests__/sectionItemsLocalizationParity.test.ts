import { describe, expect, it } from 'vitest';

// Static imports keep this test inside the browser type universe — the admin
// tsconfig deliberately excludes @types/node, so reading via `fs` would fail
// `tsc --noEmit` in CI even though it runs locally.
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

const LOCALES: ReadonlyArray<[string, unknown]> = [
  ['ar', ar],
  ['de-AT', deAT],
  ['de', de],
  ['en', en],
  ['es', es],
  ['fr', fr],
  ['it', itLocale],
  ['nl', nl],
  ['pl', pl],
  ['pt', pt],
  ['uk', uk],
];

// Section items localization (consumer-feedback roadmap, parked item):
// per-locale override of a section's settings.items.
const NEW_KEYS = [
  'sectionEditor.items.localizeAction',
  'sectionEditor.items.removeLocalization',
  'sectionEditor.items.fallbackNotice',
  'sectionEditor.items.overrideNotice',
];

// The notices interpolate the active locale code.
const INTERPOLATED_KEYS = [
  'sectionEditor.items.fallbackNotice',
  'sectionEditor.items.overrideNotice',
];

function getDeep(obj: unknown, dotted: string): unknown {
  return dotted.split('.').reduce<unknown>((acc, k) => {
    if (acc && typeof acc === 'object') {
      return (acc as Record<string, unknown>)[k];
    }
    return undefined;
  }, obj);
}

describe('section items localization i18n parity', () => {
  it.each(LOCALES)(
    'locale %s has every new key with a non-empty string value',
    (locale, data) => {
      for (const key of NEW_KEYS) {
        const value = getDeep(data, key);
        expect(
          typeof value === 'string' && value.trim().length > 0,
          `${locale}.json is missing "${key}" (got ${JSON.stringify(value)})`,
        ).toBe(true);
      }
    },
  );

  it.each(LOCALES)(
    'locale %s keeps the {{locale}} placeholder in the notices',
    (locale, data) => {
      for (const key of INTERPOLATED_KEYS) {
        const value = getDeep(data, key);
        expect(
          typeof value === 'string' && value.includes('{{locale}}'),
          `${locale}.json "${key}" must interpolate {{locale}}`,
        ).toBe(true);
      }
    },
  );
});
