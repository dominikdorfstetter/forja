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
import { useFederationMutations } from '@/hooks/useFederationMutations';
import PageHeader from '@/components/shared/PageHeader';
import LoadingState from '@/components/shared/LoadingState';
import EmptyState from '@/components/shared/EmptyState';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import DataTable, { type DataTableColumn } from '@/components/shared/DataTable';

export default function FederationBlocklist() {
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
      header: 'Domain',
      render: (b) => b.instanceDomain,
    },
    {
      header: 'Reason',
      render: (b) => b.reason ?? '-',
    },
    {
      header: 'Blocked',
      render: (b) => format(new Date(b.blockedAt), 'PP'),
    },
    {
      header: 'Actions',
      align: 'right',
      render: (b) => (
        <Tooltip title="Unblock instance">
          <IconButton size="small" color="error" onClick={() => instanceState.openDelete(b)}>
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      ),
    },
  ];

  const actorColumns: DataTableColumn<FederationBlockedActor>[] = [
    {
      header: 'Actor URI',
      render: (b) => (
        <Box component="span" sx={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
          {b.blockedActorUri}
        </Box>
      ),
    },
    {
      header: 'Reason',
      render: (b) => b.reason ?? '-',
    },
    {
      header: 'Blocked',
      render: (b) => format(new Date(b.blockedAt), 'PP'),
    },
    {
      header: 'Actions',
      align: 'right',
      render: (b) => (
        <Tooltip title="Unblock actor">
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
        <PageHeader title="Blocklist" subtitle="Blocked instances and actors" />
        <EmptyState icon={<BlockIcon sx={{ fontSize: 64 }} />} title="No site selected" description="Select a site to manage blocks." />
      </Box>
    );
  }

  const isLoading = tab === 0 ? instancesLoading : actorsLoading;

  return (
    <Box data-testid="federation-blocklist.page">
      <PageHeader title="Blocklist" subtitle="Blocked instances and actors" />

      <Paper>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ borderBottom: 1, borderColor: 'divider' }}>
          <Tab label="Instances" />
          <Tab label="Actors" />
        </Tabs>

        {isLoading ? (
          <Box sx={{ p: 3 }}><LoadingState label="Loading blocklist..." /></Box>
        ) : tab === 0 ? (
          !instanceData?.data.length ? (
            <Box sx={{ p: 3 }}>
              <EmptyState
                icon={<BlockIcon sx={{ fontSize: 48 }} />}
                title="No blocked instances"
                description="Blocked instances will appear here."
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
          !actorData?.data.length ? (
            <Box sx={{ p: 3 }}>
              <EmptyState
                icon={<BlockIcon sx={{ fontSize: 48 }} />}
                title="No blocked actors"
                description="Blocked actors will appear here."
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
        title="Unblock Instance"
        message={`Unblock ${instanceState.deleting?.instanceDomain}?`}
        confirmLabel="Unblock"
        onConfirm={() => instanceState.deleting && unblockInstanceMutation.mutate(instanceState.deleting.id)}
        onCancel={instanceState.closeDelete}
        loading={unblockInstanceMutation.isPending}
      />

      <ConfirmDialog
        open={!!actorState.deleting}
        title="Unblock Actor"
        message={`Unblock ${actorState.deleting?.blockedActorUri}?`}
        confirmLabel="Unblock"
        onConfirm={() => actorState.deleting && unblockActorMutation.mutate(actorState.deleting.id)}
        onCancel={actorState.closeDelete}
        loading={unblockActorMutation.isPending}
      />
    </Box>
  );
}
