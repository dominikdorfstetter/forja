import { describe, expect, it, vi } from 'vitest';
import { BlogsResource } from '../../resources/blogs.js';
import { ForjaAuthError } from '../../errors.js';
import type { HttpClient } from '../../http.js';

function createMockHttp(): HttpClient {
  return {
    get: vi.fn(), getOrNull: vi.fn(),
    getText: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  };
}

const siteId = 'site-123';

describe('BlogsResource', () => {
  describe('listPublished', () => {
    it('fetches published blogs with pagination', async () => {
      const http = createMockHttp();
      const response = {
        data: [{ id: '1', slug: 'test' }],
        meta: { page: 1, page_size: 10, total_pages: 1, total_items: 1 },
      };
      vi.mocked(http.get).mockResolvedValue(response);

      const blogs = new BlogsResource(http, siteId);
      const result = await blogs.listPublished({ page: 1, pageSize: 10 });

      expect(http.get).toHaveBeenCalledWith(
        `/sites/${siteId}/blogs/published`,
        { page: '1', page_size: '10' },
      );
      expect(result.data).toEqual([{ id: '1', slug: 'test' }]);
      expect(result.meta.total_items).toBe(1);
    });

    it('includes locale_id when localeId is supplied', async () => {
      const http = createMockHttp();
      vi.mocked(http.get).mockResolvedValue({
        data: [],
        meta: { page: 1, page_size: 10, total_pages: 0, total_items: 0 },
      });

      const blogs = new BlogsResource(http, siteId);
      await blogs.listPublished({ page: 1, localeId: 'de' });

      expect(http.get).toHaveBeenCalledWith(
        `/sites/${siteId}/blogs/published`,
        expect.objectContaining({ locale_id: 'de' }),
      );
    });

    it('defaults to page 1', async () => {
      const http = createMockHttp();
      vi.mocked(http.get).mockResolvedValue({
        data: [],
        meta: { page: 1, page_size: 10, total_pages: 0, total_items: 0 },
      });

      const blogs = new BlogsResource(http, siteId);
      await blogs.listPublished();

      expect(http.get).toHaveBeenCalledWith(
        `/sites/${siteId}/blogs/published`,
        { page: '1' },
      );
    });
  });

  describe('listByCategory', () => {
    it('fetches blogs by category slug', async () => {
      const http = createMockHttp();
      vi.mocked(http.get).mockResolvedValue({
        data: [{ id: '1' }],
        meta: { page: 1, page_size: 10, total_pages: 1, total_items: 1 },
      });

      const blogs = new BlogsResource(http, siteId);
      await blogs.listByCategory('tech', { page: 1 });

      expect(http.get).toHaveBeenCalledWith(
        `/sites/${siteId}/blogs/published/category/tech`,
        { page: '1' },
      );
    });

    it('includes locale_id in category listings when supplied', async () => {
      const http = createMockHttp();
      vi.mocked(http.get).mockResolvedValue({
        data: [],
        meta: { page: 1, page_size: 10, total_pages: 0, total_items: 0 },
      });
      const blogs = new BlogsResource(http, siteId);
      await blogs.listByCategory('tech', { localeId: 'de' });
      expect(http.get).toHaveBeenCalledWith(
        `/sites/${siteId}/blogs/published/category/tech`,
        expect.objectContaining({ locale_id: 'de' }),
      );
    });

    it('encodes special characters in category slug', async () => {
      const http = createMockHttp();
      vi.mocked(http.get).mockResolvedValue({
        data: [],
        meta: { page: 1, page_size: 10, total_pages: 0, total_items: 0 },
      });

      const blogs = new BlogsResource(http, siteId);
      await blogs.listByCategory('c++/sharp');

      expect(http.get).toHaveBeenCalledWith(
        expect.stringContaining('c%2B%2B%2Fsharp'),
        expect.any(Object),
      );
    });
  });

  describe('listFeatured', () => {
    it('fetches featured blogs with optional limit', async () => {
      const http = createMockHttp();
      vi.mocked(http.get).mockResolvedValue([{ id: '1', is_featured: true }]);

      const blogs = new BlogsResource(http, siteId);
      await blogs.listFeatured({ limit: 3 });

      expect(http.get).toHaveBeenCalledWith(
        `/sites/${siteId}/blogs/featured`,
        { limit: '3' },
      );
    });

    it('omits limit param when not provided', async () => {
      const http = createMockHttp();
      vi.mocked(http.get).mockResolvedValue([]);

      const blogs = new BlogsResource(http, siteId);
      await blogs.listFeatured();

      expect(http.get).toHaveBeenCalledWith(
        `/sites/${siteId}/blogs/featured`,
        undefined,
      );
    });
  });

  describe('listSimilar', () => {
    it('fetches similar blogs', async () => {
      const http = createMockHttp();
      vi.mocked(http.get).mockResolvedValue([{ id: '2' }]);

      const blogs = new BlogsResource(http, siteId);
      await blogs.listSimilar('blog-1', { limit: 5 });

      expect(http.get).toHaveBeenCalledWith(
        `/sites/${siteId}/blogs/blog-1/similar`,
        { limit: '5' },
      );
    });

    it('omits the limit query param when no opts are passed', async () => {
      const http = createMockHttp();
      vi.mocked(http.get).mockResolvedValue([]);
      const blogs = new BlogsResource(http, siteId);
      await blogs.listSimilar('blog-1');
      expect(http.get).toHaveBeenCalledWith(
        `/sites/${siteId}/blogs/blog-1/similar`,
        undefined,
      );
    });
  });

  describe('getBySlug', () => {
    it('does slug lookup then detail fetch', async () => {
      const http = createMockHttp();
      const brief = { id: 'blog-42' };
      const detail = { id: 'blog-42', slug: 'my-post', localizations: [] };
      vi.mocked(http.getOrNull)
        .mockResolvedValueOnce(brief)
        .mockResolvedValueOnce(detail);

      const blogs = new BlogsResource(http, siteId);
      const result = await blogs.getBySlug('my-post');

      expect(http.getOrNull).toHaveBeenCalledTimes(2);
      expect(http.getOrNull).toHaveBeenNthCalledWith(
        1,
        `/sites/${siteId}/blogs/by-slug/my-post`,
      );
      expect(http.getOrNull).toHaveBeenNthCalledWith(
        2,
        '/blogs/blog-42/detail',
        { locale: undefined },
      );
      expect(result).toEqual(detail);
    });

    it('returns null on 404', async () => {
      const http = createMockHttp();
      vi.mocked(http.getOrNull).mockResolvedValue(null);

      const blogs = new BlogsResource(http, siteId);
      expect(await blogs.getBySlug('nonexistent')).toBeNull();
    });

    it('rethrows non-404 errors', async () => {
      const http = createMockHttp();
      vi.mocked(http.getOrNull).mockRejectedValue(new ForjaAuthError());

      const blogs = new BlogsResource(http, siteId);
      await expect(blogs.getBySlug('test')).rejects.toThrow(ForjaAuthError);
    });
  });

  describe('get', () => {
    it('returns blog detail by id or slug', async () => {
      const http = createMockHttp();
      const blog = { id: '1', slug: 'test', localizations: [] };
      vi.mocked(http.getOrNull).mockResolvedValue(blog);

      const blogs = new BlogsResource(http, siteId);
      const result = await blogs.get('test');

      expect(http.getOrNull).toHaveBeenCalledWith('/blogs/test/detail', {
        locale: undefined,
      });
      expect(result).toEqual(blog);
    });

    it('returns null on 404', async () => {
      const http = createMockHttp();
      vi.mocked(http.getOrNull).mockResolvedValue(null);

      const blogs = new BlogsResource(http, siteId);
      expect(await blogs.get('nonexistent')).toBeNull();
    });

    it('rethrows non-404 errors', async () => {
      const http = createMockHttp();
      vi.mocked(http.getOrNull).mockRejectedValue(new ForjaAuthError());

      const blogs = new BlogsResource(http, siteId);
      await expect(blogs.get('test')).rejects.toThrow(ForjaAuthError);
    });
  });

  describe('rss', () => {
    it('fetches RSS feed', async () => {
      const http = createMockHttp();
      vi.mocked(http.getText).mockResolvedValue('<rss>...</rss>');

      const blogs = new BlogsResource(http, siteId);
      await blogs.rss();

      expect(http.getText).toHaveBeenCalledWith(`/sites/${siteId}/feed.rss`);
    });
  });

  // Issue #757 — ?locale= resolver, ADR 0002.
  describe('locale resolver', () => {
    it('forwards locale on get()', async () => {
      const http = createMockHttp();
      vi.mocked(http.getOrNull).mockResolvedValue({ id: 'b1', localizations: [] });

      const blogs = new BlogsResource(http, siteId);
      await blogs.get('b1', { locale: 'en' });

      expect(http.getOrNull).toHaveBeenCalledWith('/blogs/b1/detail', {
        locale: 'en',
      });
    });

    it('forwards locale on getBySlug() second hop', async () => {
      const http = createMockHttp();
      vi.mocked(http.getOrNull)
        .mockResolvedValueOnce({ id: 'b1' })
        .mockResolvedValueOnce({ id: 'b1', localizations: [] });

      const blogs = new BlogsResource(http, siteId);
      await blogs.getBySlug('my-post', { locale: 'en' });

      expect(http.getOrNull).toHaveBeenNthCalledWith(
        2,
        '/blogs/b1/detail',
        { locale: 'en' },
      );
    });
  });
});
