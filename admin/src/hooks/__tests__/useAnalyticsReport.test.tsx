import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import apiService from '@/services/api';
import { useAnalyticsReport } from '../useAnalyticsReport';

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

describe('useAnalyticsReport', () => {
  beforeEach(() => vi.clearAllMocks());

  it('fetches report with days preset', async () => {
    const mockReport = { total_views: 100, total_unique_visitors: 50, top_content: [], trend: [] };
    vi.mocked(apiService.getAnalyticsReport).mockResolvedValue(mockReport);

    const { result } = renderHook(() => useAnalyticsReport({ preset: '30d' }), { wrapper });

    await waitFor(() => expect(result.current.isLoading).toBe(false));
    expect(apiService.getAnalyticsReport).toHaveBeenCalledWith('site-1', { days: 30 });
    expect(result.current.report).toEqual(mockReport);
  });
});
