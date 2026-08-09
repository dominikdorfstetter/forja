import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { type ReactNode, createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { usePreviewUrl } from '../usePreviewUrl';
import { getPreviewToken } from '@/services/sites';
vi.mock('@/store/SiteContext', () => ({
  useSiteContext: () => ({
    selectedSiteId: 'site-1',
    setSelectedSiteId: vi.fn(),
    selectedSite: undefined,
    sites: [],
    isLoading: false,
  }),
}));

let queryClient: QueryClient;

function wrapper({ children }: { children: ReactNode }) {
  return createElement(QueryClientProvider, { client: queryClient }, children);
}

beforeEach(() => {
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  vi.restoreAllMocks();
});

describe('usePreviewUrl', () => {
  it('returns empty templates when no settings cached', () => {
    const { result } = renderHook(() => usePreviewUrl(), { wrapper });
    expect(result.current.templates).toEqual([]);
    expect(result.current.hasPreview).toBe(false);
  });

  it('returns templates from cached settings', () => {
    queryClient.setQueryData(['site-settings', 'site-1'], {
      preview_templates: [{ name: 'Main', url: 'https://example.com' }],
    });

    const { result } = renderHook(() => usePreviewUrl(), { wrapper });
    expect(result.current.templates).toHaveLength(1);
    expect(result.current.hasPreview).toBe(true);
  });

  it('openPreview opens preview URL with token', async () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    vi.mocked(getPreviewToken).mockResolvedValue({
      token: 'test-jwt-token',
      expires_at: Date.now() / 1000 + 300,
    });

    queryClient.setQueryData(['site-settings', 'site-1'], {
      preview_templates: [{ name: 'Main', url: 'https://example.com/' }],
    });

    const { result } = renderHook(() => usePreviewUrl(), { wrapper });

    await act(async () => result.current.openPreview('/blog/hello'));
    expect(getPreviewToken).toHaveBeenCalledWith('site-1');
    expect(openSpy).toHaveBeenCalledWith(
      'https://example.com/preview/blog/hello?token=test-jwt-token',
      '_blank',
      'noopener,noreferrer',
    );
  });

  it('openPreview does nothing when no templates exist', async () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    const { result } = renderHook(() => usePreviewUrl(), { wrapper });

    await act(async () => result.current.openPreview('/test'));
    expect(openSpy).not.toHaveBeenCalled();
  });

  it('openPreview uses explicit templateUrl over default', async () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    vi.mocked(getPreviewToken).mockResolvedValue({
      token: 'abc123',
      expires_at: Date.now() / 1000 + 300,
    });

    queryClient.setQueryData(['site-settings', 'site-1'], {
      preview_templates: [{ name: 'Main', url: 'https://example.com' }],
    });

    const { result } = renderHook(() => usePreviewUrl(), { wrapper });

    await act(async () =>
      result.current.openPreview('/page/about', 'https://other.com'),
    );
    expect(openSpy).toHaveBeenCalledWith(
      'https://other.com/preview/page/about?token=abc123',
      '_blank',
      'noopener,noreferrer',
    );
  });

  it('falls back to direct URL when token fetch fails', async () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    vi.mocked(getPreviewToken).mockRejectedValue(new Error('Not configured'));

    queryClient.setQueryData(['site-settings', 'site-1'], {
      preview_templates: [{ name: 'Main', url: 'https://example.com' }],
    });

    const { result } = renderHook(() => usePreviewUrl(), { wrapper });

    await act(async () => result.current.openPreview('/blog/hello'));
    expect(openSpy).toHaveBeenCalledWith(
      'https://example.com/blog/hello',
      '_blank',
      'noopener,noreferrer',
    );
  });
});
