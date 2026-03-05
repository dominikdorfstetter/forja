import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import apiService from '@/services/api';
import { useMediaUrl } from '../useMediaUrl';

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe('useMediaUrl', () => {
  it('returns public_url for a valid media ID', async () => {
    vi.mocked(apiService.getMediaById).mockResolvedValue({
      id: 'media-1',
      filename: 'photo.jpg',
      original_filename: 'photo.jpg',
      mime_type: 'image/jpeg',
      file_size: 1024,
      storage_provider: 'local',
      public_url: 'https://cdn.example.com/photo.jpg',
      is_global: false,
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
      variants: [],
    });

    const { result } = renderHook(() => useMediaUrl('media-1'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(result.current).toBe('https://cdn.example.com/photo.jpg');
    });
    expect(apiService.getMediaById).toHaveBeenCalledWith('media-1');
  });

  it('returns undefined when no media ID is provided', () => {
    const { result } = renderHook(() => useMediaUrl(null), {
      wrapper: createWrapper(),
    });

    expect(result.current).toBeUndefined();
    expect(apiService.getMediaById).not.toHaveBeenCalled();
  });

  it('returns undefined when media ID is undefined', () => {
    const { result } = renderHook(() => useMediaUrl(undefined), {
      wrapper: createWrapper(),
    });

    expect(result.current).toBeUndefined();
    expect(apiService.getMediaById).not.toHaveBeenCalled();
  });

  it('returns undefined when media has no public_url', async () => {
    vi.mocked(apiService.getMediaById).mockResolvedValue({
      id: 'media-2',
      filename: 'file.bin',
      original_filename: 'file.bin',
      mime_type: 'application/octet-stream',
      file_size: 512,
      storage_provider: 'local',
      public_url: undefined,
      is_global: false,
      created_at: '2025-01-01T00:00:00Z',
      updated_at: '2025-01-01T00:00:00Z',
      variants: [],
    });

    const { result } = renderHook(() => useMediaUrl('media-2'), {
      wrapper: createWrapper(),
    });

    await waitFor(() => {
      expect(apiService.getMediaById).toHaveBeenCalledWith('media-2');
    });
    expect(result.current).toBeUndefined();
  });
});
