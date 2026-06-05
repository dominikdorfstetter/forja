import { describe, expect, it, vi } from 'vitest';
import { NavigationResource } from '../../resources/navigation.js';
import { ForjaAuthError } from '../../errors.js';
import type { HttpClient } from '../../http.js';

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
