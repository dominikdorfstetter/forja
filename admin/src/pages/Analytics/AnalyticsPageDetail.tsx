import { useState } from 'react';
import { Alert, Box, Button, Paper, Stack, Typography } from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { useTranslation } from 'react-i18next';
import { useNavigate, useParams } from 'react-router';

import { useAnalyticsPageDetail } from '@/hooks/useAnalyticsPageDetail';
import DateRangeBar from './components/DateRangeBar';
import StatCard from './components/StatCard';
import TrendChart from './components/TrendChart';
import ReferrerChart from './components/ReferrerChart';
import type { DateRangeValue } from './components/DateRangeBar';

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

  if (!analyticsEnabled) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="info">{t('analytics.notEnabled')}</Alert>
      </Box>
    );
  }

  if (!path) {
    return (
      <Box sx={{ p: 3 }}>
        <Alert severity="warning">Invalid page path</Alert>
      </Box>
    );
  }

  return (
    <Box sx={{ p: 3 }}>
      <Button
        startIcon={<ArrowBackIcon />}
        onClick={() => navigate('/analytics')}
        sx={{ mb: 2 }}
      >
        {t('analytics.backToOverview')}
      </Button>

      <Typography variant="h5" gutterBottom>
        {detail?.path ?? path}
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
          value={detail?.total_views ?? 0}
          loading={isLoading}
        />
        <StatCard
          label={t('analytics.uniqueVisitors')}
          value={detail?.total_unique_visitors ?? 0}
          loading={isLoading}
        />
      </Stack>

      <Paper sx={{ mt: 3, p: 2 }}>
        <Typography variant="h6" gutterBottom>
          {t('analytics.trend')}
        </Typography>
        <TrendChart data={detail?.trend ?? []} loading={isLoading} />
      </Paper>

      <Paper sx={{ mt: 3, p: 2 }}>
        <Typography variant="h6" gutterBottom>
          {t('analytics.referrers')}
        </Typography>
        <ReferrerChart data={detail?.referrers ?? []} loading={isLoading} />
      </Paper>
    </Box>
  );
}
