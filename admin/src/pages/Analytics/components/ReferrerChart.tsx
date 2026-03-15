import { Box, Skeleton, Typography, useTheme } from '@mui/material';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { useTranslation } from 'react-i18next';
import type { ReferrerItem } from '@/types/api';

interface ReferrerChartProps {
  data: ReferrerItem[];
  height?: number;
  loading?: boolean;
}

export default function ReferrerChart({
  data,
  height = 300,
  loading,
}: ReferrerChartProps) {
  const { t } = useTranslation();
  const theme = useTheme();

  if (loading) {
    return (
      <Skeleton
        variant="rectangular"
        width="100%"
        height={height}
        sx={{ borderRadius: 1 }}
      />
    );
  }

  if (data.length === 0) {
    return (
      <Typography color="text.secondary" sx={{ py: 6, textAlign: 'center' }}>
        {t('analytics.noData')}
      </Typography>
    );
  }

  const sorted = [...data].sort((a, b) => b.views - a.views);

  return (
    <Box sx={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={sorted} layout="vertical">
          <XAxis type="number" fontSize={12} />
          <YAxis
            type="category"
            dataKey="domain"
            width={120}
            fontSize={12}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: theme.palette.background.paper,
              color: theme.palette.text.primary,
              border: `1px solid ${theme.palette.divider}`,
              borderRadius: 8,
              fontSize: '0.85rem',
            }}
            itemStyle={{ color: theme.palette.text.primary }}
          />
          <Bar
            dataKey="views"
            name={t('analytics.views')}
            fill={theme.palette.primary.main}
            radius={[0, 4, 4, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </Box>
  );
}
