import { describe, it, expect } from 'vitest';
import type { Locale, NavigationItem } from '@/types/api';
import {
  buildNavigationItemRequest,
  buildParentOptions,
  canAdvanceWizardStep,
  getAvailableLinkTypes,
  getInitialItemOptions,
  getInitialLinkTarget,
  isLinkTargetValid,
  titlesFromLocalizations,
  type LinkTargetFields,
} from '../navigationItemWizardModel';

const navItem = (overrides: Partial<NavigationItem> = {}): NavigationItem => ({
  id: 'nav-1',
  menu_id: 'menu-1',
  display_order: 0,
  open_in_new_tab: false,
  ...overrides,
});

const target = (overrides: Partial<LinkTargetFields> = {}): LinkTargetFields => ({
  linkType: 'page',
  pageId: '',
  blogSlug: '',
  legalDocumentId: '',
  externalUrl: '',
  ...overrides,
});

const locale = (id: string, code: string): Locale => ({
  id,
  code,
  name: code,
  native_name: code,
  direction: 'Ltr',
  is_active: true,
  created_at: '2025-01-01T00:00:00Z',
  site_count: 1,
});

describe('getAvailableLinkTypes', () => {
  it('offers module-backed types in order and always external', () => {
    expect(getAvailableLinkTypes({ pages: true, blog: true, portfolio: true, legal: true }))
      .toEqual(['page', 'blog', 'cv', 'legal', 'external']);
    expect(getAvailableLinkTypes({ pages: false, blog: true, portfolio: false, legal: false }))
      .toEqual(['blog', 'external']);
  });
});

describe('getInitialLinkTarget', () => {
  it('starts blank on the fallback type when creating', () => {
    expect(getInitialLinkTarget(null, 'blog')).toEqual(target({ linkType: 'blog' }));
  });

  it('decodes blog and cv links stored as external URLs', () => {
    expect(getInitialLinkTarget(navItem({ external_url: '/blog/hello' }), 'page'))
      .toEqual(target({ linkType: 'blog', blogSlug: 'hello' }));
    expect(getInitialLinkTarget(navItem({ external_url: '/cv' }), 'page'))
      .toEqual(target({ linkType: 'cv' }));
  });

  it('prefers legal over page and keeps real external URLs', () => {
    expect(getInitialLinkTarget(navItem({ legal_document_id: 'l1', page_id: 'p1' }), 'page').linkType).toBe('legal');
    expect(getInitialLinkTarget(navItem({ external_url: 'https://x.test' }), 'page'))
      .toEqual(target({ linkType: 'external', externalUrl: 'https://x.test' }));
  });

  it('falls back for a broken item so the user can pick a new target', () => {
    expect(getInitialLinkTarget(navItem(), 'legal').linkType).toBe('legal');
  });
});

describe('getInitialItemOptions', () => {
  it('blanks options for create and copies them for edit', () => {
    expect(getInitialItemOptions(null)).toEqual({ parentId: '', icon: '', openInNewTab: false });
    expect(getInitialItemOptions(navItem({ parent_id: 'p', icon: 'home', open_in_new_tab: true })))
      .toEqual({ parentId: 'p', icon: 'home', openInNewTab: true });
  });
});

describe('isLinkTargetValid / canAdvanceWizardStep', () => {
  it('requires the field matching the link type', () => {
    expect(isLinkTargetValid(target({ linkType: 'page' }))).toBe(false);
    expect(isLinkTargetValid(target({ linkType: 'page', pageId: 'p1' }))).toBe(true);
    expect(isLinkTargetValid(target({ linkType: 'cv' }))).toBe(true);
    expect(isLinkTargetValid(target({ linkType: 'external', externalUrl: 'not a url' }))).toBe(false);
    expect(isLinkTargetValid(target({ linkType: 'external', externalUrl: 'https://x.test' }))).toBe(true);
  });

  it('gates step 2 on at least one title unless the site has no locales', () => {
    expect(canAdvanceWizardStep(1, target(), 2, { en: '  ' })).toBe(false);
    expect(canAdvanceWizardStep(1, target(), 2, { en: 'Home' })).toBe(true);
    expect(canAdvanceWizardStep(1, target(), 0, {})).toBe(true);
    expect(canAdvanceWizardStep(2, target(), 2, {})).toBe(true);
  });
});

describe('buildParentOptions', () => {
  const items = [
    navItem({ id: 'a', title: 'A' }),
    navItem({ id: 'b', title: 'B', parent_id: 'a' }),
    navItem({ id: 'c', title: 'C', parent_id: 'b' }),
    navItem({ id: 'd', title: 'D' }),
  ];

  it('indents by depth and drops items too deep to take children', () => {
    expect(buildParentOptions(items, null, 3)).toEqual([
      { value: 'a', label: 'A', depth: 0 },
      { value: 'b', label: '  B', depth: 1 },
      { value: 'd', label: 'D', depth: 0 },
    ]);
  });

  it("excludes the edited item's own subtree", () => {
    expect(buildParentOptions(items, items[0], 3).map((o) => o.value)).toEqual(['d']);
  });
});

describe('buildNavigationItemRequest', () => {
  const locales = [locale('en', 'en'), locale('de', 'de')];
  const base = {
    options: { parentId: '', icon: '', openInNewTab: false },
    locales,
    siteId: 'site-1',
    menuId: 'menu-1',
    displayOrder: 4,
  };

  it('sends only the selected target and trimmed non-empty titles', () => {
    expect(buildNavigationItemRequest({
      ...base,
      target: target({ linkType: 'blog', blogSlug: 'hello', pageId: 'stale' }),
      titles: { en: ' Home ', de: '  ' },
    })).toEqual({
      page_id: undefined,
      external_url: '/blog/hello',
      legal_document_id: undefined,
      icon: undefined,
      display_order: 4,
      open_in_new_tab: false,
      parent_id: undefined,
      site_id: 'site-1',
      menu_id: 'menu-1',
      localizations: [{ locale_id: 'en', title: 'Home' }],
    });
  });

  it('maps cv to /cv and omits empty localizations', () => {
    const request = buildNavigationItemRequest({ ...base, target: target({ linkType: 'cv' }), titles: {} });
    expect(request.external_url).toBe('/cv');
    expect(request.localizations).toBeUndefined();
  });
});

describe('titlesFromLocalizations', () => {
  it('keys titles by locale id', () => {
    expect(titlesFromLocalizations([{ locale_id: 'en', title: 'Home' }])).toEqual({ en: 'Home' });
  });
});
