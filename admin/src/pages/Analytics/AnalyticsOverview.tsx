import { useState } from 'react';
import { Alert, Box, Paper, Stack, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';

import { useAnalyticsReport } from '@/hooks/useAnalyticsReport';
import DateRangeBar from './components/DateRangeBar';
import StatCard from './components/StatCard';
import TrendChart from './components/TrendChart';
import TopContentTable from './components/TopContentTable';
import type { DateRangeValue } from './components/DateRangeBar';

function computeAvgPerDay(totalViews: number, trendLength: number): number {
  if (trendLength === 0) return 0;
  return Math.round(totalViews / trendLength);
}

export default function AnalyticsOverview() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [range, setRange] = useState<DateRangeValue>({ preset: '30d' });

  const { report, isLoading, error, analyticsEnabled } = useAnalyticsReport(range);

  if (!analyticsEnabled) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="info">{t('analytics.notEnabled')}</Alert>
      </Box>
    );
  }

  const handleRowClick = (path: string) => {
    navigate(`/analytics/page/${btoa(path)}`);
  };

  return (
    <Box sx={{ p: 3 }}>
      <Typography variant="h4" gutterBottom>
        {t('analytics.title')}
      </Typography>

      <DateRangeBar value={range} onChange={setRange} />

      {error && (
        <Alert severity="error" sx={{ mt: 2 }}>
          {String(error)}
        </Alert>
      )}

      <Stack direction="row" spacing={2} sx={{ mt: 3 }} flexWrap="wrap" useFlexGap>
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

      <Paper sx={{ mt: 3, p: 2 }}>
        <Typography variant="h6" gutterBottom>
          {t('analytics.trend')}
        </Typography>
        <TrendChart data={report?.trend ?? []} loading={isLoading} />
      </Paper>

      <Paper sx={{ mt: 3, p: 2 }}>
        <Typography variant="h6" gutterBottom>
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
