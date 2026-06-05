import { describe, expect, it, vi } from 'vitest';
import { PagesResource } from '../../resources/pages.js';
import { ForjaAuthError } from '../../errors.js';
import type { HttpClient } from '../../http.js';

function createMockHttp(): HttpClient {
  return { get: vi.fn(), getOrNull: vi.fn(),
    getText: vi.fn(), post: vi.fn(), delete: vi.fn() };
}

const siteId = 'site-123';

describe('PagesResource', () => {
  describe('list', () => {
    it('fetches paginated pages', async () => {
      const http = createMockHttp();
      vi.mocked(http.get).mockResolvedValue({
        data: [{ id: 'p1', route: '/about' }],
        meta: { page: 1, page_size: 10, total_pages: 1, total_items: 1 },
      });

      const pages = new PagesResource(http, siteId);
      const result = await pages.list({ page: 1, pageSize: 10 });

      expect(http.get).toHaveBeenCalledWith(`/sites/${siteId}/pages`, {
        page: '1',
        page_size: '10',
      });
      expect(result.data).toHaveLength(1);
    });

    it('fetches pages without params', async () => {
      const http = createMockHttp();
      vi.mocked(http.get).mockResolvedValue({
        data: [],
        meta: { page: 1, page_size: 10, total_pages: 0, total_items: 0 },
      });

      const pages = new PagesResource(http, siteId);
      await pages.list();

      expect(http.get).toHaveBeenCalledWith(`/sites/${siteId}/pages`, {
        page: '1',
      });
    });
  });

  describe('getByRoute', () => {
    it('fetches page by route', async () => {
      const http = createMockHttp();
      const page = { id: '1', route: '/about', localizations: [] };
      vi.mocked(http.getOrNull).mockResolvedValue(page);

      const pages = new PagesResource(http, siteId);
      const result = await pages.getByRoute('/about');

      expect(http.getOrNull).toHaveBeenCalledWith(
        `/sites/${siteId}/pages/by-route/about`,
      );
      expect(result).toEqual(page);
    });

    it('strips leading slash from route', async () => {
      const http = createMockHttp();
      vi.mocked(http.getOrNull).mockResolvedValue({ id: '1' });

      const pages = new PagesResource(http, siteId);
      await pages.getByRoute('/contact');

      expect(http.getOrNull).toHaveBeenCalledWith(
        `/sites/${siteId}/pages/by-route/contact`,
      );
    });

    it('handles route without leading slash', async () => {
      const http = createMockHttp();
      vi.mocked(http.getOrNull).mockResolvedValue({ id: '1' });

      const pages = new PagesResource(http, siteId);
      await pages.getByRoute('about');

      expect(http.getOrNull).toHaveBeenCalledWith(
        `/sites/${siteId}/pages/by-route/about`,
      );
    });

    it('returns null on 404', async () => {
      const http = createMockHttp();
      vi.mocked(http.getOrNull).mockResolvedValue(null);

      const pages = new PagesResource(http, siteId);
      expect(await pages.getByRoute('/missing')).toBeNull();
    });

    it('rethrows non-404 errors', async () => {
      const http = createMockHttp();
      vi.mocked(http.getOrNull).mockRejectedValue(new ForjaAuthError());

      const pages = new PagesResource(http, siteId);
      await expect(pages.getByRoute('/test')).rejects.toThrow(ForjaAuthError);
    });
  });

  describe('getSections', () => {
    it('fetches page sections', async () => {
      const http = createMockHttp();
      vi.mocked(http.get).mockResolvedValue([{ id: 's1', section_type: 'Hero' }]);

      const pages = new PagesResource(http, siteId);
      const result = await pages.getSections('page-1');

      expect(http.get).toHaveBeenCalledWith('/pages/page-1/sections');
      expect(result).toHaveLength(1);
    });
  });

  describe('getSectionLocalizations', () => {
    it('fetches section localizations', async () => {
      const http = createMockHttp();
      vi.mocked(http.get).mockResolvedValue([{ id: 'l1', title: 'Hello' }]);

      const pages = new PagesResource(http, siteId);
      await pages.getSectionLocalizations('section-1');

      expect(http.get).toHaveBeenCalledWith(
        '/pages/sections/section-1/localizations',
      );
    });
  });

  describe('getPageSectionLocalizations', () => {
    it('fetches all localizations for all sections of a page', async () => {
      const http = createMockHttp();
      vi.mocked(http.get).mockResolvedValue([]);

      const pages = new PagesResource(http, siteId);
      await pages.getPageSectionLocalizations('page-1');

      expect(http.get).toHaveBeenCalledWith(
        '/pages/page-1/sections/localizations',
      );
    });
  });

  // Issue #756 — ?locale= resolver, ADR 0002. The detail endpoint
  // (`/pages/{id}/detail`) gets a new SDK wrapper; list shape is
  // unchanged because PageResponse doesn't carry localizations[].
  describe('getDetail', () => {
    it('fetches page detail by id', async () => {
      const http = createMockHttp();
      vi.mocked(http.getOrNull).mockResolvedValue({
        id: 'p1',
        localizations: [],
        og_image_url: null,
      });

      const pages = new PagesResource(http, siteId);
      const result = await pages.getDetail('p1');

      expect(http.getOrNull).toHaveBeenCalledWith('/pages/p1/detail', {
        locale: undefined,
      });
      expect(result?.id).toBe('p1');
    });

    it('forwards locale when set', async () => {
      const http = createMockHttp();
      vi.mocked(http.getOrNull).mockResolvedValue({
        id: 'p1',
        localizations: [],
        og_image_url: null,
      });

      const pages = new PagesResource(http, siteId);
      await pages.getDetail('p1', { locale: 'en' });

      expect(http.getOrNull).toHaveBeenCalledWith('/pages/p1/detail', {
        locale: 'en',
      });
    });

    it('returns null on 404', async () => {
      const http = createMockHttp();
      vi.mocked(http.getOrNull).mockResolvedValue(null);

      const pages = new PagesResource(http, siteId);
      expect(await pages.getDetail('missing')).toBeNull();
    });

    it('rethrows non-404 errors', async () => {
      const http = createMockHttp();
      vi.mocked(http.getOrNull).mockRejectedValue(new ForjaAuthError());

      const pages = new PagesResource(http, siteId);
      await expect(pages.getDetail('p1')).rejects.toThrow(ForjaAuthError);
    });
  });
});
