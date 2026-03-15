import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, fireEvent } from '@testing-library/react';
import { renderWithProviders } from '@/test/test-utils';
import apiService from '@/services/api';
import AnalyticsOverview from '../AnalyticsOverview';

vi.mock('@/store/SiteContext', () => ({
  useSiteContext: () => ({ selectedSiteId: 'site-1' }),
  SiteProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/hooks/useSiteContextData', () => ({
  useSiteContextData: () => ({ context: { features: { analytics: true } } }),
}));

const mockNavigate = vi.fn();
vi.mock('react-router', async () => {
  const actual = await vi.importActual('react-router');
  return { ...actual, useNavigate: () => mockNavigate };
});

const mockReport = {
  total_views: 1234,
  total_unique_visitors: 567,
  top_content: [
    { path: '/blog/post-1', total_views: 100, unique_visitors: 50 },
    { path: '/blog/post-2', total_views: 80, unique_visitors: 40 },
  ],
  trend: [
    { date: '2026-03-01', total_views: 100, unique_visitors: 50 },
    { date: '2026-03-02', total_views: 120, unique_visitors: 60 },
  ],
};

describe('AnalyticsOverview', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(apiService.getAnalyticsReport).mockResolvedValue(mockReport);
  });

  it('renders stat cards with report data', async () => {
    renderWithProviders(<AnalyticsOverview />);
    expect(await screen.findByText('1,234')).toBeInTheDocument();
    expect(await screen.findByText('567')).toBeInTheDocument();
  });

  it('renders top content table', async () => {
    renderWithProviders(<AnalyticsOverview />);
    expect(await screen.findByText('/blog/post-1')).toBeInTheDocument();
    expect(await screen.findByText('/blog/post-2')).toBeInTheDocument();
  });

  it('navigates to page detail on row click', async () => {
    renderWithProviders(<AnalyticsOverview />);
    const row = await screen.findByText('/blog/post-1');
    fireEvent.click(row);
    expect(mockNavigate).toHaveBeenCalledWith(
      `/analytics/page/${btoa('/blog/post-1')}`,
    );
  });
});
