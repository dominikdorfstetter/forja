import { describe, expect, it } from 'vitest';

// Static imports keep this test inside the browser type universe — the
// admin tsconfig deliberately excludes @types/node, so reading the files
// via `fs` would fail `tsc --noEmit` in CI even though it runs locally.
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

const NEW_KEYS = [
  'documents.privacy.ttl.label',
  'documents.privacy.ttl.never',
  'documents.privacy.ttl.1h',
  'documents.privacy.ttl.6h',
  'documents.privacy.ttl.24h',
  'documents.privacy.ttl.7d',
  'documents.privacy.ttl.30d',
  'documents.privacy.badge',
  'documents.privacy.expiringBadge',
  'documents.privacy.expiredBadge',
  'documents.privacy.lockedBadge',
  'documents.privacy.unlock',
  'documents.privacy.unlockTitle',
  'documents.privacy.unlockConfirm',
  'documents.privacy.unlockSuccess',
  'documents.privacy.unlockError',
  'documents.privacy.errors.expired',
  'documents.privacy.errors.locked',
  'documents.privacy.errors.invalidTtl',
  'documents.privacy.errors.notLocked',
];

function getDeep(obj: unknown, dotted: string): unknown {
  return dotted.split('.').reduce<unknown>((acc, k) => {
    if (acc && typeof acc === 'object') {
      return (acc as Record<string, unknown>)[k];
    }
    return undefined;
  }, obj);
}

describe('document privacy i18n parity (#701)', () => {
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
