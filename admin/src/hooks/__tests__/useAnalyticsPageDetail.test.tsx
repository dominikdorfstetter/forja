import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import apiService from '@/services/api';
import { useAnalyticsPageDetail } from '../useAnalyticsPageDetail';

vi.mock('@/store/SiteContext', () => ({
  useSiteContext: () => ({ selectedSiteId: 'site-1' }),
}));

vi.mock('@/hooks/useSiteContextData', () => ({
  useSiteContextData: () => ({ context: { features: { analytics: true } } }),
}));

const wrapper = ({ children }: { children: React.ReactNode }) => {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
};

describe('useAnalyticsPageDetail', () => {
  beforeEach(() => vi.clearAllMocks());

  it('fetches page detail with path and days', async () => {
    const mockDetail = {
      path: '/blog/post-1',
      total_views: 100,
      total_unique_visitors: 50,
      trend: [],
      referrers: [],
    };
    vi.mocked(apiService.getAnalyticsPageDetail).mockResolvedValue(mockDetail);

    const { result } = renderHook(
      () => useAnalyticsPageDetail('/blog/post-1', { preset: '30d' }),
      { wrapper },
    );

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(apiService.getAnalyticsPageDetail).toHaveBeenCalledWith('site-1', {
      path: '/blog/post-1',
      days: 30,
    });
    expect(result.current.detail).toEqual(mockDetail);
  });
});
