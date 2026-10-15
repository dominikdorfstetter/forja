import { describe, it, expect } from 'vitest';
import type { SiteLocaleResponse } from '@/types/api';
import { defaultLocaleInfo, draftPostContent, regeneratedValues, regenerateRequest } from '../aiDraftRequests';

describe('defaultLocaleInfo', () => {
  it('uses the default site locale', () => {
    const locales = [
      { code: 'de', name: 'Deutsch', is_default: false },
      { code: 'fr', name: 'Français', is_default: true },
    ] as unknown as SiteLocaleResponse[];
    expect(defaultLocaleInfo(locales)).toEqual({ code: 'fr', name: 'Français' });
  });

  it('falls back to English', () => {
    expect(defaultLocaleInfo(undefined)).toEqual({ code: 'en', name: 'English' });
  });
});

describe('AI draft requests', () => {
  const draft = { title: 'T', subtitle: 'S', outline: [{ id: 0, value: 'a' }, { id: 1, value: 'b' }], body: 'Body' };
  const outlineJson = JSON.stringify({ title: 'T', subtitle: 'S', outline: ['a', 'b'] });

  it('serialises the outline for post generation', () => {
    expect(draftPostContent(draft)).toBe(outlineJson);
  });

  it('regenerates body/all from the outline and excerpt/seo from the body', () => {
    expect(regenerateRequest('all', draft)).toEqual({ action: 'draft_post', content: outlineJson });
    expect(regenerateRequest('body', draft)).toEqual({ action: 'draft_post', content: outlineJson });
    expect(regenerateRequest('excerpt', draft)).toEqual({ action: 'excerpt', content: 'Body' });
    expect(regenerateRequest('seo', draft)).toEqual({ action: 'seo', content: 'Body' });
  });

  it('keeps only the targeted, non-empty response values in field order', () => {
    const result = { body: 'B', excerpt: '', meta_title: 'MT', meta_description: null };
    expect(regeneratedValues('all', result)).toEqual([['body', 'B'], ['meta_title', 'MT']]);
    expect(regeneratedValues('seo', result)).toEqual([['meta_title', 'MT']]);
    expect(regeneratedValues('excerpt', result)).toEqual([]);
  });
});
