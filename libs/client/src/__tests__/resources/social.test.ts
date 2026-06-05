import { describe, expect, it, vi } from 'vitest';
import { SocialResource } from '../../resources/social.js';
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

describe('SocialResource', () => {
  describe('list', () => {
    it('returns social links', async () => {
      const http = createMockHttp();
      const links = [
        {
          id: 'link-1',
          title: 'GitHub',
          url: 'https://github.com/example',
          icon: 'github',
          alt_text: 'GitHub profile',
          display_order: 1,
        },
        {
          id: 'link-2',
          title: 'Twitter',
          url: 'https://twitter.com/example',
          icon: 'twitter',
          alt_text: null,
          display_order: 2,
        },
      ];
      vi.mocked(http.get).mockResolvedValue(links);

      const resource = new SocialResource(http, siteId);
      const result = await resource.list();

      expect(result).toEqual(links);
    });

    it('calls the correct URL', async () => {
      const http = createMockHttp();
      vi.mocked(http.get).mockResolvedValue([]);

      const resource = new SocialResource(http, siteId);
      await resource.list();

      expect(http.get).toHaveBeenCalledWith(`/sites/${siteId}/social`);
    });
  });
});
