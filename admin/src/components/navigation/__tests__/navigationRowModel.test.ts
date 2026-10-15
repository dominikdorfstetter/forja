import { describe, it, expect } from 'vitest';
import type { NavigationItem } from '@/types/api';
import {
  getNavigationItemDisplayTitle,
  getNavigationItemLinkTarget,
  getNavigationLinkKind,
} from '../navigationRowModel';

const navItem = (overrides: Partial<NavigationItem> = {}): NavigationItem => ({
  id: 'nav-1',
  menu_id: 'menu-1',
  display_order: 0,
  open_in_new_tab: false,
  ...overrides,
});

const pageRoutes = new Map([['page-1', '/about']]);
const legalRoutes = new Map([['legal-1', '/legal/imprint']]);

describe('getNavigationLinkKind', () => {
  it('flags an item without any target as broken', () => {
    expect(getNavigationLinkKind(navItem())).toBe('broken');
  });

  it('classifies page, legal, cv, blog and external targets in precedence order', () => {
    expect(getNavigationLinkKind(navItem({ page_id: 'page-1', external_url: '/cv' }))).toBe('internal');
    expect(getNavigationLinkKind(navItem({ legal_document_id: 'legal-1', external_url: '/cv' }))).toBe('legal');
    expect(getNavigationLinkKind(navItem({ external_url: '/cv' }))).toBe('cv');
    expect(getNavigationLinkKind(navItem({ external_url: '/blog/hello' }))).toBe('blog');
    expect(getNavigationLinkKind(navItem({ external_url: 'https://example.com' }))).toBe('external');
  });
});

describe('getNavigationItemDisplayTitle', () => {
  it('prefers the explicit title', () => {
    expect(getNavigationItemDisplayTitle(navItem({ title: 'Home', page_id: 'page-1' }), pageRoutes, legalRoutes)).toBe('Home');
  });

  it('falls back to page route, external URL, then legal route', () => {
    expect(getNavigationItemDisplayTitle(navItem({ page_id: 'page-1' }), pageRoutes, legalRoutes)).toBe('/about');
    expect(getNavigationItemDisplayTitle(navItem({ external_url: 'https://x.test' }), pageRoutes, legalRoutes)).toBe('https://x.test');
    expect(getNavigationItemDisplayTitle(navItem({ legal_document_id: 'legal-1' }), pageRoutes, legalRoutes)).toBe('/legal/imprint');
  });

  it('renders an em dash when nothing resolves', () => {
    expect(getNavigationItemDisplayTitle(navItem({ page_id: 'unknown' }), pageRoutes, legalRoutes)).toBe('—');
  });
});

describe('getNavigationItemLinkTarget', () => {
  it('resolves page and legal routes, falling back to the raw id', () => {
    expect(getNavigationItemLinkTarget(navItem({ page_id: 'page-1' }), pageRoutes, legalRoutes)).toBe('/about');
    expect(getNavigationItemLinkTarget(navItem({ page_id: 'page-x' }), pageRoutes, legalRoutes)).toBe('page-x');
    expect(getNavigationItemLinkTarget(navItem({ legal_document_id: 'legal-1' }), pageRoutes, legalRoutes)).toBe('/legal/imprint');
    expect(getNavigationItemLinkTarget(navItem({ legal_document_id: 'legal-x' }), pageRoutes, legalRoutes)).toBe('legal-x');
  });

  it('uses the external URL, else an em dash', () => {
    expect(getNavigationItemLinkTarget(navItem({ external_url: '/cv' }), pageRoutes, legalRoutes)).toBe('/cv');
    expect(getNavigationItemLinkTarget(navItem(), pageRoutes, legalRoutes)).toBe('—');
  });
});
