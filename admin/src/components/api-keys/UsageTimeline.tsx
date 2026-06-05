import { Box, Typography, useTheme } from '@mui/material';
// react-doctor-disable-next-line heavy-library
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { useTranslation } from 'react-i18next';
import type { DailyUsageSummary } from '@/types/api';

interface UsageTimelineProps {
  daily: DailyUsageSummary[];
}

export default function UsageTimeline({ daily }: UsageTimelineProps) {
  const { t } = useTranslation();
  const theme = useTheme();

  if (daily.length === 0) {
    return (
      <Box data-testid="usage-timeline" sx={{ py: 2 }}>
        <Typography variant="body2" color="text.secondary" sx={{ textAlign: "center" }}>
          {t('apiKeys.usageDialog.noUsage')}
        </Typography>
      </Box>
    );
  }

  // Reverse so earliest date is on the left
  const chartData = [...daily].reverse().map((d) => ({
    date: d.date.slice(5), // "MM-DD" format
    successful: d.successful,
    failed: d.failed,
  }));

  return (
    <Box data-testid="usage-timeline">
      <Typography variant="subtitle2" sx={{ mb: 1 }}>
        {t('apiKeys.usageDialog.timeline.title')}
      </Typography>
      <Box sx={{ width: '100%', overflowX: 'auto' }}>
        <ResponsiveContainer width="100%" height={200} minWidth={400}>
          <BarChart data={chartData} aria-label="Daily usage chart showing request data">
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11 }}
              interval="preserveStartEnd"
            />
            <YAxis tick={{ fontSize: 11 }} width={50} />
            <Tooltip />
            <Bar
              dataKey="successful"
              stackId="usage"
              fill={theme.palette.success.main}
              name={t('apiKeys.usageDialog.timeline.successful')}
              radius={[0, 0, 0, 0]}
            />
            <Bar
              dataKey="failed"
              stackId="usage"
              fill={theme.palette.error.main}
              name={t('apiKeys.usageDialog.timeline.failed')}
              radius={[2, 2, 0, 0]}
            />
          </BarChart>
        </ResponsiveContainer>
      </Box>
    </Box>
  );
}
