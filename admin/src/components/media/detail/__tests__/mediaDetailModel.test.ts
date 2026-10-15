import { describe, it, expect } from 'vitest';
import type { AiGenerateResponse, Locale, MediaMetadataResponse, SiteLocaleResponse } from '@/types/api';
import {
  findDefaultLocale,
  generatedValueFor,
  hasMetaContent,
  stripMarkdownEmphasis,
  toMetaValuesByLocale,
  translationSourceFor,
} from '../mediaDetailModel';
import { activeSiteLocalesAsLocales } from '@/utils/siteLocales';

const siteLocales = [
  { locale_id: 'en', code: 'en', name: 'English', native_name: 'English', direction: 'Ltr', is_active: true, is_default: false, created_at: 't' },
  { locale_id: 'de', code: 'de', name: 'German', native_name: 'Deutsch', direction: 'Ltr', is_active: true, is_default: true, created_at: 't' },
  { locale_id: 'fr', code: 'fr', name: 'French', native_name: 'Français', direction: 'Ltr', is_active: false, is_default: false, created_at: 't' },
] as SiteLocaleResponse[];

describe('findDefaultLocale', () => {
  it('keeps only active site locales, shaped as Locale', () => {
    const locales = activeSiteLocalesAsLocales(siteLocales);
    expect(locales.map((l) => l.id)).toEqual(['en', 'de']);
    expect(locales[1]).toMatchObject({ code: 'de', native_name: 'Deutsch', site_count: 0 });
  });

  it('picks the site default, else the first locale', () => {
    const locales = activeSiteLocalesAsLocales(siteLocales);
    expect(findDefaultLocale(locales, siteLocales)?.id).toBe('de');
    expect(findDefaultLocale(locales, siteLocales.map((sl) => ({ ...sl, is_default: false })))?.id).toBe('en');
    expect(findDefaultLocale([], siteLocales)).toBeUndefined();
  });
});

describe('toMetaValuesByLocale', () => {
  it('keys drafts by locale and blanks missing fields', () => {
    const metadata = [{ id: 'm1', locale_id: 'en', alt_text: 'A cat', caption: null, title: undefined }] as unknown as MediaMetadataResponse[];
    expect(toMetaValuesByLocale(metadata)).toEqual({ en: { alt_text: 'A cat', caption: '', title: '' } });
  });
});

describe('stripMarkdownEmphasis', () => {
  it('removes bold, italic and underscore emphasis', () => {
    expect(stripMarkdownEmphasis('**Big** *cat* _nap_')).toBe('Big cat nap');
  });
});

describe('hasMetaContent', () => {
  it('needs at least one non-empty field', () => {
    expect(hasMetaContent(undefined)).toBe(false);
    expect(hasMetaContent({ alt_text: '', caption: '', title: '' })).toBe(false);
    expect(hasMetaContent({ alt_text: '', caption: 'c', title: '' })).toBe(true);
  });
});

describe('generatedValueFor', () => {
  it('reads the field-specific response key and strips markdown', () => {
    const result = { alt_text: '**Alt**', subtitle: '*Cap*', title: null } as AiGenerateResponse;
    expect(generatedValueFor('alt_text', result)).toBe('Alt');
    expect(generatedValueFor('caption', result)).toBe('Cap');
    expect(generatedValueFor('title', result)).toBe('');
  });
});

describe('translationSourceFor', () => {
  const de = { id: 'de', code: 'de' } as Locale;
  const drafts = { de: { alt_text: 'x', caption: '', title: '' } };

  it('offers the default locale for other locales once it has a draft', () => {
    expect(translationSourceFor('en', de, drafts)).toBe(de);
  });

  it('never offers translating into the default locale itself or from a missing draft', () => {
    expect(translationSourceFor('de', de, drafts)).toBeNull();
    expect(translationSourceFor('en', de, {})).toBeNull();
    expect(translationSourceFor('en', undefined, drafts)).toBeNull();
  });
});
