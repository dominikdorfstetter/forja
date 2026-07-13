import { describe, expect, it, vi } from 'vitest';
import { NavigationResource } from '../../resources/navigation.js';
import { ForjaAuthError } from '../../errors.js';
import type { HttpClient } from '../../http.js';
import type { NavigationMenuResponse } from '../../types.js';

function createMockHttp(): HttpClient {
  return { get: vi.fn(), getOrNull: vi.fn(),
    getText: vi.fn(), post: vi.fn(), delete: vi.fn() };
}

const siteId = 'site-123';

describe('NavigationResource', () => {
  describe('listMenus', () => {
    it('fetches all menus for the site', async () => {
      const http = createMockHttp();
      vi.mocked(http.get).mockResolvedValue([{ id: 'm1', slug: 'primary' }]);

      const nav = new NavigationResource(http, siteId);
      const result = await nav.listMenus();

      expect(http.get).toHaveBeenCalledWith(`/sites/${siteId}/menus`);
      expect(result).toHaveLength(1);
    });
  });

  describe('getMenu', () => {
    it('fetches menu by id', async () => {
      const http = createMockHttp();
      vi.mocked(http.getOrNull).mockResolvedValue({ id: 'm1' });

      const nav = new NavigationResource(http, siteId);
      const result = await nav.getMenu('m1');

      expect(http.getOrNull).toHaveBeenCalledWith('/menus/m1');
      expect(result).toEqual({ id: 'm1' });
    });

    it('returns null on 404', async () => {
      const http = createMockHttp();
      vi.mocked(http.getOrNull).mockResolvedValue(null);

      const nav = new NavigationResource(http, siteId);
      expect(await nav.getMenu('missing')).toBeNull();
    });

    it('rethrows non-404 errors', async () => {
      const http = createMockHttp();
      vi.mocked(http.getOrNull).mockRejectedValue(new ForjaAuthError());

      const nav = new NavigationResource(http, siteId);
      await expect(nav.getMenu('test')).rejects.toThrow(ForjaAuthError);
    });
  });

  describe('getMenuBySlug', () => {
    it('fetches menu by slug', async () => {
      const http = createMockHttp();
      vi.mocked(http.getOrNull).mockResolvedValue({ id: 'm1', slug: 'primary' });

      const nav = new NavigationResource(http, siteId);
      await nav.getMenuBySlug('primary');

      expect(http.getOrNull).toHaveBeenCalledWith(
        `/sites/${siteId}/menus/slug/primary`,
      );
    });

    it('returns null on 404', async () => {
      const http = createMockHttp();
      vi.mocked(http.getOrNull).mockResolvedValue(null);

      const nav = new NavigationResource(http, siteId);
      expect(await nav.getMenuBySlug('missing')).toBeNull();
    });

    it('rethrows non-404 errors', async () => {
      const http = createMockHttp();
      vi.mocked(http.getOrNull).mockRejectedValue(new ForjaAuthError());

      const nav = new NavigationResource(http, siteId);
      await expect(nav.getMenuBySlug('test')).rejects.toThrow(ForjaAuthError);
    });

    // SDK had drifted from the backend DTO — localizations and updated_at
    // were missing even though every menu read endpoint returns them.
    // Pinning the full shape here so future drift fails the type checker.
    it('surfaces every field the backend returns', async () => {
      const http = createMockHttp();
      const full: NavigationMenuResponse = {
        id: 'm1',
        site_id: siteId,
        slug: 'footer',
        description: null,
        max_depth: 3,
        is_active: true,
        item_count: 2,
        created_at: '2026-07-13T10:00:00Z',
        updated_at: '2026-07-13T11:00:00Z',
        localizations: [{ id: 'ml1', locale_id: 'loc-de', name: 'Fußzeile' }],
      };
      vi.mocked(http.getOrNull).mockResolvedValue(full);

      const nav = new NavigationResource(http, siteId);
      const result = await nav.getMenuBySlug('footer');

      expect(result).toEqual(full);
      expect(result?.updated_at).toBe('2026-07-13T11:00:00Z');
      expect(result?.localizations).toEqual([
        { id: 'ml1', locale_id: 'loc-de', name: 'Fußzeile' },
      ]);
    });
  });

  describe('getTree', () => {
    it('fetches navigation tree for a menu', async () => {
      const http = createMockHttp();
      vi.mocked(http.get).mockResolvedValue([{ id: 'n1', children: [] }]);

      const nav = new NavigationResource(http, siteId);
      await nav.getTree('m1');

      expect(http.get).toHaveBeenCalledWith('/menus/m1/tree', undefined);
    });

    it('passes locale parameter', async () => {
      const http = createMockHttp();
      vi.mocked(http.get).mockResolvedValue([]);

      const nav = new NavigationResource(http, siteId);
      await nav.getTree('m1', { locale: 'de' });

      expect(http.get).toHaveBeenCalledWith('/menus/m1/tree', {
        locale: 'de',
      });
    });
  });

  describe('getMenuWithTree', () => {
    const menu: NavigationMenuResponse = {
      id: 'm1',
      site_id: siteId,
      slug: 'footer',
      description: null,
      max_depth: 3,
      is_active: true,
      item_count: 1,
      created_at: '2026-07-13T10:00:00Z',
      updated_at: '2026-07-13T11:00:00Z',
      localizations: [
        { id: 'ml1', locale_id: 'loc-de', name: 'Fußzeile' },
        { id: 'ml2', locale_id: 'loc-en', name: 'Footer links' },
      ],
    };
    const tree = [{ id: 'n1', children: [] }];
    const locales = [
      { locale_id: 'loc-en', code: 'en' },
      { locale_id: 'loc-de', code: 'de' },
    ];
    const localesPath = `/sites/${siteId}/locales`;
    const treePath = '/menus/m1/tree';

    function mockGetByPath(http: HttpClient) {
      vi.mocked(http.get).mockImplementation(async (path) => {
        if (path === localesPath) return locales;
        if (path === treePath) return tree;
        throw new Error(`unexpected GET ${path}`);
      });
    }

    it('composes menu and tree, resolving the name for the locale', async () => {
      const http = createMockHttp();
      vi.mocked(http.getOrNull).mockResolvedValue(menu);
      mockGetByPath(http);

      const nav = new NavigationResource(http, siteId);
      const result = await nav.getMenuWithTree('footer', { locale: 'de' });

      expect(http.getOrNull).toHaveBeenCalledWith(
        `/sites/${siteId}/menus/slug/footer`,
      );
      expect(http.get).toHaveBeenCalledWith(treePath, { locale: 'de' });
      expect(result).toEqual({
        menu: { ...menu, resolvedName: 'Fußzeile' },
        items: tree,
      });
    });

    it('starts the locale lookup concurrently with the menu fetch', async () => {
      const http = createMockHttp();
      let resolveMenu!: (value: NavigationMenuResponse) => void;
      vi.mocked(http.getOrNull).mockReturnValue(
        new Promise((resolve) => {
          resolveMenu = resolve;
        }),
      );
      mockGetByPath(http);

      const nav = new NavigationResource(http, siteId);
      const pending = nav.getMenuWithTree('footer', { locale: 'de' });
      await Promise.resolve();

      // Locales are already in flight while the menu request is unresolved;
      // the tree request waits for the menu id, so it hasn't fired yet.
      expect(http.get).toHaveBeenCalledWith(localesPath);
      expect(http.get).not.toHaveBeenCalledWith(treePath, { locale: 'de' });

      resolveMenu(menu);
      const result = await pending;
      expect(result?.menu.resolvedName).toBe('Fußzeile');
    });

    it('resolves null name when no locale is passed, without fetching locales', async () => {
      const http = createMockHttp();
      vi.mocked(http.getOrNull).mockResolvedValue(menu);
      mockGetByPath(http);

      const nav = new NavigationResource(http, siteId);
      const result = await nav.getMenuWithTree('footer');

      expect(result?.menu.resolvedName).toBeNull();
      expect(http.get).toHaveBeenCalledWith(treePath, undefined);
      expect(http.get).not.toHaveBeenCalledWith(localesPath);
    });

    it('resolves null name for a locale code the site does not configure', async () => {
      const http = createMockHttp();
      vi.mocked(http.getOrNull).mockResolvedValue(menu);
      mockGetByPath(http);

      const nav = new NavigationResource(http, siteId);
      const result = await nav.getMenuWithTree('footer', { locale: 'fr' });

      expect(result?.menu.resolvedName).toBeNull();
    });

    it('resolves null name when the menu has no localization for the locale', async () => {
      const http = createMockHttp();
      vi.mocked(http.getOrNull).mockResolvedValue({
        ...menu,
        localizations: [{ id: 'ml2', locale_id: 'loc-en', name: 'Footer links' }],
      });
      mockGetByPath(http);

      const nav = new NavigationResource(http, siteId);
      const result = await nav.getMenuWithTree('footer', { locale: 'de' });

      expect(result?.menu.resolvedName).toBeNull();
    });

    it('resolves null name when the menu carries no localizations at all', async () => {
      const http = createMockHttp();
      vi.mocked(http.getOrNull).mockResolvedValue({
        ...menu,
        localizations: undefined,
      });
      mockGetByPath(http);

      const nav = new NavigationResource(http, siteId);
      const result = await nav.getMenuWithTree('footer', { locale: 'de' });

      expect(result?.menu.resolvedName).toBeNull();
    });

    it('returns null when the menu does not exist, without fetching the tree', async () => {
      const http = createMockHttp();
      vi.mocked(http.getOrNull).mockResolvedValue(null);
      mockGetByPath(http);

      const nav = new NavigationResource(http, siteId);
      const result = await nav.getMenuWithTree('missing', { locale: 'de' });

      expect(result).toBeNull();
      expect(http.get).toHaveBeenCalledTimes(1);
      expect(http.get).toHaveBeenCalledWith(localesPath);
    });

    it('rethrows non-404 errors from the menu fetch', async () => {
      const http = createMockHttp();
      vi.mocked(http.getOrNull).mockRejectedValue(new ForjaAuthError());
      mockGetByPath(http);

      const nav = new NavigationResource(http, siteId);
      await expect(
        nav.getMenuWithTree('footer', { locale: 'de' }),
      ).rejects.toThrow(ForjaAuthError);
    });

    it('reuses the locales listing across calls on the same instance', async () => {
      const http = createMockHttp();
      vi.mocked(http.getOrNull).mockResolvedValue(menu);
      mockGetByPath(http);

      const nav = new NavigationResource(http, siteId);
      await nav.getMenuWithTree('footer', { locale: 'de' });
      await nav.getMenuWithTree('footer', { locale: 'en' });

      const localesCalls = vi
        .mocked(http.get)
        .mock.calls.filter(([path]) => path === localesPath);
      expect(localesCalls).toHaveLength(1);
    });

    it('does not cache a failed locales listing — the next call retries', async () => {
      const http = createMockHttp();
      vi.mocked(http.getOrNull).mockResolvedValue(menu);
      vi.mocked(http.get)
        .mockRejectedValueOnce(new ForjaAuthError())
        .mockImplementation(async (path) => {
          if (path === localesPath) return locales;
          if (path === treePath) return tree;
          throw new Error(`unexpected GET ${path}`);
        });

      const nav = new NavigationResource(http, siteId);
      await expect(
        nav.getMenuWithTree('footer', { locale: 'de' }),
      ).rejects.toThrow(ForjaAuthError);

      const result = await nav.getMenuWithTree('footer', { locale: 'de' });
      expect(result?.menu.resolvedName).toBe('Fußzeile');
      const localesCalls = vi
        .mocked(http.get)
        .mock.calls.filter(([path]) => path === localesPath);
      expect(localesCalls).toHaveLength(2);
    });
  });

  describe('listItems', () => {
    it('fetches items for a menu', async () => {
      const http = createMockHttp();
      vi.mocked(http.get).mockResolvedValue([{ id: 'i1' }]);

      const nav = new NavigationResource(http, siteId);
      await nav.listItems('m1');

      expect(http.get).toHaveBeenCalledWith('/menus/m1/items');
    });
  });

  describe('getItem', () => {
    it('fetches item by id', async () => {
      const http = createMockHttp();
      vi.mocked(http.getOrNull).mockResolvedValue({ id: 'i1' });

      const nav = new NavigationResource(http, siteId);
      const result = await nav.getItem('i1');

      expect(http.getOrNull).toHaveBeenCalledWith('/navigation/i1');
      expect(result).toEqual({ id: 'i1' });
    });

    it('returns null on 404', async () => {
      const http = createMockHttp();
      vi.mocked(http.getOrNull).mockResolvedValue(null);

      const nav = new NavigationResource(http, siteId);
      expect(await nav.getItem('missing')).toBeNull();
    });

    it('rethrows non-404 errors', async () => {
      const http = createMockHttp();
      vi.mocked(http.getOrNull).mockRejectedValue(new ForjaAuthError());

      const nav = new NavigationResource(http, siteId);
      await expect(nav.getItem('test')).rejects.toThrow(ForjaAuthError);
    });
  });
});
