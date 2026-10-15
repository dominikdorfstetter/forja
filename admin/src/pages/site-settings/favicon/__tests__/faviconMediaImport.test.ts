import { describe, it, expect, vi, afterEach } from 'vitest';
import { getMediaById } from '@/services/media';
import type { MediaResponse } from '@/types/api';
import { loadMediaAsImageFile } from '../faviconMediaImport';

function mockMedia(patch: Partial<MediaResponse>) {
  vi.mocked(getMediaById).mockResolvedValue({
    public_url: 'https://cdn.test/logo.png',
    original_filename: 'logo.png',
    ...patch,
  } as MediaResponse);
}

function mockFetch(response: { ok: boolean; status?: number; blob?: Blob }) {
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
    ok: response.ok,
    status: response.status ?? 200,
    blob: () => Promise.resolve(response.blob ?? new Blob()),
  }));
}

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('loadMediaAsImageFile', () => {
  it('returns the image as a File named after the original upload', async () => {
    mockMedia({});
    mockFetch({ ok: true, blob: new Blob(['png'], { type: 'image/png' }) });

    const result = await loadMediaAsImageFile('m1');

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.file.name).toBe('logo.png');
      expect(result.file.type).toBe('image/png');
    }
  });

  it('reports media without a public URL', async () => {
    mockMedia({ public_url: null });
    expect(await loadMediaAsImageFile('m1')).toEqual({ ok: false, reason: 'noPublicUrl' });
  });

  it('reports the HTTP status when the download fails', async () => {
    mockMedia({});
    mockFetch({ ok: false, status: 404 });
    expect(await loadMediaAsImageFile('m1')).toEqual({ ok: false, reason: 'fetchFailed', status: 404 });
  });

  it('rejects non-image downloads', async () => {
    mockMedia({});
    mockFetch({ ok: true, blob: new Blob(['%PDF'], { type: 'application/pdf' }) });
    expect(await loadMediaAsImageFile('m1')).toEqual({ ok: false, reason: 'notImage' });
  });

  it('lets API errors propagate to the caller', async () => {
    vi.mocked(getMediaById).mockRejectedValue(new Error('boom'));
    await expect(loadMediaAsImageFile('m1')).rejects.toThrow('boom');
  });
});
