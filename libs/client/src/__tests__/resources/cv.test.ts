import { describe, expect, it, vi } from 'vitest';
import { CvResource } from '../../resources/cv.js';
import { ForjaAuthError } from '../../errors.js';
import type { HttpClient } from '../../http.js';

function createMockHttp(): HttpClient {
  return { get: vi.fn(), getOrNull: vi.fn(),
    getText: vi.fn(), post: vi.fn(), delete: vi.fn() };
}

const siteId = 'site-123';

describe('CvResource', () => {
  describe('listSkills', () => {
    it('fetches paginated skills', async () => {
      const http = createMockHttp();
      vi.mocked(http.get).mockResolvedValue({
        data: [{ id: 's1', name: 'TypeScript' }],
        meta: { page: 1, page_size: 10, total_pages: 1, total_items: 1 },
      });

      const cv = new CvResource(http, siteId);
      const result = await cv.listSkills({ page: 1 });

      expect(http.get).toHaveBeenCalledWith(`/sites/${siteId}/skills`, {
        page: '1',
      });
      expect(result.data).toHaveLength(1);
    });

    it('fetches skills without params', async () => {
      const http = createMockHttp();
      vi.mocked(http.get).mockResolvedValue({
        data: [],
        meta: { page: 1, page_size: 10, total_pages: 0, total_items: 0 },
      });

      const cv = new CvResource(http, siteId);
      await cv.listSkills();

      expect(http.get).toHaveBeenCalledWith(`/sites/${siteId}/skills`, {
        page: '1',
      });
    });

    // Issue #755 — ?locale= resolver, ADR 0002.
    it('forwards locale param to the server', async () => {
      const http = createMockHttp();
      vi.mocked(http.get).mockResolvedValue({
        data: [],
        meta: { page: 1, page_size: 10, total_pages: 0, total_items: 0 },
      });

      const cv = new CvResource(http, siteId);
      await cv.listSkills({ locale: 'en' });

      expect(http.get).toHaveBeenCalledWith(
        `/sites/${siteId}/skills`,
        expect.objectContaining({ locale: 'en' }),
      );
    });
  });

  describe('getSkill', () => {
    it('fetches skill by id', async () => {
      const http = createMockHttp();
      vi.mocked(http.getOrNull).mockResolvedValue({ id: 's1', name: 'Rust' });

      const cv = new CvResource(http, siteId);
      const result = await cv.getSkill('s1');

      expect(http.getOrNull).toHaveBeenCalledWith('/skills/s1', {
        locale: undefined,
      });
      expect(result?.name).toBe('Rust');
    });

    it('returns null on 404', async () => {
      const http = createMockHttp();
      vi.mocked(http.getOrNull).mockResolvedValue(null);

      const cv = new CvResource(http, siteId);
      expect(await cv.getSkill('missing')).toBeNull();
    });

    it('rethrows non-404 errors', async () => {
      const http = createMockHttp();
      vi.mocked(http.getOrNull).mockRejectedValue(new ForjaAuthError());

      const cv = new CvResource(http, siteId);
      await expect(cv.getSkill('test')).rejects.toThrow(ForjaAuthError);
    });

    // Issue #755 — ?locale= resolver, ADR 0002.
    it('forwards locale when set', async () => {
      const http = createMockHttp();
      vi.mocked(http.getOrNull).mockResolvedValue({ id: 's1', name: 'Rust' });

      const cv = new CvResource(http, siteId);
      await cv.getSkill('s1', { locale: 'en' });

      expect(http.getOrNull).toHaveBeenCalledWith('/skills/s1', { locale: 'en' });
    });
  });

  describe('getSkillBySlug', () => {
    it('fetches skill by slug', async () => {
      const http = createMockHttp();
      vi.mocked(http.getOrNull).mockResolvedValue({ id: 's1', slug: 'typescript' });

      const cv = new CvResource(http, siteId);
      await cv.getSkillBySlug('typescript');

      expect(http.getOrNull).toHaveBeenCalledWith('/skills/by-slug/typescript', {
        locale: undefined,
      });
    });

    it('returns null on 404', async () => {
      const http = createMockHttp();
      vi.mocked(http.getOrNull).mockResolvedValue(null);

      const cv = new CvResource(http, siteId);
      expect(await cv.getSkillBySlug('missing')).toBeNull();
    });

    it('rethrows non-404 errors', async () => {
      const http = createMockHttp();
      vi.mocked(http.getOrNull).mockRejectedValue(new ForjaAuthError());

      const cv = new CvResource(http, siteId);
      await expect(cv.getSkillBySlug('test')).rejects.toThrow(ForjaAuthError);
    });

    // Issue #755 — ?locale= resolver, ADR 0002.
    it('forwards locale when set', async () => {
      const http = createMockHttp();
      vi.mocked(http.getOrNull).mockResolvedValue({ id: 's1', slug: 'typescript' });

      const cv = new CvResource(http, siteId);
      await cv.getSkillBySlug('typescript', { locale: 'en' });

      expect(http.getOrNull).toHaveBeenCalledWith('/skills/by-slug/typescript', {
        locale: 'en',
      });
    });
  });

  describe('listEntries', () => {
    it('fetches CV entries with entry type filter', async () => {
      const http = createMockHttp();
      vi.mocked(http.get).mockResolvedValue({
        data: [{ id: 'e1', entry_type: 'Work' }],
        meta: { page: 1, page_size: 10, total_pages: 1, total_items: 1 },
      });

      const cv = new CvResource(http, siteId);
      await cv.listEntries({ entryType: 'Work', page: 1 });

      expect(http.get).toHaveBeenCalledWith(
        `/sites/${siteId}/cv`,
        expect.objectContaining({ entry_type: 'Work', page: '1' }),
      );
    });

    it('fetches entries without params', async () => {
      const http = createMockHttp();
      vi.mocked(http.get).mockResolvedValue({
        data: [],
        meta: { page: 1, page_size: 10, total_pages: 0, total_items: 0 },
      });

      const cv = new CvResource(http, siteId);
      await cv.listEntries();

      expect(http.get).toHaveBeenCalledWith(`/sites/${siteId}/cv`, {
        page: '1',
      });
    });

    // Issue #754 — ?locale= resolver, ADR 0002.
    it('forwards locale param to the server', async () => {
      const http = createMockHttp();
      vi.mocked(http.get).mockResolvedValue({
        data: [],
        meta: { page: 1, page_size: 10, total_pages: 0, total_items: 0 },
      });

      const cv = new CvResource(http, siteId);
      await cv.listEntries({ locale: 'en' });

      expect(http.get).toHaveBeenCalledWith(
        `/sites/${siteId}/cv`,
        expect.objectContaining({ locale: 'en' }),
      );
    });
  });

  // Issue #754 — detail endpoint exposed in SDK for the first time, with
  // ADR 0002 ?locale= support.
  describe('getEntry', () => {
    it('fetches a CV entry by id', async () => {
      const http = createMockHttp();
      vi.mocked(http.getOrNull).mockResolvedValue({ id: 'e1', company: 'Acme' });

      const cv = new CvResource(http, siteId);
      const result = await cv.getEntry('e1');

      expect(http.getOrNull).toHaveBeenCalledWith('/cv/e1', {
        locale: undefined,
      });
      expect(result?.company).toBe('Acme');
    });

    it('forwards locale when set', async () => {
      const http = createMockHttp();
      vi.mocked(http.getOrNull).mockResolvedValue({ id: 'e1', company: 'Acme' });

      const cv = new CvResource(http, siteId);
      await cv.getEntry('e1', { locale: 'en' });

      expect(http.getOrNull).toHaveBeenCalledWith('/cv/e1', { locale: 'en' });
    });

    it('returns null on 404', async () => {
      const http = createMockHttp();
      vi.mocked(http.getOrNull).mockResolvedValue(null);

      const cv = new CvResource(http, siteId);
      expect(await cv.getEntry('missing')).toBeNull();
    });

    it('rethrows non-404 errors', async () => {
      const http = createMockHttp();
      vi.mocked(http.getOrNull).mockRejectedValue(new ForjaAuthError());

      const cv = new CvResource(http, siteId);
      await expect(cv.getEntry('e1')).rejects.toThrow(ForjaAuthError);
    });
  });

  // Issue #876 / ADR 0003 — uniform /detail route. For CV the detail
  // shape equals the lightweight shape; the route exists for symmetry.
  describe('getEntryDetail', () => {
    it('fetches a CV entry from the /detail route', async () => {
      const http = createMockHttp();
      vi.mocked(http.getOrNull).mockResolvedValue({ id: 'e1', company: 'Acme' });

      const cv = new CvResource(http, siteId);
      const result = await cv.getEntryDetail('e1');

      expect(http.getOrNull).toHaveBeenCalledWith('/cv/e1/detail', {
        locale: undefined,
      });
      expect(result?.company).toBe('Acme');
    });

    it('forwards locale when set', async () => {
      const http = createMockHttp();
      vi.mocked(http.getOrNull).mockResolvedValue({ id: 'e1', company: 'Acme' });

      const cv = new CvResource(http, siteId);
      await cv.getEntryDetail('e1', { locale: 'en' });

      expect(http.getOrNull).toHaveBeenCalledWith('/cv/e1/detail', {
        locale: 'en',
      });
    });

    it('returns null on 404', async () => {
      const http = createMockHttp();
      vi.mocked(http.getOrNull).mockResolvedValue(null);

      const cv = new CvResource(http, siteId);
      expect(await cv.getEntryDetail('missing')).toBeNull();
    });

    it('rethrows non-404 errors', async () => {
      const http = createMockHttp();
      vi.mocked(http.getOrNull).mockRejectedValue(new ForjaAuthError());

      const cv = new CvResource(http, siteId);
      await expect(cv.getEntryDetail('e1')).rejects.toThrow(ForjaAuthError);
    });
  });
});
