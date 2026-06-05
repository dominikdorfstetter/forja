import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderWithProviders, screen, userEvent, waitFor } from '@/test/test-utils';
import CacheSection from '../CacheSection';
import { getSiteCacheStats, invalidateSiteCache, rebuildSiteCache } from '@/services/cache';

vi.mock('@/services/cache', () => ({
  getSiteCacheStats: vi.fn(),
  invalidateSiteCache: vi.fn(),
  rebuildSiteCache: vi.fn(),
}));

const SITE_ID = '550e8400-e29b-41d4-a716-446655440000';

beforeEach(() => {
  vi.mocked(getSiteCacheStats).mockResolvedValue({
    site_id: SITE_ID,
    entry_count: 3,
    entries: ['social', 'locales', 'blogs:by-slug:hello'],
  });
  vi.mocked(invalidateSiteCache).mockResolvedValue({ invalidated: 3, warmed: [] });
  vi.mocked(rebuildSiteCache).mockResolvedValue({ invalidated: 3, warmed: ['social', 'locales'] });
});

describe('CacheSection', () => {
  it('shows the cached entry count and resource chips', async () => {
    renderWithProviders(<CacheSection siteId={SITE_ID} />);
    expect(await screen.findByText(/3 cached entries/i)).toBeInTheDocument();
    expect(screen.getByText('social')).toBeInTheDocument();
    expect(screen.getByText('blogs:by-slug:hello')).toBeInTheDocument();
  });

  it('invalidates the site cache on Invalidate', async () => {
    renderWithProviders(<CacheSection siteId={SITE_ID} />);
    await screen.findByTestId('site-settings.cache-count');
    await userEvent.setup().click(screen.getByTestId('site-settings.cache-invalidate'));
    await waitFor(() => expect(invalidateSiteCache).toHaveBeenCalledWith(SITE_ID));
  });

  it('rebuilds the site cache on Rebuild', async () => {
    renderWithProviders(<CacheSection siteId={SITE_ID} />);
    await screen.findByTestId('site-settings.cache-count');
    await userEvent.setup().click(screen.getByTestId('site-settings.cache-rebuild'));
    await waitFor(() => expect(rebuildSiteCache).toHaveBeenCalledWith(SITE_ID));
  });
});
