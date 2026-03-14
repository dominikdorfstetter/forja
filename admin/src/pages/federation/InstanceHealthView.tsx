import { Box, LinearProgress, Paper, Stack, Tooltip, Typography } from '@mui/material';
import BlockIcon from '@mui/icons-material/Block';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';
import IconButton from '@mui/material/IconButton';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import { useSiteContext } from '@/store/SiteContext';
import { useFederationHealth } from '@/hooks/useFederationData';
import { useFederationMutations } from '@/hooks/useFederationMutations';
import PageHeader from '@/components/shared/PageHeader';
import LoadingState from '@/components/shared/LoadingState';
import EmptyState from '@/components/shared/EmptyState';
import DataTable, { type DataTableColumn } from '@/components/shared/DataTable';
import type { FederationInstanceHealth } from '@/types/api';

export default function InstanceHealthView() {
  const { t } = useTranslation();
  const { selectedSiteId } = useSiteContext();
  const { data: healthData, isLoading } = useFederationHealth(selectedSiteId);
  const { blockInstanceMutation } = useFederationMutations(selectedSiteId);

  const columns: DataTableColumn<FederationInstanceHealth>[] = [
    {
      header: t('federation.health.domain'),
      render: (h) => (
        <Typography variant="body2" fontFamily="monospace" fontSize="0.85rem">
          {h.instance_domain}
        </Typography>
      ),
    },
    {
      header: t('federation.health.total'),
      render: (h) => h.total,
    },
    {
      header: t('federation.health.successful'),
      render: (h) => {
        const rate = h.total > 0 ? Math.round((h.successful / h.total) * 100) : 0;
        return (
          <Stack spacing={0.5} sx={{ minWidth: 100 }}>
            <Typography variant="body2">{h.successful} ({rate}%)</Typography>
            <LinearProgress
              variant="determinate"
              value={rate}
              color={rate >= 80 ? 'success' : rate >= 50 ? 'warning' : 'error'}
              sx={{ height: 4, borderRadius: 2 }}
            />
          </Stack>
        );
      },
    },
    {
      header: t('federation.health.failed'),
      render: (h) => (
        <Typography variant="body2" color={h.failed > 0 ? 'warning.main' : 'text.secondary'}>
          {h.failed}
        </Typography>
      ),
    },
    {
      header: t('federation.health.dead'),
      render: (h) => (
        <Typography variant="body2" color={h.dead > 0 ? 'error.main' : 'text.secondary'}>
          {h.dead}
        </Typography>
      ),
    },
    {
      header: t('federation.health.lastAttempt'),
      render: (h) => h.last_attempt ? format(new Date(h.last_attempt), 'PPp') : '-',
    },
    {
      header: '',
      align: 'right',
      render: (h) => {
        const isHighFailure = (h.failed + h.dead) > h.total * 0.5;
        if (!isHighFailure) return null;
        return (
          <Tooltip title={t('federation.health.blockSuggestion')}>
            <IconButton
              size="small"
              color="error"
              onClick={() => blockInstanceMutation.mutate({ domain: h.instance_domain })}
            >
              <BlockIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        );
      },
    },
  ];

  if (!selectedSiteId) {
    return (
      <Box data-testid="federation-health.page">
        <PageHeader
          title={t('federation.health.title')}
          subtitle={t('federation.health.description')}
          breadcrumbs={[
            { label: t('federation.breadcrumbs.federation'), path: '/federation' },
            { label: t('federation.health.title') },
          ]}
        />
        <EmptyState
          icon={<CheckCircleOutlineIcon sx={{ fontSize: 64 }} />}
          title={t('federation.noSiteSelected')}
          description={t('federation.health.healthy')}
        />
      </Box>
    );
  }

  if (isLoading) {
    return (
      <Box data-testid="federation-health.page">
        <PageHeader
          title={t('federation.health.title')}
          subtitle={t('federation.health.description')}
          breadcrumbs={[
            { label: t('federation.breadcrumbs.federation'), path: '/federation' },
            { label: t('federation.health.title') },
          ]}
        />
        <LoadingState label={t('common.actions.loading')} />
      </Box>
    );
  }

  const data = healthData ?? [];

  return (
    <Box data-testid="federation-health.page">
      <PageHeader
        title={t('federation.health.title')}
        subtitle={t('federation.health.description')}
        breadcrumbs={[
          { label: t('federation.breadcrumbs.federation'), path: '/federation' },
          { label: t('federation.health.title') },
        ]}
      />

      {data.length === 0 ? (
        <EmptyState
          icon={<CheckCircleOutlineIcon sx={{ fontSize: 48 }} />}
          title={t('federation.health.healthy')}
          description={t('federation.health.description')}
        />
      ) : (
        <Paper>
          <DataTable
            data={data}
            columns={columns}
            getRowKey={(h) => h.instance_domain}
          />
        </Paper>
      )}
    </Box>
  );
}
