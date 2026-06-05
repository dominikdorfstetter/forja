import { describe, expect, it, vi } from 'vitest';
import { MediaResource } from '../../resources/media.js';
import { ForjaAuthError } from '../../errors.js';
import type { HttpClient } from '../../http.js';

function createMockHttp(): HttpClient {
  return { get: vi.fn(), getOrNull: vi.fn(), getText: vi.fn(), post: vi.fn(), delete: vi.fn() };
}

const siteId = 'site-123';

describe('MediaResource', () => {
  describe('list', () => {
    it('fetches paginated media list', async () => {
      const http = createMockHttp();
      const response = {
        data: [{ id: 'm1', filename: 'photo.jpg', mime_type: 'image/jpeg' }],
        meta: { page: 1, page_size: 10, total_pages: 1, total_items: 1 },
      };
      vi.mocked(http.get).mockResolvedValue(response);

      const resource = new MediaResource(http, siteId);
      const result = await resource.list({ page: 1, pageSize: 10 });

      expect(http.get).toHaveBeenCalledWith(
        `/sites/${siteId}/media`,
        expect.objectContaining({ page: '1', page_size: '10' }),
      );
      expect(result.data).toHaveLength(1);
    });

    it('works without any params', async () => {
      const http = createMockHttp();
      vi.mocked(http.get).mockResolvedValue({ data: [], meta: { page: 1, page_size: 10, total_pages: 0, total_items: 0 } });
      const resource = new MediaResource(http, siteId);
      await resource.list();
      const [, params] = vi.mocked(http.get).mock.calls[0];
      expect(params).toEqual({ page: '1' });
    });

    it('passes filter params', async () => {
      const http = createMockHttp();
      vi.mocked(http.get).mockResolvedValue({ data: [], meta: { page: 1, page_size: 10, total_pages: 0, total_items: 0 } });

      const resource = new MediaResource(http, siteId);
      await resource.list({ mimeCategory: 'image', folderId: 'folder-1' });

      expect(http.get).toHaveBeenCalledWith(
        `/sites/${siteId}/media`,
        expect.objectContaining({ mime_category: 'image', folder_id: 'folder-1' }),
      );
    });
  });

  describe('get', () => {
    it('returns media by id', async () => {
      const http = createMockHttp();
      const media = {
        id: 'media-1', filename: 'photo.jpg', original_filename: 'photo.jpg',
        mime_type: 'image/jpeg', file_size: 12345, storage_provider: 's3',
        public_url: 'https://cdn.example.com/photo.jpg', width: 800, height: 600,
        duration: null, is_global: false, created_at: '2024-01-01T00:00:00Z',
        updated_at: '2024-01-01T00:00:00Z', variants: [],
      };
      vi.mocked(http.getOrNull).mockResolvedValue(media);

      const resource = new MediaResource(http, siteId);
      const result = await resource.get('media-1');

      expect(http.getOrNull).toHaveBeenCalledWith('/media/media-1');
      expect(result).toEqual(media);
    });

    it('returns null on 404', async () => {
      const http = createMockHttp();
      vi.mocked(http.getOrNull).mockResolvedValue(null);

      const resource = new MediaResource(http, siteId);
      expect(await resource.get('nonexistent')).toBeNull();
    });

    it('rethrows non-404 errors', async () => {
      const http = createMockHttp();
      vi.mocked(http.getOrNull).mockRejectedValue(new ForjaAuthError());

      const resource = new MediaResource(http, siteId);
      await expect(resource.get('media-1')).rejects.toThrow(ForjaAuthError);
    });
  });
});
