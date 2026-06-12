import { Box, Paper, Typography, Divider, Button, Stack, Chip } from '@mui/material';
import CachedIcon from '@mui/icons-material/Cached';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { useTranslation } from 'react-i18next';
import { getSiteCacheStats, invalidateSiteCache, rebuildSiteCache } from '@/services/cache';
import { queryKeys } from '@/lib/queryKeys';

interface CacheSectionProps {
  siteId: string;
}

/**
 * Per-site response-cache panel: shows how many entries are cached and which
 * resources, with Invalidate (clear) and Rebuild (clear + re-warm) actions.
 * Visible to site admins for their own site.
 */
export default function CacheSection({ siteId }: CacheSectionProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();

  const { data: stats, isLoading } = useQuery({
    queryKey: queryKeys.siteCache(siteId),
    queryFn: () => getSiteCacheStats(siteId),
  });

  const refresh = () => queryClient.invalidateQueries({ queryKey: queryKeys.siteCache(siteId) });

  const invalidateMutation = useMutation({
    mutationFn: () => invalidateSiteCache(siteId),
    onSuccess: (res) => {
      refresh();
      enqueueSnackbar(t('siteSettings.cache.invalidated', { n: res.invalidated }), {
        variant: 'success',
      });
    },
    onError: () => enqueueSnackbar(t('siteSettings.cache.actionFailed'), { variant: 'error' }),
  });

  const rebuildMutation = useMutation({
    mutationFn: () => rebuildSiteCache(siteId),
    onSuccess: (res) => {
      refresh();
      enqueueSnackbar(
        t('siteSettings.cache.rebuilt', { n: res.invalidated, warmed: res.warmed.length }),
        { variant: 'success' },
      );
    },
    onError: () => enqueueSnackbar(t('siteSettings.cache.actionFailed'), { variant: 'error' }),
  });

  const busy = invalidateMutation.isPending || rebuildMutation.isPending;

  return (
    <Paper sx={{ p: 3 }} data-testid="site-settings.cache">
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
        <CachedIcon color="primary" fontSize="small" />
        <Typography variant="h6" component="h2">{t('siteSettings.cache.title')}</Typography>
      </Box>
      <Divider sx={{ mb: 2.5 }} />

      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
        {t('siteSettings.cache.description')}
      </Typography>

      <Typography variant="body2" sx={{ mb: 1 }} data-testid="site-settings.cache-count">
        {t('siteSettings.cache.entryCount', { n: stats?.entry_count ?? 0 })}
      </Typography>

      {stats && stats.entries.length > 0 && (
        <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mb: 2 }}>
          {stats.entries.map((entry) => (
            <Chip key={entry} label={entry} size="small" variant="outlined" />
          ))}
        </Box>
      )}

      <Stack direction="row" spacing={2} sx={{ mt: 1 }}>
        <Button
          variant="outlined"
          disabled={busy || isLoading}
          onClick={() => invalidateMutation.mutate()}
          data-testid="site-settings.cache-invalidate"
        >
          {t('siteSettings.cache.invalidate')}
        </Button>
        <Button
          variant="contained"
          disabled={busy || isLoading}
          onClick={() => rebuildMutation.mutate()}
          data-testid="site-settings.cache-rebuild"
        >
          {t('siteSettings.cache.rebuild')}
        </Button>
      </Stack>
      <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 1 }}>
        {t('siteSettings.cache.rebuildHelp')}
      </Typography>
    </Paper>
  );
}
