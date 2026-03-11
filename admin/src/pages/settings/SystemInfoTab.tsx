import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Tooltip,
  Alert,
  Divider,
  Stack,
  Button,
  Grid,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import WarningIcon from '@mui/icons-material/Warning';
import StorageIcon from '@mui/icons-material/Storage';
import LanguageIcon from '@mui/icons-material/Language';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import apiService from '@/services/api';
import LoadingState from '@/components/shared/LoadingState';

const STATUS_CONFIG = {
  healthy: { icon: <CheckCircleIcon color="success" />, color: 'success' as const, labelKey: 'common.status.healthy' },
  degraded: { icon: <WarningIcon color="warning" />, color: 'warning' as const, labelKey: 'common.status.degraded' },
  unhealthy: { icon: <ErrorIcon color="error" />, color: 'error' as const, labelKey: 'common.status.unhealthy' },
};

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

export default function SystemInfoTab() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: health, isLoading: healthLoading, error: healthError, refetch: refetchHealth } = useQuery({
    queryKey: ['health'],
    queryFn: () => apiService.getHealth(),
    retry: false,
    refetchInterval: 30_000,
  });

  const { data: environments, isLoading: envLoading } = useQuery({
    queryKey: ['environments'],
    queryFn: () => apiService.getEnvironments(),
  });

  const statusCfg = health ? STATUS_CONFIG[health.status] : null;

  return (
    <Grid container spacing={3}>
      {/* Server Health */}
      <Grid size={12}>
        <Paper sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <StorageIcon color="primary" fontSize="small" />
              <Typography variant="h6" component="h2">{t('settings.systemInfo.serverHealth')}</Typography>
            </Box>
            <Tooltip title={t('common.actions.refresh')}>
              <IconButton aria-label={t('common.actions.refresh')} onClick={() => refetchHealth()} disabled={healthLoading} size="small">
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          </Box>
          <Divider sx={{ mb: 2 }} />

          {healthLoading ? (
            <LoadingState label={t('settings.systemInfo.checkingHealth')} />
          ) : healthError ? (
            <Alert severity="error">{t('common.errors.serverUnreachable')}</Alert>
          ) : health ? (
            <Stack spacing={2}>
              <Alert severity={statusCfg!.color} icon={statusCfg!.icon}>
                {t('settings.systemInfo.overallStatus')} <strong>{t(statusCfg!.labelKey)}</strong>
                {health.version && (
                  <Chip label={`v${health.version}`} size="small" variant="outlined" sx={{ ml: 1.5, height: 22 }} />
                )}
              </Alert>

              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell scope="col">{t('settings.systemInfo.service')}</TableCell>
                      <TableCell scope="col">{t('settings.systemInfo.status')}</TableCell>
                      <TableCell scope="col">{t('settings.systemInfo.latency')}</TableCell>
                      <TableCell scope="col">{t('settings.systemInfo.details')}</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {health.services.map((svc) => (
                      <TableRow key={svc.name}>
                        <TableCell>
                          <Typography variant="body2" fontWeight={500} sx={{ textTransform: 'capitalize' }}>
                            {svc.name}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={svc.status === 'up' ? t('common.status.up') : t('common.status.down')}
                            size="small"
                            color={svc.status === 'up' ? 'success' : 'error'}
                          />
                        </TableCell>
                        <TableCell>
                          {svc.latency_ms != null ? `${svc.latency_ms} ms` : '\u2014'}
                        </TableCell>
                        <TableCell>
                          {svc.error ? (
                            <Typography variant="body2" color="error.main">{svc.error}</Typography>
                          ) : '\u2014'}
                        </TableCell>
                      </TableRow>
                    ))}
                    {health.storage && (() => {
                      const s = health.storage;
                      const details: string[] = [];
                      if (s.bucket) details.push(`Bucket: ${s.bucket}`);
                      if (s.used_percent != null) details.push(`${s.used_percent}% used`);
                      if (s.available_bytes != null) details.push(`${formatBytes(s.available_bytes)} free`);
                      if (s.total_bytes != null) details.push(`${formatBytes(s.total_bytes)} total`);
                      if (s.error) details.push(s.error);
                      return (
                        <TableRow key={s.name}>
                          <TableCell>
                            <Typography variant="body2" fontWeight={500} sx={{ textTransform: 'capitalize' }}>
                              {s.name}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={s.status === 'up' ? t('common.status.up') : t('common.status.down')}
                              size="small"
                              color={s.status === 'up' ? 'success' : 'error'}
                            />
                          </TableCell>
                          <TableCell>
                            {s.latency_ms != null ? `${s.latency_ms} ms` : '\u2014'}
                          </TableCell>
                          <TableCell>
                            {details.length > 0 ? (
                              <Typography variant="body2" color={s.error ? 'error.main' : 'text.secondary'}>
                                {details.join(' \u2022 ')}
                              </Typography>
                            ) : '\u2014'}
                          </TableCell>
                        </TableRow>
                      );
                    })()}
                  </TableBody>
                </Table>
              </TableContainer>

              <Typography variant="caption" color="text.secondary">
                {t('settings.systemInfo.autoRefresh')}
              </Typography>
            </Stack>
          ) : null}
        </Paper>
      </Grid>

      {/* Environments & Locales side by side */}
      <Grid size={{ xs: 12, md: 6 }}>
        <Paper sx={{ p: 3, height: '100%' }}>
          <Typography variant="h6" component="h2" gutterBottom>{t('settings.systemInfo.environments')}</Typography>
          <Divider sx={{ mb: 2 }} />

          {envLoading ? (
            <LoadingState label={t('settings.systemInfo.loadingEnvironments')} />
          ) : !environments || environments.length === 0 ? (
            <Alert severity="info">{t('settings.systemInfo.noEnvironments')}</Alert>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell scope="col">{t('settings.systemInfo.envName')}</TableCell>
                    <TableCell scope="col">{t('settings.systemInfo.envDisplayName')}</TableCell>
                    <TableCell scope="col">{t('settings.systemInfo.envDefault')}</TableCell>
                    <TableCell scope="col">{t('settings.systemInfo.envCreated')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {environments.map((env) => (
                    <TableRow key={env.id}>
                      <TableCell>
                        <Chip label={env.name} size="small" variant="outlined" />
                      </TableCell>
                      <TableCell>{env.display_name}</TableCell>
                      <TableCell>
                        {env.is_default && <Chip label={t('common.labels.default')} size="small" color="primary" />}
                      </TableCell>
                      <TableCell>{format(new Date(env.created_at), 'PP')}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Paper>
      </Grid>

      <Grid size={{ xs: 12, md: 6 }}>
        <Paper sx={{ p: 3, height: '100%' }}>
          <Typography variant="h6" component="h2" gutterBottom>{t('settings.systemInfo.locales')}</Typography>
          <Divider sx={{ mb: 2 }} />

          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {t('settings.systemInfo.localesMovedDescription')}
          </Typography>
          <Button
            variant="outlined"
            startIcon={<LanguageIcon />}
            onClick={() => navigate('/locales')}
          >
            {t('settings.systemInfo.manageLocales')}
          </Button>
        </Paper>
      </Grid>
    </Grid>
  );
}
