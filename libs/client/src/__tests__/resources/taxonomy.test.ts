import { describe, expect, it, vi } from 'vitest';
import { TaxonomyResource } from '../../resources/taxonomy.js';
import type { HttpClient } from '../../http.js';

function createMockHttp(): HttpClient {
  return { get: vi.fn(), getOrNull: vi.fn(),
    getText: vi.fn(), post: vi.fn(), delete: vi.fn() };
}

const siteId = 'site-123';

describe('TaxonomyResource', () => {
  describe('listTags', () => {
    it('fetches paginated tags', async () => {
      const http = createMockHttp();
      vi.mocked(http.get).mockResolvedValue({
        data: [{ id: 't1', slug: 'rust' }],
        meta: { page: 1, page_size: 10, total_pages: 1, total_items: 1 },
      });

      const taxonomy = new TaxonomyResource(http, siteId);
      const result = await taxonomy.listTags({ page: 1 });

      expect(http.get).toHaveBeenCalledWith(`/sites/${siteId}/tags`, {
        page: '1',
      });
      expect(result.data).toHaveLength(1);
    });

    it('fetches tags without params', async () => {
      const http = createMockHttp();
      vi.mocked(http.get).mockResolvedValue({
        data: [],
        meta: { page: 1, page_size: 10, total_pages: 0, total_items: 0 },
      });

      const taxonomy = new TaxonomyResource(http, siteId);
      await taxonomy.listTags();

      expect(http.get).toHaveBeenCalledWith(`/sites/${siteId}/tags`, {
        page: '1',
      });
    });

    it('converts search params to snake_case', async () => {
      const http = createMockHttp();
      vi.mocked(http.get).mockResolvedValue({
        data: [],
        meta: { page: 1, page_size: 10, total_pages: 0, total_items: 0 },
      });

      const taxonomy = new TaxonomyResource(http, siteId);
      await taxonomy.listTags({ sortBy: 'slug', sortDir: 'asc' });

      expect(http.get).toHaveBeenCalledWith(
        `/sites/${siteId}/tags`,
        expect.objectContaining({
          sort_by: 'slug',
          sort_dir: 'asc',
        }),
      );
    });
  });

  describe('listCategories', () => {
    it('fetches paginated categories', async () => {
      const http = createMockHttp();
      vi.mocked(http.get).mockResolvedValue({
        data: [{ id: 'c1', slug: 'tech' }],
        meta: { page: 1, page_size: 10, total_pages: 1, total_items: 1 },
      });

      const taxonomy = new TaxonomyResource(http, siteId);
      const result = await taxonomy.listCategories({ page: 1 });

      expect(http.get).toHaveBeenCalledWith(
        `/sites/${siteId}/categories`,
        { page: '1' },
      );
      expect(result.data).toHaveLength(1);
    });

    it('fetches categories without params', async () => {
      const http = createMockHttp();
      vi.mocked(http.get).mockResolvedValue({
        data: [],
        meta: { page: 1, page_size: 10, total_pages: 0, total_items: 0 },
      });

      const taxonomy = new TaxonomyResource(http, siteId);
      await taxonomy.listCategories();

      expect(http.get).toHaveBeenCalledWith(`/sites/${siteId}/categories`, {
        page: '1',
      });
    });
  });

  describe('getCategoriesWithBlogCounts', () => {
    it('fetches category blog counts', async () => {
      const http = createMockHttp();
      vi.mocked(http.get).mockResolvedValue([
        { id: 'c1', slug: 'tech', blog_count: 5 },
      ]);

      const taxonomy = new TaxonomyResource(http, siteId);
      const result = await taxonomy.getCategoriesWithBlogCounts();

      expect(http.get).toHaveBeenCalledWith(
        `/sites/${siteId}/categories/blog-counts`,
      );
      expect(result[0].blog_count).toBe(5);
    });
  });

  describe('getContentTags', () => {
    it('fetches tags for a content item', async () => {
      const http = createMockHttp();
      vi.mocked(http.get).mockResolvedValue([{ id: 't1' }]);

      const taxonomy = new TaxonomyResource(http, siteId);
      await taxonomy.getContentTags('content-1');

      expect(http.get).toHaveBeenCalledWith('/content/content-1/tags');
    });
  });

  describe('getContentCategories', () => {
    it('fetches categories for a content item', async () => {
      const http = createMockHttp();
      vi.mocked(http.get).mockResolvedValue([{ id: 'c1' }]);

      const taxonomy = new TaxonomyResource(http, siteId);
      await taxonomy.getContentCategories('content-1');

      expect(http.get).toHaveBeenCalledWith('/content/content-1/categories');
    });
  });

  describe('getTag', () => {
    it('returns tag by ID', async () => {
      const http = createMockHttp();
      vi.mocked(http.getOrNull).mockResolvedValue({ id: 't1', slug: 'rust' });

      const taxonomy = new TaxonomyResource(http, siteId);
      const result = await taxonomy.getTag('t1');

      expect(http.getOrNull).toHaveBeenCalledWith('/tags/t1');
      expect(result?.slug).toBe('rust');
    });

    it('returns null for not found', async () => {
      const http = createMockHttp();
      vi.mocked(http.getOrNull).mockResolvedValue(null);

      const taxonomy = new TaxonomyResource(http, siteId);
      expect(await taxonomy.getTag('missing')).toBeNull();
    });

    it('propagates non-404 errors', async () => {
      const http = createMockHttp();
      const { ForjaAuthError } = await import('../../errors.js');
      vi.mocked(http.getOrNull).mockRejectedValue(new ForjaAuthError('No API key'));
      const taxonomy = new TaxonomyResource(http, siteId);
      await expect(taxonomy.getTag('whatever')).rejects.toThrow(ForjaAuthError);
    });
  });

  describe('getTagBySlug', () => {
    it('returns tag by slug', async () => {
      const http = createMockHttp();
      vi.mocked(http.getOrNull).mockResolvedValue({ id: 't1', slug: 'typescript' });

      const taxonomy = new TaxonomyResource(http, siteId);
      const result = await taxonomy.getTagBySlug('typescript');

      expect(http.getOrNull).toHaveBeenCalledWith('/tags/by-slug/typescript');
      expect(result?.slug).toBe('typescript');
    });

    it('returns null when the tag does not exist', async () => {
      const http = createMockHttp();
      vi.mocked(http.getOrNull).mockResolvedValue(null);
      const taxonomy = new TaxonomyResource(http, siteId);
      expect(await taxonomy.getTagBySlug('missing')).toBeNull();
    });

    it('propagates non-404 errors', async () => {
      const http = createMockHttp();
      const { ForjaAuthError } = await import('../../errors.js');
      vi.mocked(http.getOrNull).mockRejectedValue(new ForjaAuthError('No API key'));
      const taxonomy = new TaxonomyResource(http, siteId);
      await expect(taxonomy.getTagBySlug('whatever')).rejects.toThrow(ForjaAuthError);
    });
  });

  describe('getCategory', () => {
    it('returns category by ID', async () => {
      const http = createMockHttp();
      vi.mocked(http.getOrNull).mockResolvedValue({ id: 'c1', slug: 'tech' });

      const taxonomy = new TaxonomyResource(http, siteId);
      const result = await taxonomy.getCategory('c1');

      expect(http.getOrNull).toHaveBeenCalledWith('/categories/c1');
      expect(result?.slug).toBe('tech');
    });

    it('returns null when the category does not exist', async () => {
      const http = createMockHttp();
      vi.mocked(http.getOrNull).mockResolvedValue(null);
      const taxonomy = new TaxonomyResource(http, siteId);
      expect(await taxonomy.getCategory('missing')).toBeNull();
    });

    it('propagates non-404 errors', async () => {
      const http = createMockHttp();
      const { ForjaAuthError } = await import('../../errors.js');
      vi.mocked(http.getOrNull).mockRejectedValue(new ForjaAuthError('No API key'));
      const taxonomy = new TaxonomyResource(http, siteId);
      await expect(taxonomy.getCategory('whatever')).rejects.toThrow(ForjaAuthError);
    });
  });

  describe('getCategoryChildren', () => {
    it('returns child categories', async () => {
      const http = createMockHttp();
      vi.mocked(http.get).mockResolvedValue([
        { id: 'c2', slug: 'frontend' },
        { id: 'c3', slug: 'backend' },
      ]);

      const taxonomy = new TaxonomyResource(http, siteId);
      const result = await taxonomy.getCategoryChildren('c1');

      expect(http.get).toHaveBeenCalledWith('/categories/c1/children');
      expect(result).toHaveLength(2);
    });
  });
});
