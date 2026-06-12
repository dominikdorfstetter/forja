import { useState } from 'react';
import {
  Box, Card, CardContent, Typography, Table, TableBody, TableCell,
  TableContainer, TableHead, TableRow, Chip, ToggleButton, ToggleButtonGroup,
} from '@mui/material';
import FormDialog from '@/components/shared/FormDialog';
import { M3Button } from '@/components/design-system';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { getWebhookStats } from '@/services/webhooks';
import LoadingState from '@/components/shared/LoadingState';
import { queryKeys } from '@/lib/queryKeys';

type StatsWindow = '1h' | '24h' | '7d' | '30d';

interface WebhookAnalyticsProps {
  open: boolean;
  webhookId: string | null;
  onClose: () => void;
}

function successRateColor(rate: number): 'success' | 'warning' | 'error' {
  if (rate >= 95) return 'success';
  if (rate >= 80) return 'warning';
  return 'error';
}

export default function WebhookAnalytics({ open, webhookId, onClose }: WebhookAnalyticsProps) {
  const { t } = useTranslation();
  const [window, setWindow] = useState<StatsWindow>('24h');

  const { data: stats, isLoading } = useQuery({
    queryKey: queryKeys.webhookStats(webhookId, window),
    queryFn: () => getWebhookStats(webhookId!, window),
    enabled: open && !!webhookId,
  });

  if (!open) return null;

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      icon="analytics"
      title={t('webhooks.analytics.title')}
      maxWidth="md"
      data-testid="webhook-analytics.dialog"
      actions={
        <M3Button variant="filled" size="sm" onClick={onClose}>
          {t('common.actions.close')}
        </M3Button>
      }
    >
        <Box sx={{ mb: 1, display: 'flex', justifyContent: 'center' }}>
          <ToggleButtonGroup
            value={window}
            exclusive
            onChange={(_, v) => v && setWindow(v)}
            size="small"
            aria-label="Time window"
          >
            {(['1h', '24h', '7d', '30d'] as const).map((w) => (
              <ToggleButton key={w} value={w}>{t(`webhooks.analytics.window.${w}`)}</ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Box>

        {isLoading ? (
          <LoadingState label={t('webhooks.analytics.title')} />
        ) : stats ? (
          <>
            <Box sx={{ display: 'flex', gap: 2, mb: 3, flexWrap: 'wrap' }}>
              <Card sx={{ flex: 1, minWidth: 120 }}>
                <CardContent sx={{ textAlign: 'center', py: 1.5 }}>
                  <Typography variant="caption" color="text.secondary">{t('webhooks.analytics.cards.total')}</Typography>
                  <Typography variant="h5">{stats.total_deliveries}</Typography>
                </CardContent>
              </Card>
              <Card sx={{ flex: 1, minWidth: 120 }}>
                <CardContent sx={{ textAlign: 'center', py: 1.5 }}>
                  <Typography variant="caption" color="text.secondary">{t('webhooks.analytics.cards.successRate')}</Typography>
                  <Typography variant="h5">
                    <Chip label={`${stats.success_rate.toFixed(1)}%`} color={successRateColor(stats.success_rate)} size="small" />
                  </Typography>
                </CardContent>
              </Card>
              <Card sx={{ flex: 1, minWidth: 120 }}>
                <CardContent sx={{ textAlign: 'center', py: 1.5 }}>
                  <Typography variant="caption" color="text.secondary">{t('webhooks.analytics.cards.pendingRetry')}</Typography>
                  <Typography variant="h5">{stats.pending_retry}</Typography>
                </CardContent>
              </Card>
            </Box>

            {stats.by_event.length > 0 && (
              <>
                <Typography variant="subtitle2" sx={{ mb: 1 }}>{t('webhooks.analytics.byEvent.title')}</Typography>
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>{t('webhooks.analytics.byEvent.event')}</TableCell>
                        <TableCell align="right">{t('webhooks.analytics.byEvent.total')}</TableCell>
                        <TableCell align="right">{t('webhooks.analytics.byEvent.successful')}</TableCell>
                        <TableCell align="right">{t('webhooks.analytics.byEvent.failed')}</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {stats.by_event.map((row) => (
                        <TableRow key={row.event_type}>
                          <TableCell><Chip label={row.event_type} size="small" variant="outlined" /></TableCell>
                          <TableCell align="right">{row.total}</TableCell>
                          <TableCell align="right">{row.successful}</TableCell>
                          <TableCell align="right">{row.failed}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              </>
            )}
          </>
        ) : null}
    </FormDialog>
  );
}
