import { describe, expect, it, vi } from 'vitest';
import { ProjectsResource } from '../../resources/projects.js';
import type { HttpClient } from '../../http.js';
import type { ProjectResponse } from '../../types.js';
import { ForjaAuthError } from '../../errors.js';

function createMockHttp(): HttpClient {
  return { get: vi.fn(), getOrNull: vi.fn(), getText: vi.fn(), post: vi.fn(), delete: vi.fn() };
}

const siteId = 'site-123';

describe('ProjectsResource', () => {
  describe('listPublished', () => {
    it('fetches published projects with pagination', async () => {
      const http = createMockHttp();
      const response = {
        data: [{ id: '1', slug: 'forja' }],
        meta: { page: 1, page_size: 10, total_pages: 1, total_items: 1 },
      };
      vi.mocked(http.get).mockResolvedValue(response);

      const resource = new ProjectsResource(http, siteId);
      const result = await resource.listPublished({ page: 1, pageSize: 10 });

      expect(http.get).toHaveBeenCalledWith(
        `/sites/${siteId}/projects/public`,
        { page: '1', page_size: '10' },
      );
      expect(result.data).toEqual(response.data);
    });

    it('exposes localizations[] on each ProjectResponse — consumer-unblock #739', async () => {
      const http = createMockHttp();
      const payload: ProjectResponse = {
        id: 'p1',
        slug: 'forja',
        display_order: 0,
        is_featured: false,
        start_date: null,
        end_date: null,
        is_ongoing: false,
        status: 'Published',
        published_at: null,
        created_at: '2026-05-21T00:00:00Z',
        updated_at: '2026-05-21T00:00:00Z',
        skill_ids: [],
        localizations: [
          { id: 'l1', locale_id: 'en', title: 'Forja', short_description: 'CMS', description: null },
          { id: 'l2', locale_id: 'de', title: 'Forja', short_description: 'CMS', description: null },
        ],
      };
      vi.mocked(http.get).mockResolvedValue({
        data: [payload],
        meta: { page: 1, page_size: 10, total_pages: 1, total_items: 1 },
      });

      const resource = new ProjectsResource(http, siteId);
      const result = await resource.listPublished();

      expect(result.data[0]?.localizations).toHaveLength(2);
      expect(result.data[0]?.localizations[0]?.title).toBe('Forja');
    });

    it('omits query params entirely when no filter is given', async () => {
      const http = createMockHttp();
      vi.mocked(http.get).mockResolvedValue({ data: [], meta: { page: 1, page_size: 10, total_pages: 0, total_items: 0 } });

      const resource = new ProjectsResource(http, siteId);
      await resource.listPublished();

      // First call's params object should only carry the synthetic `page` key.
      const [, params] = vi.mocked(http.get).mock.calls[0];
      expect(params).toEqual({ page: '1' });
    });

    it('passes filter params', async () => {
      const http = createMockHttp();
      vi.mocked(http.get).mockResolvedValue({ data: [], meta: { page: 1, page_size: 10, total_pages: 0, total_items: 0 } });

      const resource = new ProjectsResource(http, siteId);
      await resource.listPublished({ isFeatured: true, sortBy: 'display_order', sortDir: 'asc' });

      expect(http.get).toHaveBeenCalledWith(
        `/sites/${siteId}/projects/public`,
        expect.objectContaining({ is_featured: 'true', sort_by: 'display_order', sort_dir: 'asc' }),
      );
    });

    // Issue #753 — ?locale= resolver, ADR 0002.
    it('forwards locale param to the server', async () => {
      const http = createMockHttp();
      vi.mocked(http.get).mockResolvedValue({ data: [], meta: { page: 1, page_size: 10, total_pages: 0, total_items: 0 } });

      const resource = new ProjectsResource(http, siteId);
      await resource.listPublished({ locale: 'en' });

      expect(http.get).toHaveBeenCalledWith(
        `/sites/${siteId}/projects/public`,
        expect.objectContaining({ locale: 'en' }),
      );
    });

    // Issue #738 — list items must carry skill_ids so consumers can render
    // skill pills without an N+1 detail fetch.
    it('surfaces skill_ids on every list item (including empty arrays)', async () => {
      const http = createMockHttp();
      const items: ProjectResponse[] = [
        {
          id: 'p1',
          slug: 'with-skills',
          display_order: 0,
          is_featured: false,
          start_date: null,
          end_date: null,
          is_ongoing: false,
          status: 'Published',
          published_at: null,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
          skill_ids: ['s1', 's2'],
          localizations: [],
        },
        {
          id: 'p2',
          slug: 'no-skills',
          display_order: 1,
          is_featured: false,
          start_date: null,
          end_date: null,
          is_ongoing: false,
          status: 'Published',
          published_at: null,
          created_at: '2024-01-01T00:00:00Z',
          updated_at: '2024-01-01T00:00:00Z',
          skill_ids: [],
          localizations: [],
        },
      ];
      vi.mocked(http.get).mockResolvedValue({
        data: items,
        meta: { page: 1, page_size: 10, total_pages: 1, total_items: 2 },
      });

      const resource = new ProjectsResource(http, siteId);
      const result = await resource.listPublished();

      expect(result.data).toHaveLength(2);
      expect(result.data[0].skill_ids).toEqual(['s1', 's2']);
      expect(result.data[1].skill_ids).toEqual([]);
    });
  });

  describe('get', () => {
    it('returns the lightweight project by ID', async () => {
      const http = createMockHttp();
      const project = { id: 'p1', slug: 'test', localizations: [], skill_ids: [] };
      vi.mocked(http.getOrNull).mockResolvedValue(project);

      const resource = new ProjectsResource(http, siteId);
      const result = await resource.get('p1');

      expect(http.getOrNull).toHaveBeenCalledWith('/projects/p1', {
        locale: undefined,
      });
      expect(result).toEqual(project);
    });

    it('returns null for not found', async () => {
      const http = createMockHttp();
      vi.mocked(http.getOrNull).mockResolvedValue(null);

      const resource = new ProjectsResource(http, siteId);
      expect(await resource.get('missing')).toBeNull();
    });

    it('propagates non-404 errors', async () => {
      const http = createMockHttp();
      vi.mocked(http.getOrNull).mockRejectedValue(new ForjaAuthError('No API key'));

      const resource = new ProjectsResource(http, siteId);
      await expect(resource.get('p1')).rejects.toThrow(ForjaAuthError);
    });

    // Issue #753 — ?locale= resolver, ADR 0002.
    it('forwards locale to the lightweight endpoint when set', async () => {
      const http = createMockHttp();
      vi.mocked(http.getOrNull).mockResolvedValue({ id: 'p1', localizations: [], skill_ids: [] });

      const resource = new ProjectsResource(http, siteId);
      await resource.get('p1', { locale: 'en' });

      expect(http.getOrNull).toHaveBeenCalledWith('/projects/p1', { locale: 'en' });
    });
  });

  // Issue #876 / ADR 0003 — the relational graph moves to /projects/{id}/detail.
  describe('getDetail', () => {
    it('returns the full project graph from the /detail route', async () => {
      const http = createMockHttp();
      const project = { id: 'p1', slug: 'test', localizations: [], links: [], media: [], skill_ids: [], cv_entry_ids: [] };
      vi.mocked(http.getOrNull).mockResolvedValue(project);

      const resource = new ProjectsResource(http, siteId);
      const result = await resource.getDetail('p1');

      expect(http.getOrNull).toHaveBeenCalledWith('/projects/p1/detail', {
        locale: undefined,
      });
      expect(result).toEqual(project);
    });

    it('forwards locale when set', async () => {
      const http = createMockHttp();
      vi.mocked(http.getOrNull).mockResolvedValue({ id: 'p1', localizations: [], links: [], media: [], skill_ids: [], cv_entry_ids: [] });

      const resource = new ProjectsResource(http, siteId);
      await resource.getDetail('p1', { locale: 'en' });

      expect(http.getOrNull).toHaveBeenCalledWith('/projects/p1/detail', { locale: 'en' });
    });

    it('returns null for not found', async () => {
      const http = createMockHttp();
      vi.mocked(http.getOrNull).mockResolvedValue(null);

      const resource = new ProjectsResource(http, siteId);
      expect(await resource.getDetail('missing')).toBeNull();
    });

    it('propagates non-404 errors', async () => {
      const http = createMockHttp();
      vi.mocked(http.getOrNull).mockRejectedValue(new ForjaAuthError('No API key'));

      const resource = new ProjectsResource(http, siteId);
      await expect(resource.getDetail('p1')).rejects.toThrow(ForjaAuthError);
    });
  });

  describe('getBySlug', () => {
    it('returns project by slug', async () => {
      const http = createMockHttp();
      vi.mocked(http.getOrNull).mockResolvedValue({ id: 'p1', slug: 'my-project' });

      const resource = new ProjectsResource(http, siteId);
      const result = await resource.getBySlug('my-project');

      expect(http.getOrNull).toHaveBeenCalledWith(
        `/sites/${siteId}/projects/by-slug/my-project`,
        { locale: undefined },
      );
      expect(result?.slug).toBe('my-project');
    });

    it('returns null for not found', async () => {
      const http = createMockHttp();
      vi.mocked(http.getOrNull).mockResolvedValue(null);

      const resource = new ProjectsResource(http, siteId);
      expect(await resource.getBySlug('nope')).toBeNull();
    });

    it('propagates non-404 errors', async () => {
      const http = createMockHttp();
      vi.mocked(http.getOrNull).mockRejectedValue(new ForjaAuthError('No API key'));

      const resource = new ProjectsResource(http, siteId);
      await expect(resource.getBySlug('whatever')).rejects.toThrow(ForjaAuthError);
    });

    // Issue #753 — ?locale= resolver, ADR 0002.
    it('forwards locale to the by-slug endpoint when set', async () => {
      const http = createMockHttp();
      vi.mocked(http.getOrNull).mockResolvedValue({ id: 'p1', slug: 'forja', localizations: [] });

      const resource = new ProjectsResource(http, siteId);
      await resource.getBySlug('forja', { locale: 'en' });

      expect(http.getOrNull).toHaveBeenCalledWith(
        `/sites/${siteId}/projects/by-slug/forja`,
        { locale: 'en' },
      );
    });
  });
});
