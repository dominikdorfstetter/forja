import { describe, expect, it, vi } from 'vitest';
import { SiteResource } from '../../resources/site.js';
import { renderCodeInjection } from '../../code-injection.js';
import type { HttpClient } from '../../http.js';
import type { SiteLocaleResponse } from '../../types.js';

function createMockHttp(): HttpClient {
  return {
    get: vi.fn(), getOrNull: vi.fn(),
    getText: vi.fn(),
    post: vi.fn(),
    delete: vi.fn(),
  };
}

const siteId = 'site-123';

describe('SiteResource', () => {
  describe('get', () => {
    it('returns site info', async () => {
      const http = createMockHttp();
      const site = {
        id: siteId,
        name: 'My Site',
        slug: 'my-site',
        description: null,
        logo_url: null,
        favicon_url: null,
        base_url: 'https://example.com',
        theme: null,
        default_locale_id: null,
        timezone: 'UTC',
        is_active: true,
        created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z',
      };
      vi.mocked(http.get).mockResolvedValue(site);

      const resource = new SiteResource(http, siteId);
      const result = await resource.get();

      expect(result).toEqual(site);
    });

    it('calls the correct URL', async () => {
      const http = createMockHttp();
      vi.mocked(http.get).mockResolvedValue({});

      const resource = new SiteResource(http, siteId);
      await resource.get();

      expect(http.get).toHaveBeenCalledWith(`/sites/${siteId}`);
    });
  });

  describe('listLocales', () => {
    it('returns site locales', async () => {
      const http = createMockHttp();
      const locales = [
        { locale_id: 'l1', code: 'en', name: 'English', is_default: true, is_active: true },
        { locale_id: 'l2', code: 'de', name: 'German', is_default: false, is_active: true },
      ];
      vi.mocked(http.get).mockResolvedValue(locales);

      const resource = new SiteResource(http, siteId);
      const result = await resource.listLocales();

      expect(http.get).toHaveBeenCalledWith(`/sites/${siteId}/locales`);
      expect(result).toHaveLength(2);
    });

    // SDK had drifted from the backend DTO — site_id, url_prefix, created_at
    // were missing. Pinning the full shape here so future drift fails the
    // type checker.
    it('surfaces every field the backend returns', async () => {
      const http = createMockHttp();
      const full: SiteLocaleResponse = {
        site_id: 'site-1',
        locale_id: 'loc-1',
        code: 'de-AT',
        name: 'German (Austria)',
        native_name: 'Deutsch (Österreich)',
        direction: 'ltr',
        is_default: true,
        is_active: true,
        url_prefix: null,
        created_at: '2026-05-21T10:00:00Z',
      };
      vi.mocked(http.get).mockResolvedValue([full]);

      const resource = new SiteResource(http, siteId);
      const result = await resource.listLocales();

      expect(result[0]).toEqual(full);
      expect(result[0].site_id).toBe('site-1');
      expect(result[0].url_prefix).toBeNull();
      expect(result[0].created_at).toBe('2026-05-21T10:00:00Z');
    });
  });

  describe('getCodeInjection', () => {
    it('calls the correct settings URL', async () => {
      const http = createMockHttp();
      vi.mocked(http.get).mockResolvedValue({});

      const resource = new SiteResource(http, siteId);
      await resource.getCodeInjection();

      expect(http.get).toHaveBeenCalledWith(`/sites/${siteId}/settings`);
    });

    it('extracts code injection fields from settings', async () => {
      const http = createMockHttp();
      vi.mocked(http.get).mockResolvedValue({
        code_injection_head: '<script>console.log("head")</script>',
        code_injection_footer: '<script>console.log("footer")</script>',
        some_other_setting: 'ignored',
      });

      const resource = new SiteResource(http, siteId);
      const result = await resource.getCodeInjection();

      expect(result).toEqual({
        code_injection_head: '<script>console.log("head")</script>',
        code_injection_footer: '<script>console.log("footer")</script>',
      });
    });

    it('defaults missing fields to empty strings', async () => {
      const http = createMockHttp();
      vi.mocked(http.get).mockResolvedValue({});

      const resource = new SiteResource(http, siteId);
      const result = await resource.getCodeInjection();

      expect(result).toEqual({
        code_injection_head: '',
        code_injection_footer: '',
      });
    });

    it('defaults null fields to empty strings', async () => {
      const http = createMockHttp();
      vi.mocked(http.get).mockResolvedValue({
        code_injection_head: null,
        code_injection_footer: null,
      });

      const resource = new SiteResource(http, siteId);
      const result = await resource.getCodeInjection();

      expect(result).toEqual({
        code_injection_head: '',
        code_injection_footer: '',
      });
    });
  });
});

describe('renderCodeInjection', () => {
  it('passes through head and footer values', () => {
    const result = renderCodeInjection({
      code_injection_head: '<meta name="custom" content="value">',
      code_injection_footer: '<script>alert("hi")</script>',
    });

    expect(result).toEqual({
      head: '<meta name="custom" content="value">',
      footer: '<script>alert("hi")</script>',
    });
  });

  it('handles empty strings', () => {
    const result = renderCodeInjection({
      code_injection_head: '',
      code_injection_footer: '',
    });

    expect(result).toEqual({ head: '', footer: '' });
  });
});
