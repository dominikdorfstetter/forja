import { useMemo } from 'react';
import { Box, Chip, Stack, useTheme } from '@mui/material';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import { useTranslation } from 'react-i18next';
import type { ContentStatus } from '@/types/api';

interface ContentStatusChartInnerProps {
  statusCounts: Record<ContentStatus, number>;
}

export default function ContentStatusChartInner({ statusCounts }: ContentStatusChartInnerProps) {
  const { t } = useTranslation();
  const theme = useTheme();

  const statusColors: Record<ContentStatus, string> = useMemo(() => ({
    Draft: theme.palette.warning.main,
    InReview: theme.palette.secondary.main,
    Scheduled: theme.palette.info.main,
    Published: theme.palette.success.main,
    Archived: theme.palette.text.disabled,
  }), [theme]);

  const statusLabels: Record<ContentStatus, string> = {
    Draft: t('common.status.draft'),
    InReview: t('common.status.inReview'),
    Scheduled: t('common.status.scheduled'),
    Published: t('common.status.published'),
    Archived: t('common.status.archived'),
  };

  const chartData = useMemo(() => {
    return (Object.entries(statusCounts) as [ContentStatus, number][])
      .filter(([, count]) => count > 0)
      .map(([status, count]) => ({
        name: statusLabels[status],
        value: count,
        status,
      }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [statusCounts]);

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Box sx={{ flex: 1, minHeight: 0, width: '100%' }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={chartData}
              cx="50%"
              cy="50%"
              innerRadius="55%"
              outerRadius="90%"
              paddingAngle={2}
              dataKey="value"
              stroke="none"
            >
              {chartData.map((entry) => (
                <Cell key={entry.status} fill={statusColors[entry.status]} />
              ))}
            </Pie>
            <Tooltip
              formatter={(value, name) => [`${value}`, `${name}`]}
              contentStyle={{
                backgroundColor: theme.palette.background.paper,
                color: theme.palette.text.primary,
                border: `1px solid ${theme.palette.divider}`,
                borderRadius: 8,
                fontSize: '0.85rem',
              }}
              itemStyle={{ color: theme.palette.text.primary }}
              labelStyle={{ color: theme.palette.text.secondary }}
            />
          </PieChart>
        </ResponsiveContainer>
      </Box>
      <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap justifyContent="center" sx={{ pt: 1.5 }}>
        {(Object.entries(statusCounts) as [ContentStatus, number][])
          .filter(([, count]) => count > 0)
          .map(([status, count]) => (
            <Chip
              key={status}
              label={`${statusLabels[status]}: ${count}`}
              size="small"
              variant="outlined"
              sx={{
                borderColor: statusColors[status],
                color: statusColors[status],
                fontWeight: 500,
                fontSize: '0.75rem',
              }}
            />
          ))}
      </Stack>
    </Box>
  );
}
