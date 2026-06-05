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

// New ALTCHA provider-mode strings (#772).
const NEW_KEYS = [
  'siteSettings.forms.botProtection.mode.label',
  'siteSettings.forms.botProtection.mode.altcha',
  'siteSettings.forms.botProtection.mode.altchaRecommended',
  'siteSettings.forms.botProtection.mode.remote',
  'siteSettings.forms.botProtection.altcha.description',
  'siteSettings.forms.botProtection.altcha.regenerateKey',
  'siteSettings.forms.botProtection.altcha.keyRegenerated',
  'siteSettings.forms.botProtection.altcha.keyRegenerateFailed',
  'siteSettings.forms.botProtection.altcha.regenConfirm.title',
  'siteSettings.forms.botProtection.altcha.regenConfirm.body',
  'siteSettings.forms.botProtection.altcha.challengeUrlLabel',
  'siteSettings.forms.botProtection.altcha.challengeUrlHint',
  'siteSettings.forms.botProtection.loadError',
];

function getDeep(obj: unknown, dotted: string): unknown {
  return dotted.split('.').reduce<unknown>((acc, k) => {
    if (acc && typeof acc === 'object') {
      return (acc as Record<string, unknown>)[k];
    }
    return undefined;
  }, obj);
}

describe('ALTCHA bot-protection i18n parity (#772)', () => {
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
});
