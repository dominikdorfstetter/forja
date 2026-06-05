import { describe, expect, it, vi } from 'vitest';
import { CollectionsResource } from '../../resources/collections.js';
import { ForjaClient } from '../../client.js';
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

describe('CollectionsResource', () => {
  describe('published', () => {
    it('fetches published entries for the type key', async () => {
      const http = createMockHttp();
      vi.mocked(http.get).mockResolvedValue({
        data: [{ slug: 'spaghetti', status: 'published', published_at: null, locale: 'en', data: { title: 'Spaghetti' } }],
        meta: { page: 1, page_size: 20, total_pages: 1, total_items: 1 },
      });

      const recipes = new CollectionsResource(http, siteId, 'recipe');
      const result = await recipes.published({ page: 1, pageSize: 20, locale: 'en' });

      expect(http.get).toHaveBeenCalledWith(
        `/sites/${siteId}/collections/recipe/published`,
        { locale: 'en', page_size: '20', page: '1' },
      );
      expect(result.data[0]?.data.title).toBe('Spaghetti');
      expect(result.meta.total_items).toBe(1);
    });

    it('defaults to page 1', async () => {
      const http = createMockHttp();
      vi.mocked(http.get).mockResolvedValue({
        data: [],
        meta: { page: 1, page_size: 20, total_pages: 0, total_items: 0 },
      });
      await new CollectionsResource(http, siteId, 'recipe').published();
      expect(http.get).toHaveBeenCalledWith(
        `/sites/${siteId}/collections/recipe/published`,
        { page: '1' },
      );
    });
  });

  describe('bySlug', () => {
    it('returns the entry when found', async () => {
      const http = createMockHttp();
      const entry = { slug: 'spaghetti', status: 'published', published_at: null, locale: 'en', data: {} };
      vi.mocked(http.getOrNull).mockResolvedValue(entry);

      const result = await new CollectionsResource(http, siteId, 'recipe').bySlug('spaghetti');

      expect(http.getOrNull).toHaveBeenCalledWith(
        `/sites/${siteId}/collections/recipe/by-slug/spaghetti`,
        { locale: undefined },
      );
      expect(result).toEqual(entry);
    });

    it('passes the locale query when supplied', async () => {
      const http = createMockHttp();
      vi.mocked(http.getOrNull).mockResolvedValue({});
      await new CollectionsResource(http, siteId, 'recipe').bySlug('spaghetti', { locale: 'de' });
      expect(http.getOrNull).toHaveBeenCalledWith(
        `/sites/${siteId}/collections/recipe/by-slug/spaghetti`,
        { locale: 'de' },
      );
    });

    it('returns null on not-found', async () => {
      const http = createMockHttp();
      vi.mocked(http.getOrNull).mockResolvedValue(null);
      const result = await new CollectionsResource(http, siteId, 'recipe').bySlug('ghost');
      expect(result).toBeNull();
    });

    it('rethrows non-not-found errors', async () => {
      const http = createMockHttp();
      vi.mocked(http.getOrNull).mockRejectedValue(new ForjaAuthError('bad key'));
      await expect(
        new CollectionsResource(http, siteId, 'recipe').bySlug('spaghetti'),
      ).rejects.toThrow(ForjaAuthError);
    });
  });

  describe('schema', () => {
    it('returns the public schema when the type is public', async () => {
      const http = createMockHttp();
      const schema = { key: 'recipe', name: 'Recipe', content_kind: 'page', fields: [] };
      vi.mocked(http.getOrNull).mockResolvedValue(schema);
      const result = await new CollectionsResource(http, siteId, 'recipe').schema();
      expect(http.getOrNull).toHaveBeenCalledWith(`/sites/${siteId}/collections/recipe/schema`);
      expect(result).toEqual(schema);
    });

    it('returns null when the type is not public', async () => {
      const http = createMockHttp();
      vi.mocked(http.getOrNull).mockResolvedValue(null);
      const result = await new CollectionsResource(http, siteId, 'recipe').schema();
      expect(result).toBeNull();
    });

    it('rethrows non-not-found errors', async () => {
      const http = createMockHttp();
      vi.mocked(http.getOrNull).mockRejectedValue(new ForjaAuthError('bad key'));
      await expect(new CollectionsResource(http, siteId, 'recipe').schema()).rejects.toThrow(
        ForjaAuthError,
      );
    });
  });
});

describe('ForjaClient.collections', () => {
  it('builds a CollectionsResource for a type key', () => {
    const forja = new ForjaClient({
      baseUrl: 'https://cms.example.com/api/v1',
      apiKey: 'read-key',
      siteId,
    });
    expect(forja.collections('recipe')).toBeInstanceOf(CollectionsResource);
  });
});
