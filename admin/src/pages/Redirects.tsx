import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Box, Paper, Chip, IconButton, Tooltip, TableSortLabel } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import AltRouteIcon from '@mui/icons-material/AltRoute';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import apiService from '@/services/api';
import type { Redirect, CreateRedirectRequest, UpdateRedirectRequest } from '@/types/api';
import { useSiteContext } from '@/store/SiteContext';
import { useAuth } from '@/store/AuthContext';
import { useListPageState } from '@/hooks/useListPageState';
import { useCrudMutations } from '@/hooks/useCrudMutations';
import PageHeader from '@/components/shared/PageHeader';
import LoadingState from '@/components/shared/LoadingState';
import EmptyState from '@/components/shared/EmptyState';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import TableFilterBar from '@/components/shared/TableFilterBar';
import DataTable, { type DataTableColumn } from '@/components/shared/DataTable';
import RedirectFormDialog from '@/components/redirects/RedirectFormDialog';

export default function RedirectsPage() {
  const { t } = useTranslation();
  const { selectedSiteId } = useSiteContext();
  const { canWrite } = useAuth();

  const {
    page, pageSize, formOpen, editing, deleting,
    search, setSearch, debouncedSearch,
    sortBy, sortDir, handleSort,
    openCreate, closeForm, openEdit, closeEdit, openDelete, closeDelete,
    handlePageChange, handleRowsPerPageChange,
  } = useListPageState<Redirect>();

  // Command palette action listener
  useEffect(() => {
    const handler = (e: Event) => {
      if ((e as CustomEvent).detail === 'create-redirect') openCreate();
    };
    window.addEventListener('command-palette:action', handler);
    return () => window.removeEventListener('command-palette:action', handler);
  }, [openCreate]);

  const { data, isLoading } = useQuery({
    queryKey: ['redirects', selectedSiteId, page, pageSize, debouncedSearch, sortBy, sortDir],
    queryFn: () => apiService.getRedirects(selectedSiteId, { page, page_size: pageSize, search: debouncedSearch || undefined, sort_by: sortBy || undefined, sort_dir: sortBy ? sortDir : undefined }),
    enabled: !!selectedSiteId,
  });
  const redirects = data?.data;

  const { createMutation, updateMutation, deleteMutation } = useCrudMutations<
    CreateRedirectRequest, UpdateRedirectRequest
  >({
    queryKey: 'redirects',
    create: {
      mutationFn: (req) => apiService.createRedirect(selectedSiteId, req),
      successMessage: t('redirects.messages.created'),
      onSuccess: () => closeForm(),
    },
    update: {
      mutationFn: ({ id, data }) => apiService.updateRedirect(id, data),
      successMessage: t('redirects.messages.updated'),
      onSuccess: () => closeEdit(),
    },
    delete: {
      mutationFn: (id) => apiService.deleteRedirect(id),
      successMessage: t('redirects.messages.deleted'),
      onSuccess: () => closeDelete(),
    },
  });

  const columns: DataTableColumn<Redirect>[] = [
    {
      header: (
        <TableSortLabel
          active={sortBy === 'source_path'}
          direction={sortBy === 'source_path' ? sortDir : 'asc'}
          onClick={() => handleSort('source_path')}
        >
          {t('redirects.table.sourcePath')}
        </TableSortLabel>
      ),
      render: (r) => <span style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{r.source_path}</span>,
    },
    {
      header: (
        <TableSortLabel
          active={sortBy === 'destination_path'}
          direction={sortBy === 'destination_path' ? sortDir : 'asc'}
          onClick={() => handleSort('destination_path')}
        >
          {t('redirects.table.destination')}
        </TableSortLabel>
      ),
      render: (r) => <span style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{r.destination_path}</span>,
    },
    {
      header: (
        <TableSortLabel
          active={sortBy === 'status_code'}
          direction={sortBy === 'status_code' ? sortDir : 'asc'}
          onClick={() => handleSort('status_code')}
        >
          {t('redirects.table.type')}
        </TableSortLabel>
      ),
      render: (r) => <Chip label={r.status_code === 301 ? t('redirects.table.permanent') : t('redirects.table.temporary')} size="small" variant="outlined" color={r.status_code === 301 ? 'primary' : 'secondary'} />,
    },
    {
      header: (
        <TableSortLabel
          active={sortBy === 'is_active'}
          direction={sortBy === 'is_active' ? sortDir : 'asc'}
          onClick={() => handleSort('is_active')}
        >
          {t('redirects.table.status')}
        </TableSortLabel>
      ),
      render: (r) => <Chip label={r.is_active ? t('common.status.active') : t('common.status.inactive')} size="small" color={r.is_active ? 'success' : 'default'} />,
    },
    {
      header: (
        <TableSortLabel
          active={sortBy === 'created_at'}
          direction={sortBy === 'created_at' ? sortDir : 'asc'}
          onClick={() => handleSort('created_at')}
        >
          {t('redirects.table.created')}
        </TableSortLabel>
      ),
      render: (r) => format(new Date(r.created_at), 'PP'),
    },
    {
      header: t('redirects.table.actions'),
      align: 'right',
      render: (r) => (
        <>
          {canWrite && <Tooltip title={t('common.actions.edit')}><IconButton size="small" onClick={() => openEdit(r)}><EditIcon fontSize="small" /></IconButton></Tooltip>}
          {canWrite && <Tooltip title={t('common.actions.delete')}><IconButton size="small" color="error" onClick={() => openDelete(r)}><DeleteIcon fontSize="small" /></IconButton></Tooltip>}
        </>
      ),
    },
  ];

  return (
    <Box data-testid="redirects.page">
      <PageHeader
        title={t('redirects.title')}
        subtitle={t('redirects.subtitle')}
        action={selectedSiteId ? { label: t('redirects.addRedirect'), icon: <AddIcon />, onClick: openCreate, hidden: !canWrite } : undefined}
      />

      {!selectedSiteId ? (
        <EmptyState icon={<AltRouteIcon sx={{ fontSize: 64 }} />} title={t('common.noSiteSelected')} description={t('redirects.empty.noSite')} />
      ) : (
        <Paper>
          <TableFilterBar
            searchValue={search}
            onSearchChange={setSearch}
            searchPlaceholder={t('redirects.searchPlaceholder')}
          />
          {isLoading ? (
            <Box sx={{ p: 3 }}><LoadingState label={t('redirects.loading')} /></Box>
          ) : !redirects || redirects.length === 0 ? (
            <Box sx={{ p: 3 }}><EmptyState icon={<AltRouteIcon sx={{ fontSize: 48 }} />} title={t('redirects.empty.title')} description={t('redirects.empty.description')} action={canWrite ? { label: t('redirects.addRedirect'), onClick: openCreate } : undefined} /></Box>
          ) : (
            <DataTable
              data={redirects}
              columns={columns}
              getRowKey={(r) => r.id}
              meta={data?.meta}
              page={page}
              onPageChange={handlePageChange}
              rowsPerPage={pageSize}
              onRowsPerPageChange={handleRowsPerPageChange}
            />
          )}
        </Paper>
      )}

      <RedirectFormDialog open={formOpen} onSubmitCreate={(data) => createMutation.mutate(data)} onClose={closeForm} loading={createMutation.isPending} />
      <RedirectFormDialog open={!!editing} redirect={editing} onSubmitUpdate={(data) => editing && updateMutation.mutate({ id: editing.id, data })} onClose={closeEdit} loading={updateMutation.isPending} />
      <ConfirmDialog open={!!deleting} title={t('redirects.deleteDialog.title')} message={t('redirects.deleteDialog.message', { source: deleting?.source_path })} confirmLabel={t('common.actions.delete')} onConfirm={() => deleting && deleteMutation.mutate(deleting.id)} onCancel={closeDelete} loading={deleteMutation.isPending} confirmationText={t('common.actions.delete')} />
    </Box>
  );
}
