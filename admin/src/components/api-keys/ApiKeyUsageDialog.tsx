import { Stack, Alert, Divider } from '@mui/material';
import { lazy, Suspense } from 'react';
import LoadingState from '@/components/shared/LoadingState';
import { useTranslation } from 'react-i18next';
import { useApiKeyUsageSummary } from '@/hooks/useApiKeyUsageSummary';
import QuotaGauges from './QuotaGauges';
import UsageSummaryStats from './UsageSummaryStats';
import FormDialog from '@/components/shared/FormDialog';
import { M3Button } from '@/components/design-system';

const UsageTimeline = lazy(() => import('./UsageTimeline'));

interface ApiKeyUsageDialogProps {
  open: boolean;
  keyId: string | null;
  keyName: string;
  onClose: () => void;
}

export default function ApiKeyUsageDialog({ open, keyId, keyName, onClose }: ApiKeyUsageDialogProps) {
  const { t } = useTranslation();
  const { data: summary, isLoading, isError } = useApiKeyUsageSummary(
    open ? keyId : null,
  );

  const todayRateLimitHits = summary?.history.daily[0]?.rate_limit_hits ?? 0;

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      icon="analytics"
      title={`${t('apiKeys.usageDialog.title')}: ${keyName}`}
      maxWidth="md"
      data-testid="api-key-usage.dialog"
      actions={
        <M3Button
          variant="filled"
          size="sm"
          onClick={onClose}
          data-testid="api-key-usage.btn.close"
        >
          {t('common.actions.close')}
        </M3Button>
      }
    >
      {isLoading ? (
        <LoadingState label="Loading usage data..." />
      ) : isError ? (
        <Alert severity="error" data-testid="api-key-usage.error">
          {t('apiKeys.usageDialog.loadError')}
        </Alert>
      ) : summary ? (
        <Stack spacing={3}>
          <QuotaGauges
            hourly={summary.quota.hourly}
            daily={summary.quota.daily}
            monthly={summary.quota.monthly}
          />
          <Divider />
          <Suspense fallback={null}>
            <UsageTimeline daily={summary.history.daily} />
          </Suspense>
          <Divider />
          <UsageSummaryStats
            allTimeRequests={summary.totals.all_time_requests}
            lastUsedAt={summary.totals.last_used_at}
            rateLimitHitsToday={todayRateLimitHits}
          />
        </Stack>
      ) : null}
    </FormDialog>
  );
}
