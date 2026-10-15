import { useState } from 'react';
import { Box } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { M3Button } from '@/components/design-system';
import {
  WorkbenchHeader,
  FocusCards,
  WorkbenchFeed,
  HealthStrip,
  AnalyticsStrip,
  type WorkbenchFilter,
} from '@/components/dashboard/workbench';
import type { useDashboardData } from '@/hooks/useDashboardData';
import { focusCardFilter } from './dashboardHomeUtils';

interface DashboardWorkbenchProps {
  siteName: string | null;
  dashboard: ReturnType<typeof useDashboardData>;
  canWrite: boolean;
  onQuickPost: () => void;
}

/** "Your workbench" for the selected site: focus tiles, review feed, health. */
export default function DashboardWorkbench({ siteName, dashboard, canWrite, onQuickPost }: DashboardWorkbenchProps) {
  const { t } = useTranslation();
  const [workbenchFilter, setWorkbenchFilter] = useState<WorkbenchFilter>('attention');
  const { blogStatusCounts, pageStatusCounts } = dashboard;

  const workbenchActions = canWrite ? (
    <M3Button
      size="md"
      icon="bolt"
      onClick={onQuickPost}
      data-testid="dashboard.btn.quick-post"
    >
      {t('quickPost.dashboardButton')}
    </M3Button>
  ) : undefined;

  return (
    <>
      <WorkbenchHeader siteName={siteName} actions={workbenchActions} />

      <FocusCards
        needsReviewCount={blogStatusCounts.InReview + pageStatusCounts.InReview}
        draftsCount={blogStatusCounts.Draft + pageStatusCounts.Draft}
        scheduledCount={blogStatusCounts.Scheduled + pageStatusCounts.Scheduled}
        activeFilter={focusCardFilter(workbenchFilter)}
        onFilterChange={(k) => setWorkbenchFilter(k)}
      />

      <WorkbenchFeed
        inReviewBlogs={dashboard.inReviewBlogs}
        inReviewPages={dashboard.inReviewPages}
        draftBlogs={dashboard.draftBlogs}
        draftPages={dashboard.draftPages}
        blogStatusCounts={blogStatusCounts}
        pageStatusCounts={pageStatusCounts}
        filter={workbenchFilter}
        onFilterChange={setWorkbenchFilter}
        loading={dashboard.blogsLoading || dashboard.pagesLoading}
      />

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
          gap: 1.75,
          mt: 2.5,
          mb: 3,
        }}
      >
        <HealthStrip healthData={dashboard.healthData} loading={dashboard.healthLoading} />
        <AnalyticsStrip />
      </Box>
    </>
  );
}
