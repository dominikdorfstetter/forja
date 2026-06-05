import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { type ReactNode, createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { getApiKeys } from '@/services/apiKeys';
import { getBlogs } from '@/services/blogs';
import { getHealth } from '@/services/health';
import { getMedia } from '@/services/media';
import { getNavigationMenus } from '@/services/navigation';
import { getPages } from '@/services/pages';
import { getSiteLocales } from '@/services/siteLocales';
import { getSites } from '@/services/sites';
import { useDashboardData } from '../useDashboardData';

vi.mock('@/store/SiteContext', () => ({
  useSiteContext: () => ({
    selectedSiteId: 'site-1',
    setSelectedSiteId: vi.fn(),
    selectedSite: undefined,
    sites: [],
    isLoading: false,
  }),
}));

vi.mock('@/store/AuthContext', () => ({
  useAuth: () => ({
    isAdmin: true,
    isMaster: false,
    permission: 'Admin',
    loading: false,
    canRead: true,
    canWrite: true,
    canManageMembers: true,
    canEditAll: true,
    isOwner: false,
    isSystemAdmin: false,
    isGuest: false,
    memberships: [],
    siteId: null,
    logout: vi.fn(),
    refreshAuth: vi.fn(),
    currentSiteRole: 'admin',
    clerkUserId: 'clerk-1',
    userEmail: 'test@example.com',
    userFullName: 'Test User',
    userImageUrl: null,
    getRoleForSite: () => 'admin',
  }),
}));

let queryClient: QueryClient;

function wrapper({ children }: { children: ReactNode }) {
  return createElement(QueryClientProvider, { client: queryClient }, children);
}

beforeEach(() => {
  vi.clearAllMocks();
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
});

describe('useDashboardData', () => {
  it('returns zero totals and loading states initially', () => {
    // Never-resolving promises to keep loading state
    vi.mocked(getSites).mockReturnValue(new Promise(() => {}));
    vi.mocked(getBlogs).mockReturnValue(new Promise(() => {}));
    vi.mocked(getPages).mockReturnValue(new Promise(() => {}));
    vi.mocked(getMedia).mockReturnValue(new Promise(() => {}));
    vi.mocked(getApiKeys).mockReturnValue(new Promise(() => {}));
    vi.mocked(getHealth).mockReturnValue(new Promise(() => {}));
    vi.mocked(getSiteLocales).mockReturnValue(new Promise(() => {}));
    vi.mocked(getNavigationMenus).mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useDashboardData(), { wrapper });

    expect(result.current.totalSites).toBe(0);
    expect(result.current.totalBlogs).toBe(0);
    expect(result.current.totalPages).toBe(0);
    expect(result.current.totalMedia).toBe(0);
    expect(result.current.sitesLoading).toBe(true);
  });

  it('computes status counts from blog and page data', async () => {
    vi.mocked(getSites).mockResolvedValue([
      { id: 'site-1', name: 'Site', slug: 'site', timezone: 'UTC', is_active: true, created_at: '', updated_at: '' },
    ]);
    vi.mocked(getBlogs).mockResolvedValue({
      data: [
        { id: 'b1', content_id: 'c1', slug: 'b1', author: 'A', published_date: '', is_featured: false, is_sample: false, status: 'Draft', created_at: '', updated_at: '' },
        { id: 'b2', content_id: 'c2', slug: 'b2', author: 'A', published_date: '', is_featured: false, is_sample: false, status: 'Published', created_at: '', updated_at: '' },
      ],
      meta: { page: 1, page_size: 200, total_items: 2, total_pages: 1 },
    });
    vi.mocked(getPages).mockResolvedValue({
      data: [
        { id: 'p1', route: '/p1', page_type: 'Static', is_in_navigation: false, status: 'Draft', created_at: '' },
      ],
      meta: { page: 1, page_size: 200, total_items: 1, total_pages: 1 },
    });
    vi.mocked(getMedia).mockResolvedValue({
      data: [],
      meta: { page: 1, page_size: 1, total_items: 5, total_pages: 5 },
    });
    vi.mocked(getApiKeys).mockResolvedValue({
      data: [],
      meta: { page: 1, page_size: 25, total_items: 0, total_pages: 0 },
    });
    vi.mocked(getHealth).mockResolvedValue({
      status: 'healthy',
      version: '1.0.0',
      services: [],
    } as never);
    vi.mocked(getSiteLocales).mockResolvedValue([]);
    vi.mocked(getNavigationMenus).mockResolvedValue([]);

    const { result } = renderHook(() => useDashboardData(), { wrapper });

    await waitFor(() => {
      expect(result.current.totalSites).toBe(1);
    });

    expect(result.current.totalBlogs).toBe(2);
    expect(result.current.totalPages).toBe(1);
    expect(result.current.totalMedia).toBe(5);

    // Combined status counts
    expect(result.current.statusCounts.Draft).toBe(2); // 1 blog + 1 page
    expect(result.current.statusCounts.Published).toBe(1);

    // Blog-specific
    expect(result.current.blogStatusCounts.Draft).toBe(1);
    expect(result.current.draftBlogs).toHaveLength(1);
    expect(result.current.publishedBlogs).toHaveLength(1);
  });
});
