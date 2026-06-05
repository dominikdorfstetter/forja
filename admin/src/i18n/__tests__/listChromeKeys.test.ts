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

// The list-chrome convention resolved by EntityListPage as `<ns>.list.<sub>`.
const NAMESPACES = ['blogs', 'pages', 'legal'];
const SUBKEYS = [
  'title',
  'subtitle',
  'breadcrumb',
  'loading',
  'loadError',
  'empty.title',
  'empty.description',
  'empty.noSite',
  'searchPlaceholder',
  'tabs.active',
  'tabs.archived',
  'messages.updated',
  'messages.deleted',
];

function get(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((cur, part) => {
    if (cur && typeof cur === 'object' && part in (cur as Record<string, unknown>)) {
      return (cur as Record<string, unknown>)[part];
    }
    return undefined;
  }, obj);
}

describe('list-chrome i18n convention coverage', () => {
  it('every locale defines a non-empty string for every <ns>.list.<sub> key', () => {
    const missing: string[] = [];
    for (const [locale, dict] of Object.entries(LOCALES)) {
      for (const ns of NAMESPACES) {
        for (const sub of SUBKEYS) {
          const value = get(dict, `${ns}.list.${sub}`);
          if (typeof value !== 'string' || value.length === 0) {
            missing.push(`${locale}: ${ns}.list.${sub}`);
          }
        }
      }
    }
    expect(missing).toEqual([]);
  });
});
