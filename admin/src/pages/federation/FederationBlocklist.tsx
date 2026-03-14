import { useState } from 'react';
import { Box, IconButton, Paper, Tab, Tabs, Tooltip } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import BlockIcon from '@mui/icons-material/Block';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import apiService from '@/services/api';
import type { FederationBlockedInstance, FederationBlockedActor } from '@/types/api';
import { useSiteContext } from '@/store/SiteContext';
import { useListPageState } from '@/hooks/useListPageState';
import { useTranslation } from 'react-i18next';
import { useFederationMutations } from '@/hooks/useFederationMutations';
import PageHeader from '@/components/shared/PageHeader';
import LoadingState from '@/components/shared/LoadingState';
import EmptyState from '@/components/shared/EmptyState';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import DataTable, { type DataTableColumn } from '@/components/shared/DataTable';

export default function FederationBlocklist() {
  const { t } = useTranslation();
  const { selectedSiteId } = useSiteContext();
  const [tab, setTab] = useState(0);

  const instanceState = useListPageState<FederationBlockedInstance>();
  const actorState = useListPageState<FederationBlockedActor>();

  const { unblockInstanceMutation, unblockActorMutation } = useFederationMutations(selectedSiteId);

  const { data: instanceData, isLoading: instancesLoading } = useQuery({
    queryKey: ['federation-blocked-instances', selectedSiteId, instanceState.page, instanceState.pageSize],
    queryFn: () => apiService.getBlockedInstances(selectedSiteId, {
      page: instanceState.page,
      page_size: instanceState.pageSize,
    }),
    enabled: !!selectedSiteId && tab === 0,
  });

  const { data: actorData, isLoading: actorsLoading } = useQuery({
    queryKey: ['federation-blocked-actors', selectedSiteId, actorState.page, actorState.pageSize],
    queryFn: () => apiService.getBlockedActors(selectedSiteId, {
      page: actorState.page,
      page_size: actorState.pageSize,
    }),
    enabled: !!selectedSiteId && tab === 1,
  });

  const instanceColumns: DataTableColumn<FederationBlockedInstance>[] = [
    {
      header: t('federation.blocklist.columns.domain'),
      render: (b) => b.domain,
    },
    {
      header: t('federation.blocklist.columns.reason'),
      render: (b) => b.reason ?? '-',
    },
    {
      header: t('federation.blocklist.columns.blocked'),
      render: (b) => format(new Date(b.blocked_at), 'PP'),
    },
    {
      header: t('federation.blocklist.columns.actions'),
      align: 'right',
      render: (b) => (
        <Tooltip title={t('federation.blocklist.unblockInstanceTooltip')}>
          <IconButton size="small" color="error" onClick={() => instanceState.openDelete(b)}>
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      ),
    },
  ];

  const actorColumns: DataTableColumn<FederationBlockedActor>[] = [
    {
      header: t('federation.blocklist.columns.actorUri'),
      render: (b) => (
        <Box component="span" sx={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
          {b.actor_uri}
        </Box>
      ),
    },
    {
      header: t('federation.blocklist.columns.reason'),
      render: (b) => b.reason ?? '-',
    },
    {
      header: t('federation.blocklist.columns.blocked'),
      render: (b) => format(new Date(b.blocked_at), 'PP'),
    },
    {
      header: t('federation.blocklist.columns.actions'),
      align: 'right',
      render: (b) => (
        <Tooltip title={t('federation.blocklist.unblockActorTooltip')}>
          <IconButton size="small" color="error" onClick={() => actorState.openDelete(b)}>
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      ),
    },
  ];

  if (!selectedSiteId) {
    return (
      <Box data-testid="federation-blocklist.page">
        <PageHeader title={t('federation.blocklist.title')} subtitle={t('federation.blocklist.subtitle')} breadcrumbs={[{ label: t('federation.breadcrumbs.federation'), path: '/federation' }, { label: t('federation.blocklist.title') }]} />
        <EmptyState icon={<BlockIcon sx={{ fontSize: 64 }} />} title={t('federation.noSiteSelected')} description={t('federation.blocklist.noSite')} />
      </Box>
    );
  }

  const isLoading = tab === 0 ? instancesLoading : actorsLoading;

  return (
    <Box data-testid="federation-blocklist.page">
      <PageHeader title={t('federation.blocklist.title')} subtitle={t('federation.blocklist.subtitle')} breadcrumbs={[{ label: t('federation.breadcrumbs.federation'), path: '/federation' }, { label: t('federation.blocklist.title') }]} />

      <Paper>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tab label={t('federation.blocklist.instances')} />
          <Tab label={t('federation.blocklist.actors')} />
        </Tabs>

        {isLoading ? (
          <Box sx={{ p: 3 }}><LoadingState label={t('federation.blocklist.loading')} /></Box>
        ) : tab === 0 ? (
          !instanceData?.data?.length ? (
            <Box sx={{ p: 3 }}>
              <EmptyState
                icon={<BlockIcon sx={{ fontSize: 48 }} />}
                title={t('federation.blocklist.noBlockedInstances')}
                description={t('federation.blocklist.noBlockedInstancesDesc')}
              />
            </Box>
          ) : (
            <DataTable
              data={instanceData.data}
              columns={instanceColumns}
              getRowKey={(b) => b.id}
              meta={instanceData?.meta}
              page={instanceState.page}
              onPageChange={instanceState.handlePageChange}
              rowsPerPage={instanceState.pageSize}
              onRowsPerPageChange={instanceState.handleRowsPerPageChange}
            />
          )
        ) : (
          !actorData?.data?.length ? (
            <Box sx={{ p: 3 }}>
              <EmptyState
                icon={<BlockIcon sx={{ fontSize: 48 }} />}
                title={t('federation.blocklist.noBlockedActors')}
                description={t('federation.blocklist.noBlockedActorsDesc')}
              />
            </Box>
          ) : (
            <DataTable
              data={actorData.data}
              columns={actorColumns}
              getRowKey={(b) => b.id}
              meta={actorData?.meta}
              page={actorState.page}
              onPageChange={actorState.handlePageChange}
              rowsPerPage={actorState.pageSize}
              onRowsPerPageChange={actorState.handleRowsPerPageChange}
            />
          )
        )}
      </Paper>

      <ConfirmDialog
        open={!!instanceState.deleting}
        title={t('federation.blocklist.unblockInstanceTitle')}
        message={t('federation.blocklist.unblockInstanceMessage', { domain: instanceState.deleting?.domain })}
        confirmLabel={t('federation.blocklist.unblockConfirm')}
        onConfirm={() => instanceState.deleting && unblockInstanceMutation.mutate(instanceState.deleting.id)}
        onCancel={instanceState.closeDelete}
        loading={unblockInstanceMutation.isPending}
      />

      <ConfirmDialog
        open={!!actorState.deleting}
        title={t('federation.blocklist.unblockActorTitle')}
        message={t('federation.blocklist.unblockActorMessage', { actor: actorState.deleting?.actor_uri })}
        confirmLabel={t('federation.blocklist.unblockConfirm')}
        onConfirm={() => actorState.deleting && unblockActorMutation.mutate(actorState.deleting.id)}
        onCancel={actorState.closeDelete}
        loading={unblockActorMutation.isPending}
      />
    </Box>
  );
}
