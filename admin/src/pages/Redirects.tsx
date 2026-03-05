import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Box, Paper, Chip, IconButton, Tooltip } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import AltRouteIcon from '@mui/icons-material/AltRoute';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import apiService from '@/services/api';
import type { Redirect, CreateRedirectRequest, UpdateRedirectRequest } from '@/types/api';
import { useSiteContext } from '@/store/SiteContext';
import { useListPageState } from '@/hooks/useListPageState';
import { useCrudMutations } from '@/hooks/useCrudMutations';
import PageHeader from '@/components/shared/PageHeader';
import LoadingState from '@/components/shared/LoadingState';
import EmptyState from '@/components/shared/EmptyState';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import DataTable, { type DataTableColumn } from '@/components/shared/DataTable';
import RedirectFormDialog from '@/components/redirects/RedirectFormDialog';

export default function RedirectsPage() {
  const { t } = useTranslation();
  const { selectedSiteId } = useSiteContext();

  const {
    page, perPage, formOpen, editing, deleting,
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
    queryKey: ['redirects', selectedSiteId, page, perPage],
    queryFn: () => apiService.getRedirects(selectedSiteId, { page, per_page: perPage }),
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
    { header: t('redirects.table.sourcePath'), render: (r) => <span style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{r.source_path}</span> },
    { header: t('redirects.table.destination'), render: (r) => <span style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{r.destination_path}</span> },
    { header: t('redirects.table.type'), render: (r) => <Chip label={r.status_code === 301 ? t('redirects.table.permanent') : t('redirects.table.temporary')} size="small" variant="outlined" color={r.status_code === 301 ? 'primary' : 'secondary'} /> },
    { header: t('redirects.table.status'), render: (r) => <Chip label={r.is_active ? t('common.status.active') : t('common.status.inactive')} size="small" color={r.is_active ? 'success' : 'default'} /> },
    { header: t('redirects.table.created'), render: (r) => format(new Date(r.created_at), 'PP') },
    {
      header: t('redirects.table.actions'),
      align: 'right',
      render: (r) => (
        <>
          <Tooltip title={t('common.actions.edit')}><IconButton size="small" onClick={() => openEdit(r)}><EditIcon fontSize="small" /></IconButton></Tooltip>
          <Tooltip title={t('common.actions.delete')}><IconButton size="small" color="error" onClick={() => openDelete(r)}><DeleteIcon fontSize="small" /></IconButton></Tooltip>
        </>
      ),
    },
  ];

  return (
    <Box>
      <PageHeader
        title={t('redirects.title')}
        subtitle={t('redirects.subtitle')}
        action={selectedSiteId ? { label: t('redirects.addRedirect'), icon: <AddIcon />, onClick: openCreate } : undefined}
      />

      {!selectedSiteId ? (
        <EmptyState icon={<AltRouteIcon sx={{ fontSize: 64 }} />} title={t('common.noSiteSelected')} description={t('redirects.empty.noSite')} />
      ) : (
        <Paper sx={{ p: 3 }}>
          {isLoading ? (
            <LoadingState label={t('redirects.loading')} />
          ) : !redirects || redirects.length === 0 ? (
            <EmptyState icon={<AltRouteIcon sx={{ fontSize: 48 }} />} title={t('redirects.empty.title')} description={t('redirects.empty.description')} action={{ label: t('redirects.addRedirect'), onClick: openCreate }} />
          ) : (
            <DataTable
              data={redirects}
              columns={columns}
              getRowKey={(r) => r.id}
              meta={data?.meta}
              page={page}
              onPageChange={handlePageChange}
              rowsPerPage={perPage}
              onRowsPerPageChange={handleRowsPerPageChange}
            />
          )}
        </Paper>
      )}

      <RedirectFormDialog open={formOpen} onSubmitCreate={(data) => createMutation.mutate(data)} onClose={closeForm} loading={createMutation.isPending} />
      <RedirectFormDialog open={!!editing} redirect={editing} onSubmitUpdate={(data) => editing && updateMutation.mutate({ id: editing.id, data })} onClose={closeEdit} loading={updateMutation.isPending} />
      <ConfirmDialog open={!!deleting} title={t('redirects.deleteDialog.title')} message={t('redirects.deleteDialog.message', { source: deleting?.source_path })} confirmLabel={t('common.actions.delete')} onConfirm={() => deleting && deleteMutation.mutate(deleting.id)} onCancel={closeDelete} loading={deleteMutation.isPending} />
    </Box>
  );
}
