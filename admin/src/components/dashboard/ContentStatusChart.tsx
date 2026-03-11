import { lazy, Suspense } from 'react';
import { Box, Skeleton, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import type { ContentStatus } from '@/types/api';

const ContentStatusChartInner = lazy(() => import('./ContentStatusChartInner'));

interface ContentStatusChartProps {
  statusCounts: Record<ContentStatus, number>;
  loading?: boolean;
}

export default function ContentStatusChart({ statusCounts, loading }: ContentStatusChartProps) {
  const { t } = useTranslation();

  const total = Object.values(statusCounts).reduce((sum, n) => sum + n, 0);

  if (loading) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
        <Skeleton variant="circular" width={180} height={180} />
      </Box>
    );
  }

  if (total === 0) {
    return (
      <Typography color="text.secondary" sx={{ py: 6, textAlign: 'center' }}>
        {t('dashboard.chart.noContent')}
      </Typography>
    );
  }

  return (
    <Suspense
      fallback={
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <Skeleton variant="circular" width={180} height={180} />
        </Box>
      }
    >
      <ContentStatusChartInner statusCounts={statusCounts} />
    </Suspense>
  );
}
