import { describe, expect, it } from 'vitest';
import en from '../locales/en.json';
import de from '../locales/de.json';
import deAT from '../locales/de-AT.json';
import fr from '../locales/fr.json';
import es from '../locales/es.json';
import itIT from '../locales/it.json';
import pt from '../locales/pt.json';
import nl from '../locales/nl.json';
import pl from '../locales/pl.json';
import uk from '../locales/uk.json';
import ar from '../locales/ar.json';

type Json = Record<string, unknown>;

const LOCALES: Record<string, Json> = { de, 'de-AT': deAT, fr, es, it: itIT, pt, nl, pl, uk, ar };

/** Collect leaf paths under a subtree; arrays become `path[n]` length markers. */
function leafPaths(node: unknown, prefix = ''): string[] {
  if (Array.isArray(node)) return [`${prefix}[len=${node.length}]`];
  if (node && typeof node === 'object') {
    return Object.entries(node as Json).flatMap(([k, v]) =>
      leafPaths(v, prefix ? `${prefix}.${k}` : k),
    );
  }
  return [prefix];
}

const subtree = (locale: Json, top: 'welcome' | 'imprint', branch?: string): unknown => {
  const root = locale[top] as Json | undefined;
  if (!branch) return root;
  return root?.[branch];
};

/**
 * Tracer (#813): every welcome.* and imprint.* key authored in English must
 * exist in all 11 shipped locales — i18next fallback is not coverage.
 */
describe('welcome + imprint i18n parity', () => {
  // Only assert the branches this epic introduced, so unrelated pre-existing
  // gaps in legacy welcome.* keys don't fail this focused tracer.
  const branches: [string, () => string[]][] = [
    ['welcome.whatIs', () => leafPaths(subtree(en, 'welcome', 'whatIs'))],
    ['welcome.hero', () => leafPaths(subtree(en, 'welcome', 'hero'))],
    ['welcome.features', () => leafPaths(subtree(en, 'welcome', 'features'))],
    ['imprint', () => leafPaths(subtree(en, 'imprint'))],
  ];

  for (const [name, enPaths] of branches) {
    describe(name, () => {
      const expected = enPaths();
      for (const [code, locale] of Object.entries(LOCALES)) {
        it(`${code} has every ${name} key`, () => {
          const [top, branch] = name.split('.') as ['welcome' | 'imprint', string?];
          const actual = leafPaths(subtree(locale, top, branch));
          expect(actual.sort()).toEqual(expected.sort());
        });
      }
    });
  }
});
