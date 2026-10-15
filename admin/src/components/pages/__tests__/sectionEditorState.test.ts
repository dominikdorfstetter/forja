import { describe, it, expect } from 'vitest';
import type { SiteLocaleResponse } from '@/types/api';
import { editorReducer, initialEditorState, localeFormFrom } from '../sectionEditorState';
import { hasTranslatableSource, toEditorLocales } from '../useSectionEditorLocales';

describe('localeFormFrom', () => {
  it('returns empty fields and no items override without a localization', () => {
    expect(localeFormFrom(undefined)).toEqual({ title: '', text: '', buttonText: '', items: null });
  });

  it('maps a persisted localization, keeping its items override', () => {
    expect(localeFormFrom({
      id: 'l', page_section_id: 's', locale_id: 'en',
      title: 'T', text: 'X', button_text: 'B', items: [{ q: 1 }],
    })).toEqual({ title: 'T', text: 'X', buttonText: 'B', items: [{ q: 1 }] });
  });
});

describe('editorReducer', () => {
  it('INIT_SECTION resets the session to the section config', () => {
    const dirty = { ...initialEditorState, activeTab: 2, dirtyVersion: 4, pickerOpen: true };
    expect(editorReducer(dirty, { type: 'INIT_SECTION', coverImageId: 'img', ctaRoute: '/go', settings: { a: 1 } }))
      .toEqual({ ...initialEditorState, coverImageId: 'img', ctaRoute: '/go', settings: { a: 1 } });
  });

  it('updates one locale field and keeps the rest', () => {
    const state = editorReducer(initialEditorState, { type: 'UPDATE_LOCALE_FIELD', field: 'title', value: 'Hi' });
    expect(state.localeForm).toEqual({ title: 'Hi', text: '', buttonText: '', items: null });
  });
});

describe('section editor locales', () => {
  const locale = (code: string, isActive: boolean): SiteLocaleResponse => ({
    site_id: 's', locale_id: `locale-${code}`, is_default: code === 'en', is_active: isActive,
    url_prefix: code, created_at: '2025-01-01T00:00:00Z', code, name: code, native_name: code, direction: 'Ltr',
  });

  it('keeps only active locales, keyed by locale id', () => {
    expect(toEditorLocales([locale('en', true), locale('de', false)]).map((l) => [l.id, l.is_default]))
      .toEqual([['locale-en', true]]);
    expect(toEditorLocales(undefined)).toEqual([]);
  });

  it('detects whether a localization has text to translate', () => {
    expect(hasTranslatableSource(undefined)).toBe(false);
    expect(hasTranslatableSource({ id: 'l', page_section_id: 's', locale_id: 'en' })).toBe(false);
    expect(hasTranslatableSource({ id: 'l', page_section_id: 's', locale_id: 'en', button_text: 'Go' })).toBe(true);
  });
});
