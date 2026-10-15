import { describe, it, expect } from 'vitest';
import { buildLegalRouteMap, buildPageRouteMap } from '@/pages/navigationLookups';

describe('buildPageRouteMap', () => {
  it('maps page ids to routes', () => {
    expect(buildPageRouteMap([{ id: 'p1', route: '/about' }]).get('p1')).toBe('/about');
    expect(buildPageRouteMap(undefined).size).toBe(0);
  });
});

describe('buildLegalRouteMap', () => {
  it('routes by slug, falling back to the cookie name', () => {
    const map = buildLegalRouteMap([
      { id: 'l1', slug: 'imprint', cookie_name: 'imprint_cookie' },
      { id: 'l2', slug: null, cookie_name: 'privacy' },
    ]);
    expect(map.get('l1')).toBe('/legal/imprint');
    expect(map.get('l2')).toBe('/legal/privacy');
  });

  it('skips documents with neither slug nor cookie name', () => {
    expect(buildLegalRouteMap([{ id: 'l3', slug: '', cookie_name: '' }]).has('l3')).toBe(false);
  });
});
