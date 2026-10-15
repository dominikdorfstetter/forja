import { describe, it, expect } from 'vitest';
import { resolveSeoPreview, seoPlaceholders, type SeoPreviewInput } from '../pageSeoPreview';

const base: SeoPreviewInput = {
  isDefaultLocale: true,
  localeValues: {},
  localization: undefined,
  form: { meta_title: '', meta_description: '', excerpt: '' },
  pageRoute: '/form-route',
  route: '/route',
};

describe('resolveSeoPreview', () => {
  it('uses the form values on the default locale, falling back to the route and excerpt', () => {
    expect(resolveSeoPreview(base)).toEqual({ title: '/form-route', description: '' });
    expect(resolveSeoPreview({ ...base, pageRoute: '' })).toEqual({ title: '/route', description: '' });
    expect(resolveSeoPreview({ ...base, form: { meta_title: 'T', meta_description: '', excerpt: 'E' } }))
      .toEqual({ title: 'T', description: 'E' });
  });

  it('ignores locale values on the default locale', () => {
    expect(resolveSeoPreview({ ...base, localeValues: { meta_title: 'L' } }).title).toBe('/form-route');
  });

  it('prefers live edits, then the persisted localization, then the default locale on other locales', () => {
    const other: SeoPreviewInput = {
      ...base,
      isDefaultLocale: false,
      form: { meta_title: 'Default title', meta_description: 'Default desc', excerpt: 'Default excerpt' },
    };
    expect(resolveSeoPreview(other)).toEqual({ title: 'Default title', description: 'Default desc' });
    expect(resolveSeoPreview({ ...other, localization: { meta_title: 'Saved', meta_description: null } }))
      .toEqual({ title: 'Saved', description: 'Default desc' });
    expect(resolveSeoPreview({
      ...other,
      localeValues: { meta_title: 'Live', meta_description: 'Live desc' },
      localization: { meta_title: 'Saved', meta_description: 'Saved desc' },
    })).toEqual({ title: 'Live', description: 'Live desc' });
  });
});

describe('seoPlaceholders', () => {
  it('mirrors the form values', () => {
    expect(seoPlaceholders({ meta_title: 'T', meta_description: 'D', excerpt: 'E' }))
      .toEqual({ meta_title: 'T', meta_description: 'D', excerpt: 'E' });
  });
});
