import { Box, LinearProgress, Typography, Stack } from '@mui/material';
import { useTranslation } from 'react-i18next';
import type { QuotaWindow } from '@/types/api';

interface QuotaGaugesProps {
  hourly: QuotaWindow | null | undefined;
  daily: QuotaWindow | null | undefined;
  monthly: QuotaWindow | null | undefined;
}

function formatRelativeTime(isoDate: string): string {
  const diff = new Date(isoDate).getTime() - Date.now();
  if (diff <= 0) return '< 1m';
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  return `${days}d`;
}

function gaugeColor(used: number, limit: number): 'success' | 'warning' | 'error' {
  const ratio = limit > 0 ? used / limit : 0;
  if (ratio >= 0.9) return 'error';
  if (ratio >= 0.7) return 'warning';
  return 'success';
}

function formatNumber(n: number): string {
  return n.toLocaleString();
}

interface SingleGaugeProps {
  label: string;
  window: QuotaWindow | null | undefined;
  unavailableText: string;
}

function SingleGauge({ label, window: w, unavailableText }: SingleGaugeProps) {
  const { t } = useTranslation();

  if (!w) {
    return (
      <Box sx={{ flex: 1, minWidth: 180 }} data-testid={`quota-gauge.${label.toLowerCase()}`}>
        <Typography variant="caption" color="text.secondary">{label}</Typography>
        <Typography variant="body2" color="text.disabled">{unavailableText}</Typography>
      </Box>
    );
  }

  const percentage = w.limit > 0 ? Math.min((w.used / w.limit) * 100, 100) : 0;
  const color = gaugeColor(w.used, w.limit);

  return (
    <Box sx={{ flex: 1, minWidth: 180 }} data-testid={`quota-gauge.${label.toLowerCase()}`}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
        <Typography variant="caption" sx={{ fontWeight: 600 }}>{label}</Typography>
        <Typography variant="caption" color="text.secondary">
          {t('apiKeys.usageDialog.quota.resetsIn', { time: formatRelativeTime(w.resets_at) })}
        </Typography>
      </Box>
      <LinearProgress
        variant="determinate"
        value={percentage}
        color={color}
        sx={{ height: 8, borderRadius: 1, mb: 0.5 }}
        aria-valuenow={w.used}
        aria-valuemin={0}
        aria-valuemax={w.limit}
        aria-label={`${label} quota: ${w.used} of ${w.limit} used`}
      />
      <Box sx={{ display: 'flex', justifyContent: 'space-between' }}>
        <Typography variant="caption" color="text.secondary">
          {t('apiKeys.usageDialog.quota.used', { used: formatNumber(w.used), limit: formatNumber(w.limit) })}
        </Typography>
        <Typography variant="caption" color={color === 'error' ? 'error.main' : 'text.secondary'}>
          {w.remaining === 0
            ? t('apiKeys.usageDialog.quota.exhausted')
            : t('apiKeys.usageDialog.quota.remaining', { remaining: formatNumber(w.remaining) })
          }
        </Typography>
      </Box>
    </Box>
  );
}

export default function QuotaGauges({ hourly, daily, monthly }: QuotaGaugesProps) {
  const { t } = useTranslation();
  const unavailable = t('apiKeys.usageDialog.quota.unavailable');

  return (
    <Stack
      direction={{ xs: 'column', sm: 'row' }}
      spacing={3}
      data-testid="quota-gauges"
    >
      <SingleGauge label={t('apiKeys.usageDialog.quota.hourly')} window={hourly} unavailableText={unavailable} />
      <SingleGauge label={t('apiKeys.usageDialog.quota.daily')} window={daily} unavailableText={unavailable} />
      <SingleGauge label={t('apiKeys.usageDialog.quota.monthly')} window={monthly} unavailableText={unavailable} />
    </Stack>
  );
}
