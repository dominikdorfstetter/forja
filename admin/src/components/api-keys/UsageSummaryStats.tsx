import { Box, Typography, Stack } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useLocalizedFormat } from '@/utils/dateFnsLocale';

interface UsageSummaryStatsProps {
  allTimeRequests: number;
  lastUsedAt: string | null | undefined;
  rateLimitHitsToday: number;
}

export default function UsageSummaryStats({ allTimeRequests, lastUsedAt, rateLimitHitsToday }: UsageSummaryStatsProps) {
  const { t } = useTranslation();
  const fmt = useLocalizedFormat();

  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      spacing={3}
      divider={<Box sx={{ borderRight: 1, borderColor: 'divider', display: { xs: 'none', sm: 'block' } }} />}
      data-testid="usage-summary-stats"
    >
      <Box sx={{ flex: 1 }}>
        <Typography variant="caption" color="text.secondary">
          {t('apiKeys.usageDialog.stats.allTime')}
        </Typography>
        <Typography variant="h6" data-testid="usage-stats.all-time">
          {allTimeRequests.toLocaleString()}
        </Typography>
      </Box>
      <Box sx={{ flex: 1 }}>
        <Typography variant="caption" color="text.secondary">
          {t('apiKeys.usageDialog.stats.lastUsed')}
        </Typography>
        <Typography variant="h6" data-testid="usage-stats.last-used">
          {lastUsedAt ? fmt(lastUsedAt, 'PP p') : '—'}
        </Typography>
      </Box>
      <Box sx={{ flex: 1 }}>
        <Typography variant="caption" color="text.secondary">
          {t('apiKeys.usageDialog.stats.rateLimitHits')}
        </Typography>
        <Typography variant="h6" data-testid="usage-stats.rate-limit-hits">
          {rateLimitHitsToday.toLocaleString()}
        </Typography>
      </Box>
    </Stack>
  );
}
