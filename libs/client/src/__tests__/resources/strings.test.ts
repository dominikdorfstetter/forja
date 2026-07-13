import { describe, expect, it, vi } from 'vitest';
import { StringsResource } from '../../resources/strings.js';
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

describe('StringsResource', () => {
  describe('get', () => {
    it('returns the flat key → value map for the locale', async () => {
      const http = createMockHttp();
      const strings = {
        'blog.min_read': 'Min. Lesezeit',
        'footer.built_with': 'Erstellt mit Forja',
      };
      vi.mocked(http.get).mockResolvedValue(strings);

      const result = await new StringsResource(http, siteId).get('de');

      expect(result).toEqual(strings);
    });

    it('calls the strings endpoint with the required locale query', async () => {
      const http = createMockHttp();
      vi.mocked(http.get).mockResolvedValue({});

      await new StringsResource(http, siteId).get('de-AT');

      expect(http.get).toHaveBeenCalledWith(`/sites/${siteId}/strings`, {
        locale: 'de-AT',
      });
    });

    it('propagates API errors', async () => {
      const http = createMockHttp();
      vi.mocked(http.get).mockRejectedValue(new ForjaAuthError('bad key'));

      await expect(new StringsResource(http, siteId).get('en')).rejects.toThrow(
        ForjaAuthError,
      );
    });
  });
});

describe('ForjaClient.strings', () => {
  it('resolves the map through the client accessor', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ 'nav.aria.toggle_dark': 'Toggle dark mode' }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    const forja = new ForjaClient({
      baseUrl: 'https://cms.example.com/api/v1',
      apiKey: 'read-key',
      siteId,
      fetch: fetchMock,
    });

    await expect(forja.strings('en')).resolves.toEqual({
      'nav.aria.toggle_dark': 'Toggle dark mode',
    });
    expect(fetchMock).toHaveBeenCalledWith(
      `https://cms.example.com/api/v1/sites/${siteId}/strings?locale=en`,
      expect.objectContaining({ method: 'GET' }),
    );
  });
});
