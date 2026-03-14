import { Box, Chip, IconButton, Paper, Tooltip } from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import PeopleIcon from '@mui/icons-material/People';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import apiService from '@/services/api';
import type { FederationFollower } from '@/types/api';
import { useSiteContext } from '@/store/SiteContext';
import { useListPageState } from '@/hooks/useListPageState';
import { useTranslation } from 'react-i18next';
import { useFederationMutations } from '@/hooks/useFederationMutations';
import PageHeader from '@/components/shared/PageHeader';
import TableFilterBar from '@/components/shared/TableFilterBar';
import LoadingState from '@/components/shared/LoadingState';
import EmptyState from '@/components/shared/EmptyState';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import DataTable, { type DataTableColumn } from '@/components/shared/DataTable';

export default function FederationFollowers() {
  const { t } = useTranslation();
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
      header: t('federation.followers.columns.name'),
      render: (f) => f.displayName ?? f.username ?? 'Unknown',
    },
    {
      header: t('federation.followers.columns.actorUri'),
      render: (f) => (
        <Box component="span" sx={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>
          {f.followerActorUri}
        </Box>
      ),
    },
    {
      header: t('federation.followers.columns.status'),
      render: (f) => (
        <Chip
          label={f.status}
          size="small"
          color={f.status === 'accepted' ? 'success' : 'default'}
        />
      ),
    },
    {
      header: t('federation.followers.columns.followed'),
      render: (f) => format(new Date(f.followedAt), 'PP'),
    },
    {
      header: t('federation.followers.columns.actions'),
      align: 'right',
      render: (f) => (
        <Tooltip title={t('federation.followers.removeTooltip')}>
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
        <PageHeader title={t('federation.followers.title')} subtitle={t('federation.followers.subtitle')} breadcrumbs={[{ label: t('federation.breadcrumbs.federation'), path: '/federation' }, { label: t('federation.followers.title') }]} />
        <EmptyState icon={<PeopleIcon sx={{ fontSize: 64 }} />} title={t('federation.noSiteSelected')} description={t('federation.followers.noSite')} />
      </Box>
    );
  }

  return (
    <Box data-testid="federation-followers.page">
      <PageHeader title={t('federation.followers.title')} subtitle={t('federation.followers.subtitle')} breadcrumbs={[{ label: t('federation.breadcrumbs.federation'), path: '/federation' }, { label: t('federation.followers.title') }]} />

      <Paper>
        <TableFilterBar
          searchValue={search}
          onSearchChange={setSearch}
          searchPlaceholder={t('federation.followers.searchPlaceholder')}
        />
        {isLoading ? (
          <Box sx={{ p: 3 }}><LoadingState label={t('federation.followers.loading')} /></Box>
        ) : !followers || followers.length === 0 ? (
          <Box sx={{ p: 3 }}>
            <EmptyState
              icon={<PeopleIcon sx={{ fontSize: 48 }} />}
              title={t('federation.followers.empty')}
              description={t('federation.followers.emptyDescription')}
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
        title={t('federation.followers.removeTitle')}
        message={t('federation.followers.removeMessage', { name: deleting?.displayName ?? deleting?.followerActorUri })}
        confirmLabel={t('federation.followers.removeConfirm')}
        onConfirm={() => deleting && removeFollower.mutate(deleting.id)}
        onCancel={closeDelete}
        loading={removeFollower.isPending}
      />
    </Box>
  );
}
