import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen } from '@testing-library/react';
import { renderWithProviders } from '@/test/test-utils';
import { getAnalyticsPageDetail } from '@/services/analytics';
import AnalyticsPageDetail from '../AnalyticsPageDetail';

vi.mock('@/store/SiteContext', () => ({
  useSiteContext: () => ({ selectedSiteId: 'site-1' }),
  SiteProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock('@/hooks/useSiteContextData', () => ({
  useSiteContextData: () => ({ context: { features: { analytics: true } } }),
}));

vi.mock('react-router', async () => {
  const actual = await vi.importActual('react-router');
  return {
    ...actual,
    useParams: () => ({ encodedPath: btoa('/blog/post-1') }),
    useNavigate: () => vi.fn(),
  };
});

const mockDetail = {
  path: '/blog/post-1',
  total_views: 100,
  total_unique_visitors: 50,
  trend: [{ date: '2026-03-01', total_views: 100, unique_visitors: 50 }],
  referrers: [
    { domain: 'google.com', views: 60 },
    { domain: '(direct)', views: 40 },
  ],
};

describe('AnalyticsPageDetail', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getAnalyticsPageDetail).mockResolvedValue(mockDetail);
  });

  it('renders page path in heading', async () => {
    renderWithProviders(<AnalyticsPageDetail />);
    // The path renders both as the H1 title and as the last breadcrumb
    // segment; target the heading specifically.
    expect(await screen.findByRole('heading', { level: 1, name: '/blog/post-1' })).toBeInTheDocument();
  });

  it('renders stat cards', async () => {
    renderWithProviders(<AnalyticsPageDetail />);
    expect(await screen.findByText('100', {}, { timeout: 10_000 })).toBeInTheDocument();
    expect(await screen.findByText('50')).toBeInTheDocument();
  }, 15_000);

  it('renders back link', async () => {
    renderWithProviders(<AnalyticsPageDetail />);
    expect(await screen.findByText(/back to analytics/i)).toBeInTheDocument();
  });
});
