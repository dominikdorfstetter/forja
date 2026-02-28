import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Alert,
  Checkbox,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
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
import { useSnackbar } from 'notistack';
import { useNavigate } from 'react-router';
import { format } from 'date-fns';
import apiService from '@/services/api';
import { resolveError } from '@/utils/errorResolver';
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
import { useBulkSelection } from '@/hooks/useBulkSelection';

export default function PagesPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const navigate = useNavigate();
  const { selectedSiteId } = useSiteContext();
  const { canWrite, isAdmin } = useAuth();
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [formOpen, setFormOpen] = useState(false);
  const [editingPage, setEditingPage] = useState<PageListItem | null>(null);
  const [deletingPage, setDeletingPage] = useState<PageListItem | null>(null);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  const { data: pageData, isLoading, error } = useQuery({
    queryKey: ['pages', selectedSiteId, page, perPage],
    queryFn: () => apiService.getPages(selectedSiteId, { page, per_page: perPage }),
    enabled: !!selectedSiteId,
  });

  const pages = pageData?.data;
  const pageIds = pages?.map((p) => p.id) ?? [];

  const bulk = useBulkSelection([page, perPage, pageData]);

  const createMutation = useMutation({
    mutationFn: (data: CreatePageRequest) => apiService.createPage(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['pages'] }); setFormOpen(false); enqueueSnackbar(t('pages.messages.created'), { variant: 'success' }); },
    onError: (error) => { const { detail, title } = resolveError(error); enqueueSnackbar(detail || title, { variant: 'error' }); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdatePageRequest }) => apiService.updatePage(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['pages'] }); setEditingPage(null); enqueueSnackbar(t('pages.messages.updated'), { variant: 'success' }); },
    onError: (error) => { const { detail, title } = resolveError(error); enqueueSnackbar(detail || title, { variant: 'error' }); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiService.deletePage(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['pages'] }); setDeletingPage(null); enqueueSnackbar(t('pages.messages.deleted'), { variant: 'success' }); },
    onError: (error) => { const { detail, title } = resolveError(error); enqueueSnackbar(detail || title, { variant: 'error' }); },
  });

  const cloneMutation = useMutation({
    mutationFn: (id: string) => apiService.clonePage(id),
    onSuccess: (page) => { queryClient.invalidateQueries({ queryKey: ['pages'] }); enqueueSnackbar(t('pages.messages.cloned'), { variant: 'success' }); navigate(`/pages/${page.id}`); },
    onError: (error) => { const { detail, title } = resolveError(error); enqueueSnackbar(detail || title, { variant: 'error' }); },
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
    onError: (error) => { const { detail, title } = resolveError(error); enqueueSnackbar(detail || title, { variant: 'error' }); },
  });

  const handleBulkPublish = () => bulkMutation.mutate({ ids: [...bulk.selectedIds], action: 'UpdateStatus', status: 'Published' });
  const handleBulkUnpublish = () => bulkMutation.mutate({ ids: [...bulk.selectedIds], action: 'UpdateStatus', status: 'Draft' });
  const handleBulkDelete = () => setBulkDeleteOpen(true);
  const confirmBulkDelete = () => bulkMutation.mutate({ ids: [...bulk.selectedIds], action: 'Delete' });

  return (
    <Box>
      <PageHeader
        title={t('pages.title')}
        subtitle={t('pages.subtitle')}
        action={selectedSiteId ? { label: t('pages.createButton'), icon: <AddIcon />, onClick: () => setFormOpen(true), hidden: !canWrite } : undefined}
      />

      {!selectedSiteId ? (
        <EmptyState icon={<DescriptionIcon sx={{ fontSize: 64 }} />} title={t('common.noSiteSelected')} description={t('pages.empty.noSite')} />
      ) : isLoading ? (
        <LoadingState label={t('pages.loading')} />
      ) : error ? (
        <Alert severity="error">{t('pages.loadError')}</Alert>
      ) : !pages || pages.length === 0 ? (
        <EmptyState icon={<DescriptionIcon sx={{ fontSize: 64 }} />} title={t('pages.empty.title')} description={t('pages.empty.description')} action={{ label: t('pages.createButton'), onClick: () => setFormOpen(true) }} />
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
          <TableContainer component={Paper}>
            <Table>
              <TableHead>
                <TableRow>
                  <TableCell padding="checkbox">
                    <Checkbox
                      indeterminate={bulk.count > 0 && !bulk.allSelected(pageIds)}
                      checked={bulk.allSelected(pageIds)}
                      onChange={() => bulk.selectAll(pageIds)}
                    />
                  </TableCell>
                  <TableCell scope="col">{t('pages.table.route')}</TableCell>
                  <TableCell scope="col">{t('pages.table.type')}</TableCell>
                  <TableCell scope="col">{t('pages.table.status')}</TableCell>
                  <TableCell scope="col">{t('pages.table.inNav')}</TableCell>
                  <TableCell scope="col">{t('pages.table.created')}</TableCell>
                  <TableCell scope="col" align="right">{t('pages.table.actions')}</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {pages.map((pg) => (
                  <TableRow key={pg.id} selected={bulk.isSelected(pg.id)}>
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={bulk.isSelected(pg.id)}
                        onChange={() => bulk.toggle(pg.id)}
                      />
                    </TableCell>
                    <TableCell><Typography variant="body2" fontFamily="monospace">{pg.route}</Typography></TableCell>
                    <TableCell><Chip label={pg.page_type} size="small" variant="outlined" /></TableCell>
                    <TableCell><StatusChip value={pg.status} /></TableCell>
                    <TableCell>{pg.is_in_navigation ? <Chip label={t('common.labels.yes')} size="small" color="primary" variant="outlined" /> : t('common.labels.no')}</TableCell>
                    <TableCell>{format(new Date(pg.created_at), 'PP')}</TableCell>
                    <TableCell align="right">
                      <Tooltip title={t('pages.viewDetails')}><IconButton size="small" aria-label={t('pages.viewDetails')} onClick={() => navigate(`/pages/${pg.id}`)}><VisibilityIcon fontSize="small" /></IconButton></Tooltip>
                      {canWrite && <Tooltip title={t('common.actions.clone')}><IconButton size="small" aria-label={t('common.actions.clone')} onClick={() => cloneMutation.mutate(pg.id)} disabled={cloneMutation.isPending}><ContentCopyIcon fontSize="small" /></IconButton></Tooltip>}
                      {canWrite && <Tooltip title={t('common.actions.edit')}><IconButton size="small" aria-label={t('common.actions.edit')} onClick={() => setEditingPage(pg)}><EditIcon fontSize="small" /></IconButton></Tooltip>}
                      {isAdmin && <Tooltip title={t('common.actions.delete')}><IconButton size="small" aria-label={t('common.actions.delete')} color="error" onClick={() => setDeletingPage(pg)}><DeleteIcon fontSize="small" /></IconButton></Tooltip>}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
          {pageData?.meta && (
            <TablePagination
              component="div"
              count={pageData.meta.total_items}
              page={pageData.meta.page - 1}
              onPageChange={(_, p) => setPage(p + 1)}
              rowsPerPage={pageData.meta.page_size}
              onRowsPerPageChange={(e) => { setPerPage(+e.target.value); setPage(1); }}
              rowsPerPageOptions={[10, 25, 50]}
            />
          )}
        </>
      )}

      <PageFormDialog open={formOpen} onSubmit={(data) => createMutation.mutate(data)} onClose={() => setFormOpen(false)} loading={createMutation.isPending} />
      <PageFormDialog open={!!editingPage} page={editingPage} onSubmit={(data) => editingPage && updateMutation.mutate({ id: editingPage.id, data })} onClose={() => setEditingPage(null)} loading={updateMutation.isPending} />
      <ConfirmDialog open={!!deletingPage} title={t('pages.deleteDialog.title')} message={t('pages.deleteDialog.message', { route: deletingPage?.route })} confirmLabel={t('common.actions.delete')} onConfirm={() => deletingPage && deleteMutation.mutate(deletingPage.id)} onCancel={() => setDeletingPage(null)} loading={deleteMutation.isPending} />
      <ConfirmDialog open={bulkDeleteOpen} title={t('bulk.deleteDialog.title')} message={t('bulk.deleteDialog.message', { count: bulk.count })} confirmLabel={t('common.actions.delete')} onConfirm={confirmBulkDelete} onCancel={() => setBulkDeleteOpen(false)} loading={bulkMutation.isPending} />
    </Box>
  );
}
