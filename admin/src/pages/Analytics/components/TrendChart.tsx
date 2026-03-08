import { Box, Skeleton, Typography, useTheme } from '@mui/material';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { useTranslation } from 'react-i18next';
import type { TrendDataPoint } from '@/types/api';

interface TrendChartProps {
  data: TrendDataPoint[];
  height?: number;
  loading?: boolean;
  compact?: boolean;
}

function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export default function TrendChart({
  data,
  height = 300,
  loading,
  compact,
}: TrendChartProps) {
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

  return (
    <Box sx={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data}>
          {!compact && <CartesianGrid strokeDasharray="3 3" />}
          {!compact && (
            <XAxis dataKey="date" tickFormatter={formatDate} fontSize={12} />
          )}
          {!compact && <YAxis fontSize={12} />}
          <Tooltip
            labelFormatter={(label) => formatDate(String(label))}
            contentStyle={{
              backgroundColor: theme.palette.background.paper,
              color: theme.palette.text.primary,
              border: `1px solid ${theme.palette.divider}`,
              borderRadius: 8,
              fontSize: '0.85rem',
            }}
            itemStyle={{ color: theme.palette.text.primary }}
          />
          {!compact && <Legend />}
          <Area
            type="monotone"
            dataKey="total_views"
            name={t('analytics.totalViews')}
            stroke={theme.palette.primary.main}
            fill={theme.palette.primary.main}
            fillOpacity={0.15}
          />
          <Area
            type="monotone"
            dataKey="unique_visitors"
            name={t('analytics.uniqueVisitors')}
            stroke={theme.palette.secondary.main}
            fill={theme.palette.secondary.main}
            fillOpacity={0.15}
          />
        </AreaChart>
      </ResponsiveContainer>
    </Box>
  );
}
