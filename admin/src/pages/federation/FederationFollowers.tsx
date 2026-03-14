import { Box, Chip, IconButton, Paper, Tooltip } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import PeopleIcon from '@mui/icons-material/People';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import apiService from '@/services/api';
import type { FederationFollower } from '@/types/api';
import { useSiteContext } from '@/store/SiteContext';
import { useListPageState } from '@/hooks/useListPageState';
import { useFederationMutations } from '@/hooks/useFederationMutations';
import PageHeader from '@/components/shared/PageHeader';
import TableFilterBar from '@/components/shared/TableFilterBar';
import LoadingState from '@/components/shared/LoadingState';
import EmptyState from '@/components/shared/EmptyState';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import DataTable, { type DataTableColumn } from '@/components/shared/DataTable';

export default function FederationFollowers() {
  const { selectedSiteId } = useSiteContext();
  const {
    page, pageSize, deleting,
    search, setSearch, debouncedSearch,
    openDelete, closeDelete,
    handlePageChange, handleRowsPerPageChange,
  } = useListPageState<FederationFollower>();

  const { removeFollower } = useFederationMutations(selectedSiteId);

  const { data, isLoading } = useQuery({
    queryKey: ['federation-followers', selectedSiteId, page, pageSize, debouncedSearch],
    queryFn: () => apiService.getFederationFollowers(selectedSiteId, {
      page,
      page_size: pageSize,
      search: debouncedSearch || undefined,
    }),
    enabled: !!selectedSiteId,
  });

  const followers = data?.data;

  const columns: DataTableColumn<FederationFollower>[] = [
    {
      header: 'Name',
      render: (f) => f.displayName ?? f.username ?? 'Unknown',
    },
    {
      header: 'Actor URI',
      render: (f) => (
        <Box component="span" sx={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
          {f.followerActorUri}
        </Box>
      ),
    },
    {
      header: 'Status',
      render: (f) => (
        <Chip
          label={f.status}
          size="small"
          color={f.status === 'accepted' ? 'success' : 'default'}
        />
      ),
    },
    {
      header: 'Followed',
      render: (f) => format(new Date(f.followedAt), 'PP'),
    },
    {
      header: 'Actions',
      align: 'right',
      render: (f) => (
        <Tooltip title="Remove follower">
          <IconButton size="small" color="error" onClick={() => openDelete(f)}>
            <DeleteIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      ),
    },
  ];

  if (!selectedSiteId) {
    return (
      <Box data-testid="federation-followers.page">
        <PageHeader title="Followers" subtitle="Fediverse followers for this site" />
        <EmptyState icon={<PeopleIcon sx={{ fontSize: 64 }} />} title="No site selected" description="Select a site to view followers." />
      </Box>
    );
  }

  return (
    <Box data-testid="federation-followers.page">
      <PageHeader title="Followers" subtitle="Fediverse followers for this site" />

      <Paper>
        <TableFilterBar
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder="Search followers..."
        />
        {isLoading ? (
          <Box sx={{ p: 3 }}><LoadingState label="Loading followers..." /></Box>
        ) : !followers || followers.length === 0 ? (
          <Box sx={{ p: 3 }}>
            <EmptyState
              icon={<PeopleIcon sx={{ fontSize: 48 }} />}
              title="No followers yet"
              description="When other fediverse users follow your site, they will appear here."
            />
          </Box>
        ) : (
          <DataTable
            data={followers}
            columns={columns}
            getRowKey={(f) => f.id}
            meta={data?.meta}
            page={page}
            onPageChange={handlePageChange}
            rowsPerPage={pageSize}
            onRowsPerPageChange={handleRowsPerPageChange}
          />
        )}
      </Paper>

      <ConfirmDialog
        open={!!deleting}
        title="Remove Follower"
        message={`Remove ${deleting?.displayName ?? deleting?.followerActorUri}? They will need to re-follow your site.`}
        confirmLabel="Remove"
        onConfirm={() => deleting && removeFollower.mutate(deleting.id)}
        onCancel={closeDelete}
        loading={removeFollower.isPending}
      />
    </Box>
  );
}
