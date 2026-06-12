import { Box, Paper, Typography, Divider, Button, Stack, Alert } from '@mui/material';
import CachedIcon from '@mui/icons-material/Cached';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { useTranslation } from 'react-i18next';
import { getGlobalCacheStats, invalidateAllCache } from '@/services/cache';
import { queryKeys } from '@/lib/queryKeys';

/**
 * Overall response-cache panel for system admins: total entries, a per-site
 * breakdown, and a clear-everything action.
 */
export default function GlobalCacheSection() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();

  const { data: stats, isLoading } = useQuery({
    queryKey: queryKeys.globalCache(),
    queryFn: () => getGlobalCacheStats(),
  });

  const invalidateMutation = useMutation({
    mutationFn: () => invalidateAllCache(),
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.globalCache() });
      enqueueSnackbar(t('siteSettings.cache.invalidated', { n: res.invalidated }), {
        variant: 'success',
      });
    },
    onError: () => enqueueSnackbar(t('siteSettings.cache.actionFailed'), { variant: 'error' }),
  });

  return (
    <Paper sx={{ p: 3 }} data-testid="system.cache">
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <CachedIcon color="primary" fontSize="small" />
        <Typography variant="h6" component="h2">{t('system.cache.title')}</Typography>
      </Box>
      <Divider sx={{ mb: 2.5 }} />

      {stats && !stats.redis_available && (
        <Alert severity="warning" sx={{ mb: 2 }}>{t('system.cache.redisUnavailable')}</Alert>
      )}

      <Typography variant="body2" sx={{ mb: 1.5 }} data-testid="system.cache-total">
        {t('system.cache.totalEntries', { n: stats?.total_entries ?? 0 })}
      </Typography>

      {stats && stats.per_site.length > 0 && (
        <Stack spacing={0.5} sx={{ mb: 2 }}>
          {stats.per_site.map((s) => (
            <Box key={s.site_id} sx={{ display: 'flex', justifyContent: 'space-between' }}>
              <Typography variant="caption" sx={{ fontFamily: 'var(--font-mono)' }}>
                {s.site_id}
              </Typography>
              <Typography variant="caption" sx={{ fontVariantNumeric: 'tabular-nums' }}>
                {s.entry_count}
              </Typography>
            </Box>
          ))}
        </Stack>
      )}

      <Button
        variant="outlined"
        color="warning"
        disabled={invalidateMutation.isPending || isLoading}
        onClick={() => invalidateMutation.mutate()}
        data-testid="system.cache-invalidate-all"
      >
        {t('system.cache.invalidateAll')}
      </Button>
    </Paper>
  );
}
