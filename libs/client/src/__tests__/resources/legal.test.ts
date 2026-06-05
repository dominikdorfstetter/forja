import { describe, expect, it, vi } from 'vitest';
import { LegalResource } from '../../resources/legal.js';
import { ForjaAuthError } from '../../errors.js';
import type { HttpClient } from '../../http.js';

function createMockHttp(): HttpClient {
  return { get: vi.fn(), getOrNull: vi.fn(),
    getText: vi.fn(), post: vi.fn(), delete: vi.fn() };
}

const siteId = 'site-123';

describe('LegalResource', () => {
  describe('list', () => {
    it('fetches paginated legal documents', async () => {
      const http = createMockHttp();
      vi.mocked(http.get).mockResolvedValue({
        data: [{ id: 'l1', document_type: 'PrivacyPolicy' }],
        meta: { page: 1, page_size: 10, total_pages: 1, total_items: 1 },
      });

      const legal = new LegalResource(http, siteId);
      const result = await legal.list({ page: 1 });

      expect(http.get).toHaveBeenCalledWith(`/sites/${siteId}/legal`, {
        page: '1',
      });
      expect(result.data).toHaveLength(1);
    });

    it('fetches legal documents without params', async () => {
      const http = createMockHttp();
      vi.mocked(http.get).mockResolvedValue({
        data: [],
        meta: { page: 1, page_size: 10, total_pages: 0, total_items: 0 },
      });

      const legal = new LegalResource(http, siteId);
      await legal.list();

      expect(http.get).toHaveBeenCalledWith(`/sites/${siteId}/legal`, {
        page: '1',
      });
    });
  });

  describe('get', () => {
    it('fetches legal document by id', async () => {
      const http = createMockHttp();
      vi.mocked(http.getOrNull).mockResolvedValue({
        id: 'l1',
        document_type: 'PrivacyPolicy',
        localizations: [],
      });

      const legal = new LegalResource(http, siteId);
      const result = await legal.get('l1');

      expect(http.getOrNull).toHaveBeenCalledWith('/legal/l1');
      expect(result?.document_type).toBe('PrivacyPolicy');
    });

    it('returns null on 404', async () => {
      const http = createMockHttp();
      vi.mocked(http.getOrNull).mockResolvedValue(null);

      const legal = new LegalResource(http, siteId);
      expect(await legal.get('missing')).toBeNull();
    });

    it('rethrows non-404 errors', async () => {
      const http = createMockHttp();
      vi.mocked(http.getOrNull).mockRejectedValue(new ForjaAuthError());

      const legal = new LegalResource(http, siteId);
      await expect(legal.get('test')).rejects.toThrow(ForjaAuthError);
    });
  });

  describe('getBySlug', () => {
    it('fetches legal document by slug', async () => {
      const http = createMockHttp();
      vi.mocked(http.getOrNull).mockResolvedValue({ id: 'l1' });

      const legal = new LegalResource(http, siteId);
      await legal.getBySlug('privacy-policy');

      expect(http.getOrNull).toHaveBeenCalledWith(
        `/sites/${siteId}/legal/by-slug/privacy-policy`,
        { locale: undefined },
      );
    });

    it('returns null on 404', async () => {
      const http = createMockHttp();
      vi.mocked(http.getOrNull).mockResolvedValue(null);

      const legal = new LegalResource(http, siteId);
      expect(await legal.getBySlug('missing')).toBeNull();
    });

    it('rethrows non-404 errors', async () => {
      const http = createMockHttp();
      vi.mocked(http.getOrNull).mockRejectedValue(new ForjaAuthError());

      const legal = new LegalResource(http, siteId);
      await expect(legal.getBySlug('test')).rejects.toThrow(ForjaAuthError);
    });
  });

  describe('getCookieConsent', () => {
    it('fetches cookie consent document', async () => {
      const http = createMockHttp();
      vi.mocked(http.getOrNull).mockResolvedValue({
        id: 'l1',
        document_type: 'CookieConsent',
        groups: [],
      });

      const legal = new LegalResource(http, siteId);
      const result = await legal.getCookieConsent();

      expect(http.getOrNull).toHaveBeenCalledWith(
        `/sites/${siteId}/legal/cookie-consent`,
      );
      expect(result?.document_type).toBe('CookieConsent');
    });

    it('returns null on 404', async () => {
      const http = createMockHttp();
      vi.mocked(http.getOrNull).mockResolvedValue(null);

      const legal = new LegalResource(http, siteId);
      expect(await legal.getCookieConsent()).toBeNull();
    });

    it('rethrows non-404 errors', async () => {
      const http = createMockHttp();
      vi.mocked(http.getOrNull).mockRejectedValue(new ForjaAuthError());

      const legal = new LegalResource(http, siteId);
      await expect(legal.getCookieConsent()).rejects.toThrow(ForjaAuthError);
    });
  });

  describe('getGroups', () => {
    it('fetches groups for a document', async () => {
      const http = createMockHttp();
      vi.mocked(http.get).mockResolvedValue([
        { id: 'g1', items: [] },
      ]);

      const legal = new LegalResource(http, siteId);
      await legal.getGroups('l1');

      expect(http.get).toHaveBeenCalledWith('/legal/l1/groups');
    });
  });

  describe('getGroupItems', () => {
    it('fetches items for a group', async () => {
      const http = createMockHttp();
      vi.mocked(http.get).mockResolvedValue([{ id: 'i1' }]);

      const legal = new LegalResource(http, siteId);
      await legal.getGroupItems('g1');

      expect(http.get).toHaveBeenCalledWith('/legal/groups/g1/items');
    });
  });

  describe('getDetail', () => {
    it('returns full document detail', async () => {
      const http = createMockHttp();
      vi.mocked(http.getOrNull).mockResolvedValue({
        id: 'l1', version: 3, document_type: 'PrivacyPolicy',
        localizations: [], doc_localizations: [],
      });

      const legal = new LegalResource(http, siteId);
      const result = await legal.getDetail('l1');

      expect(http.getOrNull).toHaveBeenCalledWith('/legal/l1/detail', {
        locale: undefined,
      });
      expect(result?.version).toBe(3);
    });

    it('returns null on 404', async () => {
      const http = createMockHttp();
      vi.mocked(http.getOrNull).mockResolvedValue(null);

      const legal = new LegalResource(http, siteId);
      expect(await legal.getDetail('missing')).toBeNull();
    });

    it('propagates non-404 errors', async () => {
      const http = createMockHttp();
      const { ForjaAuthError } = await import('../../errors.js');
      vi.mocked(http.getOrNull).mockRejectedValue(new ForjaAuthError('No API key'));

      const legal = new LegalResource(http, siteId);
      await expect(legal.getDetail('whatever')).rejects.toThrow(ForjaAuthError);
    });
  });

  describe('listVersions', () => {
    it('returns version history', async () => {
      const http = createMockHttp();
      vi.mocked(http.get).mockResolvedValue([
        { id: 'v1', version: 1, status: 'published', created_at: '2024-01-01T00:00:00Z' },
        { id: 'v2', version: 2, status: 'published', created_at: '2024-06-01T00:00:00Z' },
      ]);

      const legal = new LegalResource(http, siteId);
      const result = await legal.listVersions('l1');

      expect(http.get).toHaveBeenCalledWith('/legal/l1/versions');
      expect(result).toHaveLength(2);
    });
  });

  // Issue #757 — ?locale= resolver, ADR 0002.
  describe('locale resolver', () => {
    it('forwards locale on getBySlug()', async () => {
      const http = createMockHttp();
      vi.mocked(http.getOrNull).mockResolvedValue({ id: 'l1', localizations: [] });

      const legal = new LegalResource(http, siteId);
      await legal.getBySlug('privacy', { locale: 'en' });

      expect(http.getOrNull).toHaveBeenCalledWith(
        `/sites/${siteId}/legal/by-slug/privacy`,
        { locale: 'en' },
      );
    });

    it('forwards locale on getDetail()', async () => {
      const http = createMockHttp();
      vi.mocked(http.getOrNull).mockResolvedValue({
        id: 'l1',
        localizations: [],
        doc_localizations: [],
      });

      const legal = new LegalResource(http, siteId);
      await legal.getDetail('l1', { locale: 'en' });

      expect(http.getOrNull).toHaveBeenCalledWith('/legal/l1/detail', {
        locale: 'en',
      });
    });
  });
});
