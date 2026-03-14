import { Box, IconButton, Paper, Tooltip } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import BlockIcon from '@mui/icons-material/Block';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import apiService from '@/services/api';
import type { FederationBlockedActor } from '@/types/api';
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

  const actorState = useListPageState<FederationBlockedActor>();

  const { unblockActorMutation } = useFederationMutations(selectedSiteId);

  const { data: actorData, isLoading } = useQuery({
    queryKey: ['federation-blocked-actors', selectedSiteId, actorState.page, actorState.pageSize],
    queryFn: () => apiService.getBlockedActors(selectedSiteId, {
      page: actorState.page,
      page_size: actorState.pageSize,
    }),
    enabled: !!selectedSiteId,
  });

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
        <PageHeader title={t('federation.nav.blockedActors')} subtitle={t('federation.nav.blockedActorsDesc')} breadcrumbs={[{ label: t('federation.breadcrumbs.federation'), path: '/federation' }, { label: t('federation.nav.blockedActors') }]} />
        <EmptyState icon={<BlockIcon sx={{ fontSize: 64 }} />} title={t('federation.noSiteSelected')} description={t('federation.blocklist.noSite')} />
      </Box>
    );
  }

  return (
    <Box data-testid="federation-blocklist.page">
      <PageHeader title={t('federation.nav.blockedActors')} subtitle={t('federation.nav.blockedActorsDesc')} breadcrumbs={[{ label: t('federation.breadcrumbs.federation'), path: '/federation' }, { label: t('federation.nav.blockedActors') }]} />

      <Paper>
        {isLoading ? (
          <Box sx={{ p: 3 }}><LoadingState label={t('federation.blocklist.loading')} /></Box>
        ) : !actorData?.data?.length ? (
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
        )}
      </Paper>

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
