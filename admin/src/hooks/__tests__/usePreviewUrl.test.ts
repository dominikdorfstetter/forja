import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { type ReactNode, createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { usePreviewUrl } from '../usePreviewUrl';

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

  it('openPreview opens a new window with correct URL', () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    queryClient.setQueryData(['site-settings', 'site-1'], {
      preview_templates: [{ name: 'Main', url: 'https://example.com/' }],
    });

    const { result } = renderHook(() => usePreviewUrl(), { wrapper });

    act(() => result.current.openPreview('/blog/hello'));
    expect(openSpy).toHaveBeenCalledWith(
      'https://example.com/blog/hello',
      '_blank',
    );
  });

  it('openPreview does nothing when no templates exist', () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);
    const { result } = renderHook(() => usePreviewUrl(), { wrapper });

    act(() => result.current.openPreview('/test'));
    expect(openSpy).not.toHaveBeenCalled();
  });

  it('openPreview uses explicit templateUrl over default', () => {
    const openSpy = vi.spyOn(window, 'open').mockImplementation(() => null);

    queryClient.setQueryData(['site-settings', 'site-1'], {
      preview_templates: [{ name: 'Main', url: 'https://example.com' }],
    });

    const { result } = renderHook(() => usePreviewUrl(), { wrapper });

    act(() =>
      result.current.openPreview('/page', 'https://other.com'),
    );
    expect(openSpy).toHaveBeenCalledWith(
      'https://other.com/page',
      '_blank',
    );
  });
});
