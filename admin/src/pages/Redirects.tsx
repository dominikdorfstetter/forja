import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Tooltip,
  TablePagination,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import AltRouteIcon from '@mui/icons-material/AltRoute';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { format } from 'date-fns';
import apiService from '@/services/api';
import { resolveError } from '@/utils/errorResolver';
import type { Redirect, CreateRedirectRequest, UpdateRedirectRequest } from '@/types/api';
import { useSiteContext } from '@/store/SiteContext';
import PageHeader from '@/components/shared/PageHeader';
import LoadingState from '@/components/shared/LoadingState';
import EmptyState from '@/components/shared/EmptyState';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import RedirectFormDialog from '@/components/redirects/RedirectFormDialog';

export default function RedirectsPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const { selectedSiteId } = useSiteContext();

  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [formOpen, setFormOpen] = useState(false);
  const [editingRedirect, setEditingRedirect] = useState<Redirect | null>(null);
  const [deletingRedirect, setDeletingRedirect] = useState<Redirect | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['redirects', selectedSiteId, page, perPage],
    queryFn: () => apiService.getRedirects(selectedSiteId, { page, per_page: perPage }),
    enabled: !!selectedSiteId,
  });
  const redirects = data?.data;

  const createMutation = useMutation({
    mutationFn: (req: CreateRedirectRequest) => apiService.createRedirect(selectedSiteId, req),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['redirects'] }); setFormOpen(false); enqueueSnackbar(t('redirects.messages.created'), { variant: 'success' }); },
    onError: (error) => { const { detail, title } = resolveError(error); enqueueSnackbar(detail || title, { variant: 'error' }); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateRedirectRequest }) => apiService.updateRedirect(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['redirects'] }); setEditingRedirect(null); enqueueSnackbar(t('redirects.messages.updated'), { variant: 'success' }); },
    onError: (error) => { const { detail, title } = resolveError(error); enqueueSnackbar(detail || title, { variant: 'error' }); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiService.deleteRedirect(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['redirects'] }); setDeletingRedirect(null); enqueueSnackbar(t('redirects.messages.deleted'), { variant: 'success' }); },
    onError: (error) => { const { detail, title } = resolveError(error); enqueueSnackbar(detail || title, { variant: 'error' }); },
  });

  return (
    <Box>
      <PageHeader
        title={t('redirects.title')}
        subtitle={t('redirects.subtitle')}
        action={selectedSiteId ? {
          label: t('redirects.addRedirect'),
          icon: <AddIcon />,
          onClick: () => setFormOpen(true),
        } : undefined}
      />

      {!selectedSiteId ? (
        <EmptyState
          icon={<AltRouteIcon sx={{ fontSize: 64 }} />}
          title={t('common.noSiteSelected')}
          description={t('redirects.empty.noSite')}
        />
      ) : (
        <Paper sx={{ p: 3 }}>
          {isLoading ? (
            <LoadingState label={t('redirects.loading')} />
          ) : !redirects || redirects.length === 0 ? (
            <EmptyState
              icon={<AltRouteIcon sx={{ fontSize: 48 }} />}
              title={t('redirects.empty.title')}
              description={t('redirects.empty.description')}
              action={{ label: t('redirects.addRedirect'), onClick: () => setFormOpen(true) }}
            />
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>{t('redirects.table.sourcePath')}</TableCell>
                    <TableCell>{t('redirects.table.destination')}</TableCell>
                    <TableCell>{t('redirects.table.type')}</TableCell>
                    <TableCell>{t('redirects.table.status')}</TableCell>
                    <TableCell>{t('redirects.table.created')}</TableCell>
                    <TableCell align="right">{t('redirects.table.actions')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {redirects.map((r) => (
                    <TableRow key={r.id}>
                      <TableCell sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'monospace', fontSize: '0.85rem' }}>
                        {r.source_path}
                      </TableCell>
                      <TableCell sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontFamily: 'monospace', fontSize: '0.85rem' }}>
                        {r.destination_path}
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={r.status_code === 301 ? t('redirects.table.permanent') : t('redirects.table.temporary')}
                          size="small"
                          variant="outlined"
                          color={r.status_code === 301 ? 'primary' : 'secondary'}
                        />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={r.is_active ? t('common.status.active') : t('common.status.inactive')}
                          size="small"
                          color={r.is_active ? 'success' : 'default'}
                        />
                      </TableCell>
                      <TableCell>{format(new Date(r.created_at), 'PP')}</TableCell>
                      <TableCell align="right">
                        <Tooltip title={t('common.actions.edit')}>
                          <IconButton size="small" onClick={() => setEditingRedirect(r)}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title={t('common.actions.delete')}>
                          <IconButton size="small" color="error" onClick={() => setDeletingRedirect(r)}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
          {data?.meta && (
            <TablePagination
              component="div"
              count={data.meta.total_items}
              page={data.meta.page - 1}
              onPageChange={(_, p) => setPage(p + 1)}
              rowsPerPage={data.meta.page_size}
              onRowsPerPageChange={(e) => { setPerPage(+e.target.value); setPage(1); }}
              rowsPerPageOptions={[10, 25, 50]}
            />
          )}
        </Paper>
      )}

      {/* Create dialog */}
      <RedirectFormDialog
        open={formOpen}
        onSubmitCreate={(data) => createMutation.mutate(data)}
        onClose={() => setFormOpen(false)}
        loading={createMutation.isPending}
      />

      {/* Edit dialog */}
      <RedirectFormDialog
        open={!!editingRedirect}
        redirect={editingRedirect}
        onSubmitUpdate={(data) => editingRedirect && updateMutation.mutate({ id: editingRedirect.id, data })}
        onClose={() => setEditingRedirect(null)}
        loading={updateMutation.isPending}
      />

      {/* Delete confirmation */}
      <ConfirmDialog
        open={!!deletingRedirect}
        title={t('redirects.deleteDialog.title')}
        message={t('redirects.deleteDialog.message', { source: deletingRedirect?.source_path })}
        confirmLabel={t('common.actions.delete')}
        onConfirm={() => deletingRedirect && deleteMutation.mutate(deletingRedirect.id)}
        onCancel={() => setDeletingRedirect(null)}
        loading={deleteMutation.isPending}
      />
    </Box>
  );
}
