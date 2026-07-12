import { useEffect, useRef, useState } from 'react';
import {
  Box, Paper, Typography, Divider, TextField, Button,
  LinearProgress, Stack, MenuItem,
} from '@mui/material';
import StorageIcon from '@mui/icons-material/Storage';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { useTranslation } from 'react-i18next';
import { updateSiteSettings } from '@/services/sites';
import type { StorageUsageResponse } from '@/types/api';
import { queryKeys } from '@/lib/queryKeys';

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`;
}

const QUOTA_PRESETS = [
  { label: '100 MB', value: 104_857_600 },
  { label: '500 MB', value: 524_288_000 },
  { label: '1 GB', value: 1_073_741_824 },
  { label: '2 GB', value: 2_147_483_648 },
  { label: '5 GB', value: 5_368_709_120 },
  { label: '10 GB', value: 10_737_418_240 },
  { label: '50 GB', value: 53_687_091_200 },
  { label: '100 GB', value: 107_374_182_400 },
  { label: '500 GB', value: 536_870_912_000 },
  { label: '1 TB', value: 1_099_511_627_776 },
];

interface StorageSectionProps {
  siteId: string;
  storageUsage: StorageUsageResponse;
  isMaster: boolean;
}

export default function StorageSection({ siteId, storageUsage, isMaster }: StorageSectionProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const [quotaValue, setQuotaValue] = useState<number | null>(null);

  const quotaMutation = useMutation({
    mutationFn: (quota: number) =>
      updateSiteSettings(siteId, { storage_quota_bytes: quota }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.siteSettings(siteId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.storageUsage(siteId) });
      enqueueSnackbar(t('settings.messages.saved'), { variant: 'success' });
    },
    onError: () => {
      enqueueSnackbar(t('settings.messages.saveFailed'), { variant: 'error' });
    },
  });

  const prevQuotaRef = useRef<number | null>(null);
  useEffect(() => {
    if (prevQuotaRef.current !== storageUsage.quota_bytes) {
      prevQuotaRef.current = storageUsage.quota_bytes;
      setQuotaValue(storageUsage.quota_bytes);
    }
  }, [storageUsage.quota_bytes]);

  return (
    <Paper sx={{ p: 3 }} data-testid="site-settings.storage-usage">
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <StorageIcon color="primary" fontSize="small" />
        <Typography variant="h6" component="h2">{t('siteSettings.storage.title')}</Typography>
      </Box>
      <Divider sx={{ mb: 2.5 }} />
      <Box sx={{ mb: 2 }}>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', mb: 0.5 }}>
          <Typography variant="body2" color="text.secondary">
            {t('siteSettings.storage.usage', {
              used: formatBytes(storageUsage.total_bytes),
              total: formatBytes(storageUsage.quota_bytes),
            })}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {storageUsage.usage_percent.toFixed(1)}%
          </Typography>
        </Box>
        <LinearProgress
          variant="determinate"
          value={Math.min(storageUsage.usage_percent, 100)}
          color={storageUsage.usage_percent >= 90 ? 'error' : storageUsage.usage_percent >= 70 ? 'warning' : 'primary'}
          sx={{ height: 8, borderRadius: 1 }}
          role="progressbar"
          aria-valuenow={storageUsage.usage_percent}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={t('siteSettings.storage.title')}
          data-testid="site-settings.storage-bar"
        />
      </Box>
      <Stack direction="row" spacing={3}>
        <Box>
          <Typography variant="caption" color="text.secondary">{t('siteSettings.storage.media')}</Typography>
          <Typography variant="body2" sx={{ fontWeight: 500 }}>{formatBytes(storageUsage.media_bytes)}</Typography>
        </Box>
        <Box>
          <Typography variant="caption" color="text.secondary">{t('siteSettings.storage.documents')}</Typography>
          <Typography variant="body2" sx={{ fontWeight: 500 }}>{formatBytes(storageUsage.document_bytes)}</Typography>
        </Box>
      </Stack>

      {isMaster && quotaValue !== null && (
        <>
          <Divider sx={{ my: 2.5 }} />
          <Stack direction="row" spacing={2} sx={{ alignItems: "center" }}>
            <TextField
              select
              label={t('siteSettings.storage.quota')}
              value={quotaValue}
              onChange={(e) => setQuotaValue(Number(e.target.value))}
              size="small"
              sx={{ minWidth: 200 }}
              data-testid="site-settings.storage-quota"
            >
              {QUOTA_PRESETS.map((preset) => (
                <MenuItem key={preset.value} value={preset.value}>
                  {preset.label}
                </MenuItem>
              ))}
            </TextField>
            <Button
              variant="contained"
              disabled={quotaValue === storageUsage.quota_bytes || quotaMutation.isPending}
              onClick={() => quotaMutation.mutate(quotaValue)}
              data-testid="site-settings.storage-quota-save"
            >
              {quotaMutation.isPending ? t('common.actions.saving') : t('common.actions.save')}
            </Button>
          </Stack>
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5 }}>
            {t('siteSettings.storage.quotaHelp')}
          </Typography>
        </>
      )}
    </Paper>
  );
}
