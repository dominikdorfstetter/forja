import { lazy, Suspense, useState } from 'react';
import { Alert, Box, Paper, Skeleton, Stack, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';

import { useAnalyticsReport } from '@/hooks/useAnalyticsReport';
import PageHeader from '@/components/shared/PageHeader';
import DateRangeBar from './components/DateRangeBar';
import StatCard from './components/StatCard';
import TopContentTable from './components/TopContentTable';
import type { DateRangeValue } from './components/DateRangeBar';
import type { TrendDataPoint } from '@/types/api';

const TrendChart = lazy(() => import('./components/TrendChart'));

const EMPTY_TREND: TrendDataPoint[] = [];

const surfaceSx = {
  mt: 3,
  p: 2.5,
  bgcolor: 'var(--surface-container)',
  border: '1px solid var(--outline-variant)',
  borderRadius: '20px',
  boxShadow: 'none',
};

const surfaceTitleSx = {
  fontSize: 18,
  fontWeight: 600,
  color: 'var(--on-surface)',
  fontVariationSettings: '"wght" 600, "opsz" 18',
  mb: 1.5,
};

function computeAvgPerDay(totalViews: number, trendLength: number): number {
  if (trendLength === 0) return 0;
  return Math.round(totalViews / trendLength);
}

export default function AnalyticsOverview() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [range, setRange] = useState<DateRangeValue>({ preset: '30d' });

  const { report, isLoading, error, analyticsEnabled } = useAnalyticsReport(range);

  const header = (
    <PageHeader
      icon="bar_chart"
      title={t('analytics.title')}
      subtitle={t('analytics.subtitle')}
      breadcrumbs={[{ label: t('layout.sidebar.analytics') }]}
    />
  );

  if (!analyticsEnabled) {
    return (
      <Box data-testid="analytics-dashboard">
        {header}
        <Alert severity="info">{t('analytics.notEnabled')}</Alert>
      </Box>
    );
  }

  const handleRowClick = (path: string) => {
    navigate(`/analytics/page/${btoa(path)}`);
  };

  return (
    <Box data-testid="analytics-dashboard">
      {header}

      <DateRangeBar value={range} onChange={setRange} />

      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {String(error)}
        </Alert>
      )}

      <Stack direction="row" spacing={2} useFlexGap sx={{ mt: 3, flexWrap: 'wrap' }}>
        <StatCard
          label={t('analytics.totalViews')}
          value={report?.total_views ?? 0}
          loading={isLoading}
        />
        <StatCard
          label={t('analytics.uniqueVisitors')}
          value={report?.total_unique_visitors ?? 0}
          loading={isLoading}
        />
        <StatCard
          label={t('analytics.avgViewsPerDay')}
          value={computeAvgPerDay(report?.total_views ?? 0, report?.trend?.length ?? 0)}
          loading={isLoading}
        />
      </Stack>

      <Paper elevation={0} sx={surfaceSx} data-testid="analytics-chart">
        <Typography component="h2" sx={surfaceTitleSx}>
          {t('analytics.trend')}
        </Typography>
        <Suspense fallback={<Skeleton variant="rounded" height={300} />}>
          <TrendChart data={report?.trend ?? EMPTY_TREND} loading={isLoading} />
        </Suspense>
      </Paper>

      <Paper elevation={0} sx={surfaceSx}>
        <Typography component="h2" sx={surfaceTitleSx}>
          {t('analytics.topContent')}
        </Typography>
        <TopContentTable
          items={report?.top_content ?? []}
          onRowClick={handleRowClick}
          loading={isLoading}
        />
      </Paper>
    </Box>
  );
}
