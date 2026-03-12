import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { type ReactNode, createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import apiService from '@/services/api';
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
    vi.mocked(apiService.getSites).mockReturnValue(new Promise(() => {}));
    vi.mocked(apiService.getBlogs).mockReturnValue(new Promise(() => {}));
    vi.mocked(apiService.getPages).mockReturnValue(new Promise(() => {}));
    vi.mocked(apiService.getMedia).mockReturnValue(new Promise(() => {}));
    vi.mocked(apiService.getApiKeys).mockReturnValue(new Promise(() => {}));
    vi.mocked(apiService.getHealth).mockReturnValue(new Promise(() => {}));
    vi.mocked(apiService.getSiteLocales).mockReturnValue(new Promise(() => {}));
    vi.mocked(apiService.getNavigationMenus).mockReturnValue(new Promise(() => {}));

    const { result } = renderHook(() => useDashboardData(), { wrapper });

    expect(result.current.totalSites).toBe(0);
    expect(result.current.totalBlogs).toBe(0);
    expect(result.current.totalPages).toBe(0);
    expect(result.current.totalMedia).toBe(0);
    expect(result.current.sitesLoading).toBe(true);
  });

  it('computes status counts from blog and page data', async () => {
    vi.mocked(apiService.getSites).mockResolvedValue([
      { id: 'site-1', name: 'Site', slug: 'site', timezone: 'UTC', is_active: true, created_at: '', updated_at: '' },
    ]);
    vi.mocked(apiService.getBlogs).mockResolvedValue({
      data: [
        { id: 'b1', slug: 'b1', author: 'A', published_date: '', is_featured: false, is_sample: false, status: 'Draft', created_at: '', updated_at: '' },
        { id: 'b2', slug: 'b2', author: 'A', published_date: '', is_featured: false, is_sample: false, status: 'Published', created_at: '', updated_at: '' },
      ],
      meta: { page: 1, page_size: 200, total_items: 2, total_pages: 1 },
    });
    vi.mocked(apiService.getPages).mockResolvedValue({
      data: [
        { id: 'p1', route: '/p1', page_type: 'Static', is_in_navigation: false, status: 'Draft', created_at: '' },
      ],
      meta: { page: 1, page_size: 200, total_items: 1, total_pages: 1 },
    });
    vi.mocked(apiService.getMedia).mockResolvedValue({
      data: [],
      meta: { page: 1, page_size: 1, total_items: 5, total_pages: 5 },
    });
    vi.mocked(apiService.getApiKeys).mockResolvedValue({
      data: [],
      meta: { page: 1, page_size: 25, total_items: 0, total_pages: 0 },
    });
    vi.mocked(apiService.getHealth).mockResolvedValue({
      status: 'healthy',
      version: '1.0.0',
      services: [],
    } as never);
    vi.mocked(apiService.getSiteLocales).mockResolvedValue([]);
    vi.mocked(apiService.getNavigationMenus).mockResolvedValue([]);

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
