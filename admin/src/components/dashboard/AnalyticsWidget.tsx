import { useState } from 'react';
import {
  Box,
  Paper,
  Skeleton,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import BarChartIcon from '@mui/icons-material/BarChart';
import { useTranslation } from 'react-i18next';

import { useAnalyticsData } from '@/hooks/useAnalyticsData';

export default function AnalyticsWidget() {
  const { t } = useTranslation();
  const [days, setDays] = useState<number>(30);
  const { report, isLoading, analyticsEnabled } = useAnalyticsData(days);

  if (!analyticsEnabled) {
    return null;
  }

  const hasData = report && (report.total_views > 0 || report.top_content.length > 0);

  return (
    <Paper sx={{ p: 3 }}>
      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}>
        <Stack direction="row" alignItems="center" spacing={1}>
          <BarChartIcon color="primary" />
          <Typography variant="h6" component="h2">
            {t('dashboard.analytics.pageViews', 'Page Views')}
          </Typography>
        </Stack>
        <ToggleButtonGroup
          value={days}
          exclusive
          onChange={(_, value) => {
            if (value !== null) setDays(value);
          }}
          size="small"
        >
          <ToggleButton value={7}>7d</ToggleButton>
          <ToggleButton value={30}>30d</ToggleButton>
        </ToggleButtonGroup>
      </Stack>

      {isLoading ? (
        <Stack spacing={1.5}>
          <Stack direction="row" spacing={3}>
            <Skeleton variant="rounded" width={120} height={48} />
            <Skeleton variant="rounded" width={120} height={48} />
          </Stack>
          <Skeleton variant="rounded" height={120} />
        </Stack>
      ) : !hasData ? (
        <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
          {t('dashboard.analytics.noData', 'No pageview data yet')}
        </Typography>
      ) : (
        <>
          <Stack direction="row" spacing={3} sx={{ mb: 2 }}>
            <Box>
              <Typography variant="caption" color="text.secondary">
                {t('dashboard.analytics.totalViews', 'Total Views')}
              </Typography>
              <Typography variant="h5" fontWeight="bold">
                {report!.total_views.toLocaleString()}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">
                {t('dashboard.analytics.uniqueVisitors', 'Unique Visitors')}
              </Typography>
              <Typography variant="h5" fontWeight="bold">
                {report!.total_unique_visitors.toLocaleString()}
              </Typography>
            </Box>
          </Stack>

          {report!.top_content.length > 0 && (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>{t('dashboard.analytics.path', 'Path')}</TableCell>
                    <TableCell align="right">{t('dashboard.analytics.views', 'Views')}</TableCell>
                    <TableCell align="right">{t('dashboard.analytics.visitors', 'Visitors')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {report!.top_content.slice(0, 5).map((item) => (
                    <TableRow key={item.path}>
                      <TableCell sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {item.path}
                      </TableCell>
                      <TableCell align="right">{item.total_views.toLocaleString()}</TableCell>
                      <TableCell align="right">{item.unique_visitors.toLocaleString()}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </>
      )}
    </Paper>
  );
}
