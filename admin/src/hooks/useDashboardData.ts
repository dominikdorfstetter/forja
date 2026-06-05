import { useQuery } from '@tanstack/react-query';
import { getBlogs } from '@/services/blogs';
import { getHealth } from '@/services/health';
import { getMedia } from '@/services/media';
import { getNavigationMenus } from '@/services/navigation';
import { getPages } from '@/services/pages';
import { getSiteLocales } from '@/services/siteLocales';
import { getSites } from '@/services/sites';
import { useSiteContext } from '@/store/SiteContext';
import type { ContentStatus, BlogListItem, PageListItem } from '@/types/api';

interface DashboardData {
  // Totals
  totalSites: number;
  totalBlogs: number;
  totalPages: number;
  totalMedia: number;

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

  // Health data for the Workbench HealthStrip
  healthData: Awaited<ReturnType<typeof getHealth>> | undefined;

  // Setup checklist
  siteLocales: Awaited<ReturnType<typeof getSiteLocales>> | undefined;
  navMenus: Awaited<ReturnType<typeof getNavigationMenus>> | undefined;
  hasSampleContent: boolean;
  hasPublished: boolean;

  // Loading states
  sitesLoading: boolean;
  blogsLoading: boolean;
  pagesLoading: boolean;
  mediaLoading: boolean;
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
  const hasSite = !!selectedSiteId;

  // --- Shared queries ---

  const { data: sitesData, isLoading: sitesLoading } = useQuery({
    queryKey: ['sites'],
    queryFn: () => getSites(),
  });

  const { data: blogsData, isLoading: blogsLoading } = useQuery({
    queryKey: ['dashboard-blogs', selectedSiteId],
    queryFn: () => getBlogs(selectedSiteId!, { page: 1, page_size: 200, exclude_status: 'Archived' }),
    enabled: hasSite,
  });

  const { data: pagesData, isLoading: pagesLoading } = useQuery({
    queryKey: ['dashboard-pages', selectedSiteId],
    queryFn: () => getPages(selectedSiteId!, { page: 1, page_size: 200, exclude_status: 'Archived' }),
    enabled: hasSite,
  });

  const { data: mediaData, isLoading: mediaLoading } = useQuery({
    queryKey: ['media', selectedSiteId],
    queryFn: () => getMedia(selectedSiteId!, { page: 1, page_size: 1 }),
    enabled: hasSite,
  });

  const { data: healthData, isLoading: healthLoading } = useQuery({
    queryKey: ['health'],
    queryFn: () => getHealth(),
    refetchInterval: 30_000,
  });

  // --- Setup checklist queries ---

  const { data: siteLocales } = useQuery({
    queryKey: ['siteLocales', selectedSiteId],
    queryFn: () => getSiteLocales(selectedSiteId!),
    enabled: hasSite,
  });

  const { data: navMenus } = useQuery({
    queryKey: ['navigationMenus', selectedSiteId],
    queryFn: () => getNavigationMenus(selectedSiteId!),
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

  const hasSampleContent = allBlogs.some((b) => b.is_sample);
  const hasPublished = publishedBlogs.length > 0;

  return {
    totalSites: sitesData?.length ?? 0,
    totalBlogs: blogsData?.meta?.total_items ?? 0,
    totalPages: pagesData?.meta?.total_items ?? 0,
    totalMedia: mediaData?.meta?.total_items ?? 0,

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

    hasSampleContent,
    hasPublished,

    healthData,

    siteLocales,
    navMenus,

    sitesLoading,
    blogsLoading,
    pagesLoading,
    mediaLoading,
    healthLoading,
  };
}
