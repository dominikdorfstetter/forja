import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Alert,
  Checkbox,
  Paper,
  Typography,
  Chip,
  IconButton,
  Tooltip,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import VisibilityIcon from '@mui/icons-material/Visibility';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DescriptionIcon from '@mui/icons-material/Description';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { format } from 'date-fns';
import apiService from '@/services/api';
import type { PageListItem, CreatePageRequest, UpdatePageRequest, BulkContentRequest } from '@/types/api';
import { useSiteContext } from '@/store/SiteContext';
import { useAuth } from '@/store/AuthContext';
import PageHeader from '@/components/shared/PageHeader';
import LoadingState from '@/components/shared/LoadingState';
import EmptyState from '@/components/shared/EmptyState';
import StatusChip from '@/components/shared/StatusChip';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import BulkActionToolbar from '@/components/shared/BulkActionToolbar';
import PageFormDialog from '@/components/pages/PageFormDialog';
import DataTable, { type DataTableColumn } from '@/components/shared/DataTable';
import { useListPageState } from '@/hooks/useListPageState';
import { useCrudMutations } from '@/hooks/useCrudMutations';
import { useErrorSnackbar } from '@/hooks/useErrorSnackbar';
import { useBulkSelection } from '@/hooks/useBulkSelection';

export default function PagesPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { selectedSiteId } = useSiteContext();
  const { canWrite, isAdmin } = useAuth();
  const { showError, enqueueSnackbar } = useErrorSnackbar();

  const {
    page, perPage, formOpen, editing: editingPage, deleting: deletingPage,
    openCreate, closeForm, openEdit: setEditingPage, closeEdit,
    openDelete: setDeletingPage, closeDelete,
    handlePageChange, handleRowsPerPageChange,
  } = useListPageState<PageListItem>();

  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  const { data: pageData, isLoading, error } = useQuery({
    queryKey: ['pages', selectedSiteId, page, perPage],
    queryFn: () => apiService.getPages(selectedSiteId, { page, per_page: perPage }),
    enabled: !!selectedSiteId,
  });

  const pages = pageData?.data;
  const pageIds = pages?.map((p) => p.id) ?? [];

  const bulk = useBulkSelection([page, perPage, pageData]);

  const { createMutation, updateMutation, deleteMutation } = useCrudMutations<CreatePageRequest, UpdatePageRequest>({
    queryKey: 'pages',
    create: {
      mutationFn: (data) => apiService.createPage(data),
      successMessage: t('pages.messages.created'),
      onSuccess: () => { closeForm(); },
    },
    update: {
      mutationFn: ({ id, data }) => apiService.updatePage(id, data),
      successMessage: t('pages.messages.updated'),
      onSuccess: () => { closeEdit(); },
    },
    delete: {
      mutationFn: (id) => apiService.deletePage(id),
      successMessage: t('pages.messages.deleted'),
      onSuccess: () => { closeDelete(); },
    },
  });

  const cloneMutation = useMutation({
    mutationFn: (id: string) => apiService.clonePage(id),
    onSuccess: (page) => {
      queryClient.invalidateQueries({ queryKey: ['pages'] });
      enqueueSnackbar(t('pages.messages.cloned'), { variant: 'success' });
      navigate(`/pages/${page.id}`);
    },
    onError: showError,
  });

  const bulkMutation = useMutation({
    mutationFn: (data: BulkContentRequest) => apiService.bulkPages(selectedSiteId, data),
    onSuccess: (resp) => {
      queryClient.invalidateQueries({ queryKey: ['pages'] });
      bulk.clear();
      setBulkDeleteOpen(false);
      if (resp.failed === 0) {
        enqueueSnackbar(t('bulk.messages.success', { count: resp.succeeded }), { variant: 'success' });
      } else {
        enqueueSnackbar(t('bulk.messages.partial', { succeeded: resp.succeeded, failed: resp.failed }), { variant: 'warning' });
      }
    },
    onError: showError,
  });

  const handleBulkPublish = () => bulkMutation.mutate({ ids: [...bulk.selectedIds], action: 'UpdateStatus', status: 'Published' });
  const handleBulkUnpublish = () => bulkMutation.mutate({ ids: [...bulk.selectedIds], action: 'UpdateStatus', status: 'Draft' });
  const handleBulkDelete = () => setBulkDeleteOpen(true);
  const confirmBulkDelete = () => bulkMutation.mutate({ ids: [...bulk.selectedIds], action: 'Delete' });

  const columns: DataTableColumn<PageListItem>[] = [
    {
      header: (
        <Checkbox
          indeterminate={bulk.count > 0 && !bulk.allSelected(pageIds)}
          checked={bulk.allSelected(pageIds)}
          onChange={() => bulk.selectAll(pageIds)}
        />
      ),
      padding: 'checkbox',
      render: (pg) => (
        <Checkbox
          checked={bulk.isSelected(pg.id)}
          onChange={() => bulk.toggle(pg.id)}
        />
      ),
    },
    {
      header: t('pages.table.route'),
      scope: 'col',
      render: (pg) => <Typography variant="body2" fontFamily="monospace">{pg.route}</Typography>,
    },
    {
      header: t('pages.table.type'),
      scope: 'col',
      render: (pg) => <Chip label={pg.page_type} size="small" variant="outlined" />,
    },
    {
      header: t('pages.table.status'),
      scope: 'col',
      render: (pg) => <StatusChip value={pg.status} />,
    },
    {
      header: t('pages.table.inNav'),
      scope: 'col',
      render: (pg) => pg.is_in_navigation ? <Chip label={t('common.labels.yes')} size="small" color="primary" variant="outlined" /> : t('common.labels.no'),
    },
    {
      header: t('pages.table.created'),
      scope: 'col',
      render: (pg) => format(new Date(pg.created_at), 'PP'),
    },
    {
      header: t('pages.table.actions'),
      scope: 'col',
      align: 'right',
      render: (pg) => (
        <>
          <Tooltip title={t('pages.viewDetails')}><IconButton size="small" aria-label={t('pages.viewDetails')} onClick={() => navigate(`/pages/${pg.id}`)}><VisibilityIcon fontSize="small" /></IconButton></Tooltip>
          {canWrite && <Tooltip title={t('common.actions.clone')}><IconButton size="small" aria-label={t('common.actions.clone')} onClick={() => cloneMutation.mutate(pg.id)} disabled={cloneMutation.isPending}><ContentCopyIcon fontSize="small" /></IconButton></Tooltip>}
          {canWrite && <Tooltip title={t('common.actions.edit')}><IconButton size="small" aria-label={t('common.actions.edit')} onClick={() => setEditingPage(pg)}><EditIcon fontSize="small" /></IconButton></Tooltip>}
          {isAdmin && <Tooltip title={t('common.actions.delete')}><IconButton size="small" aria-label={t('common.actions.delete')} color="error" onClick={() => setDeletingPage(pg)}><DeleteIcon fontSize="small" /></IconButton></Tooltip>}
        </>
      ),
    },
  ];

  return (
    <Box>
      <PageHeader
        title={t('pages.title')}
        subtitle={t('pages.subtitle')}
        action={selectedSiteId ? { label: t('pages.createButton'), icon: <AddIcon />, onClick: openCreate, hidden: !canWrite } : undefined}
      />

      {!selectedSiteId ? (
        <EmptyState icon={<DescriptionIcon sx={{ fontSize: 64 }} />} title={t('common.noSiteSelected')} description={t('pages.empty.noSite')} />
      ) : isLoading ? (
        <LoadingState label={t('pages.loading')} />
      ) : error ? (
        <Alert severity="error">{t('pages.loadError')}</Alert>
      ) : !pages || pages.length === 0 ? (
        <EmptyState icon={<DescriptionIcon sx={{ fontSize: 64 }} />} title={t('pages.empty.title')} description={t('pages.empty.description')} action={{ label: t('pages.createButton'), onClick: openCreate }} />
      ) : (
        <>
          <BulkActionToolbar
            selectedCount={bulk.count}
            onPublish={handleBulkPublish}
            onUnpublish={handleBulkUnpublish}
            onDelete={handleBulkDelete}
            onClear={bulk.clear}
            canWrite={canWrite}
            isAdmin={isAdmin}
            loading={bulkMutation.isPending}
          />
          <Paper>
            <DataTable<PageListItem>
              data={pages}
              columns={columns}
              getRowKey={(pg) => pg.id}
              meta={pageData?.meta}
              page={page}
              onPageChange={handlePageChange}
              rowsPerPage={perPage}
              onRowsPerPageChange={handleRowsPerPageChange}
              isRowSelected={(pg) => bulk.isSelected(pg.id)}
              size="medium"
            />
          </Paper>
        </>
      )}

      <PageFormDialog open={formOpen} onSubmit={(data) => createMutation.mutate(data)} onClose={closeForm} loading={createMutation.isPending} />
      <PageFormDialog open={!!editingPage} page={editingPage} onSubmit={(data) => editingPage && updateMutation.mutate({ id: editingPage.id, data })} onClose={closeEdit} loading={updateMutation.isPending} />
      <ConfirmDialog open={!!deletingPage} title={t('pages.deleteDialog.title')} message={t('pages.deleteDialog.message', { route: deletingPage?.route })} confirmLabel={t('common.actions.delete')} onConfirm={() => deletingPage && deleteMutation.mutate(deletingPage.id)} onCancel={closeDelete} loading={deleteMutation.isPending} />
      <ConfirmDialog open={bulkDeleteOpen} title={t('bulk.deleteDialog.title')} message={t('bulk.deleteDialog.message', { count: bulk.count })} confirmLabel={t('common.actions.delete')} onConfirm={confirmBulkDelete} onCancel={() => setBulkDeleteOpen(false)} loading={bulkMutation.isPending} />
    </Box>
  );
}
