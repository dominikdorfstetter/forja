import { lazy, Suspense, useState } from 'react';
import { Alert, Box, Paper, Skeleton, Stack, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router';

import { useAnalyticsPageDetail } from '@/hooks/useAnalyticsPageDetail';
import PageHeader from '@/components/shared/PageHeader';
import { M3Button } from '@/components/design-system';
import DateRangeBar from './components/DateRangeBar';
import StatCard from './components/StatCard';
import type { DateRangeValue } from './components/DateRangeBar';
import type { TrendDataPoint, ReferrerItem } from '@/types/api';

const TrendChart = lazy(() => import('./components/TrendChart'));
const ReferrerChart = lazy(() => import('./components/ReferrerChart'));

const EMPTY_TREND: TrendDataPoint[] = [];
const EMPTY_REFERRERS: ReferrerItem[] = [];

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

function decodePath(encoded: string | undefined): string {
  if (!encoded) return '';
  try {
    return atob(encoded);
  } catch {
    return '';
  }
}

export default function AnalyticsPageDetail() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { encodedPath } = useParams<{ encodedPath: string }>();
  const path = decodePath(encodedPath);

  const [range, setRange] = useState<DateRangeValue>({ preset: '30d' });
  const { detail, isLoading, error, analyticsEnabled } = useAnalyticsPageDetail(path, range);

  const resolvedPath = detail?.path ?? path;

  const header = (
    <PageHeader
      icon="bar_chart"
      title={resolvedPath || t('analytics.title')}
      subtitle={resolvedPath ? path : undefined}
      breadcrumbs={[
        { label: t('layout.sidebar.analytics'), path: '/analytics' },
        { label: resolvedPath || t('analytics.title') },
      ]}
    />
  );

  if (!analyticsEnabled) {
    return (
      <Box>
        {header}
        <Alert severity="info">{t('analytics.notEnabled')}</Alert>
      </Box>
    );
  }

  if (!path) {
    return (
      <Box>
        {header}
        <Alert severity="warning">Invalid page path</Alert>
      </Box>
    );
  }

  return (
    <Box>
      {header}

      <Box sx={{ mb: 2 }}>
        <M3Button variant="ghost" size="sm" icon="arrow_back" onClick={() => navigate('/analytics')}>
          {t('analytics.backToOverview')}
        </M3Button>
      </Box>

      <DateRangeBar value={range} onChange={setRange} />

      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {String(error)}
        </Alert>
      )}

      <Stack direction="row" spacing={2} useFlexGap sx={{ mt: 3, flexWrap: 'wrap' }}>
        <StatCard label={t('analytics.totalViews')} value={detail?.total_views ?? 0} loading={isLoading} />
        <StatCard label={t('analytics.uniqueVisitors')} value={detail?.total_unique_visitors ?? 0} loading={isLoading} />
      </Stack>

      <Paper elevation={0} sx={surfaceSx}>
        <Typography component="h2" sx={surfaceTitleSx}>
          {t('analytics.trend')}
        </Typography>
        <Suspense fallback={<Skeleton variant="rounded" height={300} />}>
          <TrendChart data={detail?.trend ?? EMPTY_TREND} loading={isLoading} />
        </Suspense>
      </Paper>

      <Paper elevation={0} sx={surfaceSx}>
        <Typography component="h2" sx={surfaceTitleSx}>
          {t('analytics.referrers')}
        </Typography>
        <Suspense fallback={<Skeleton variant="rounded" height={300} />}>
          <ReferrerChart data={detail?.referrers ?? EMPTY_REFERRERS} loading={isLoading} />
        </Suspense>
      </Paper>
    </Box>
  );
}
