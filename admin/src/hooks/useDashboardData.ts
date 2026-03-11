import { useQuery } from '@tanstack/react-query';
import apiService from '@/services/api';
import { useSiteContext } from '@/store/SiteContext';
import { useAuth } from '@/store/AuthContext';
import type { ContentStatus, BlogListItem, PageListItem } from '@/types/api';

interface DashboardData {
  // Totals
  totalSites: number;
  totalBlogs: number;
  totalPages: number;
  totalMedia: number;
  totalApiKeys: number;

  // Status counts (combined blog + page)
  statusCounts: Record<ContentStatus, number>;
  blogStatusCounts: Record<ContentStatus, number>;
  pageStatusCounts: Record<ContentStatus, number>;

  // Content lists
  recentBlogs: BlogListItem[];
  allPages: PageListItem[];
  inReviewBlogs: BlogListItem[];
  inReviewPages: PageListItem[];
  draftBlogs: BlogListItem[];
  draftPages: PageListItem[];
  publishedBlogs: BlogListItem[];

  // Admin data
  healthData: Awaited<ReturnType<typeof apiService.getHealth>> | undefined;
  apiKeysData: Awaited<ReturnType<typeof apiService.getApiKeys>> | undefined;

  // Setup checklist
  siteLocales: Awaited<ReturnType<typeof apiService.getSiteLocales>> | undefined;
  navMenus: Awaited<ReturnType<typeof apiService.getNavigationMenus>> | undefined;

  // Loading states
  sitesLoading: boolean;
  blogsLoading: boolean;
  pagesLoading: boolean;
  mediaLoading: boolean;
  apiKeysLoading: boolean;
  healthLoading: boolean;
}

const EMPTY_STATUS: Record<ContentStatus, number> = {
  Draft: 0,
  InReview: 0,
  Scheduled: 0,
  Published: 0,
  Archived: 0,
};

function countStatuses<T extends { status: ContentStatus }>(items: T[]): Record<ContentStatus, number> {
  const counts = { ...EMPTY_STATUS };
  for (const item of items) {
    counts[item.status] = (counts[item.status] ?? 0) + 1;
  }
  return counts;
}

export function useDashboardData(): DashboardData {
  const { selectedSiteId } = useSiteContext();
  const { isAdmin, isMaster } = useAuth();
  const hasSite = !!selectedSiteId;

  // --- Shared queries ---

  const { data: sitesData, isLoading: sitesLoading } = useQuery({
    queryKey: ['sites'],
    queryFn: () => apiService.getSites(),
  });

  const { data: blogsData, isLoading: blogsLoading } = useQuery({
    queryKey: ['dashboard-blogs', selectedSiteId],
    queryFn: () => apiService.getBlogs(selectedSiteId!, { page: 1, per_page: 200, exclude_status: 'Archived' }),
    enabled: hasSite,
  });

  const { data: pagesData, isLoading: pagesLoading } = useQuery({
    queryKey: ['dashboard-pages', selectedSiteId],
    queryFn: () => apiService.getPages(selectedSiteId!, { page: 1, per_page: 200, exclude_status: 'Archived' }),
    enabled: hasSite,
  });

  const { data: mediaData, isLoading: mediaLoading } = useQuery({
    queryKey: ['media', selectedSiteId],
    queryFn: () => apiService.getMedia(selectedSiteId!, { page: 1, per_page: 1 }),
    enabled: hasSite,
  });

  // --- Admin+ queries ---

  const { data: apiKeysData, isLoading: apiKeysLoading } = useQuery({
    queryKey: ['apiKeys', selectedSiteId],
    queryFn: () => apiService.getApiKeys({
      site_id: isMaster ? undefined : selectedSiteId || undefined,
    }),
    enabled: isAdmin && (isMaster || !!selectedSiteId),
  });

  const { data: healthData, isLoading: healthLoading } = useQuery({
    queryKey: ['health'],
    queryFn: () => apiService.getHealth(),
    refetchInterval: 30_000,
  });

  // --- Setup checklist queries ---

  const { data: siteLocales } = useQuery({
    queryKey: ['siteLocales', selectedSiteId],
    queryFn: () => apiService.getSiteLocales(selectedSiteId!),
    enabled: hasSite,
  });

  const { data: navMenus } = useQuery({
    queryKey: ['navigationMenus', selectedSiteId],
    queryFn: () => apiService.getNavigationMenus(selectedSiteId!),
    enabled: hasSite,
  });

  // --- Derived data ---

  const allBlogs = blogsData?.data ?? [];
  const allPages = pagesData?.data ?? [];

  const blogStatusCounts = countStatuses(allBlogs);
  const pageStatusCounts = countStatuses(allPages);

  const statusCounts: Record<ContentStatus, number> = {
    Draft: blogStatusCounts.Draft + pageStatusCounts.Draft,
    InReview: blogStatusCounts.InReview + pageStatusCounts.InReview,
    Scheduled: blogStatusCounts.Scheduled + pageStatusCounts.Scheduled,
    Published: blogStatusCounts.Published + pageStatusCounts.Published,
    Archived: blogStatusCounts.Archived + pageStatusCounts.Archived,
  };

  const draftBlogs = allBlogs.filter((b) => b.status === 'Draft');
  const draftPages = allPages.filter((p) => p.status === 'Draft');
  const inReviewBlogs = allBlogs.filter((b) => b.status === 'InReview');
  const inReviewPages = allPages.filter((p) => p.status === 'InReview');
  const publishedBlogs = allBlogs.filter((b) => b.status === 'Published');

  // Recent blogs sorted by updated_at descending
  const recentBlogs = [...allBlogs].sort(
    (a, b) => new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime(),
  );

  return {
    totalSites: sitesData?.length ?? 0,
    totalBlogs: blogsData?.meta?.total_items ?? 0,
    totalPages: pagesData?.meta?.total_items ?? 0,
    totalMedia: mediaData?.meta?.total_items ?? 0,
    totalApiKeys: apiKeysData?.meta?.total_items ?? apiKeysData?.data?.length ?? 0,

    statusCounts,
    blogStatusCounts,
    pageStatusCounts,

    recentBlogs,
    allPages,
    inReviewBlogs,
    inReviewPages,
    draftBlogs,
    draftPages,
    publishedBlogs,

    healthData,
    apiKeysData,

    siteLocales,
    navMenus,

    sitesLoading,
    blogsLoading,
    pagesLoading,
    mediaLoading,
    apiKeysLoading,
    healthLoading,
  };
}
