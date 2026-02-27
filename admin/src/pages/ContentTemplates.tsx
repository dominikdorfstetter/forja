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
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import ViewQuiltIcon from '@mui/icons-material/ViewQuilt';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { format } from 'date-fns';
import apiService from '@/services/api';
import { resolveError } from '@/utils/errorResolver';
import type { ContentTemplate, CreateContentTemplateRequest, UpdateContentTemplateRequest } from '@/types/api';
import { useSiteContext } from '@/store/SiteContext';
import { useAuth } from '@/store/AuthContext';
import PageHeader from '@/components/shared/PageHeader';
import LoadingState from '@/components/shared/LoadingState';
import EmptyState from '@/components/shared/EmptyState';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import ContentTemplateFormDialog from '@/components/content-templates/ContentTemplateFormDialog';

export default function ContentTemplatesPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const { selectedSiteId } = useSiteContext();
  const { canWrite, isAdmin } = useAuth();

  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [formOpen, setFormOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ContentTemplate | null>(null);
  const [deletingTemplate, setDeletingTemplate] = useState<ContentTemplate | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ['content-templates', selectedSiteId, page, perPage],
    queryFn: () => apiService.getContentTemplates(selectedSiteId, { page, per_page: perPage }),
    enabled: !!selectedSiteId,
  });
  const templates = data?.data;

  const createMutation = useMutation({
    mutationFn: (req: CreateContentTemplateRequest) => apiService.createContentTemplate(selectedSiteId, req),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['content-templates'] }); setFormOpen(false); enqueueSnackbar(t('contentTemplates.messages.created'), { variant: 'success' }); },
    onError: (error) => { const { detail, title } = resolveError(error); enqueueSnackbar(detail || title, { variant: 'error' }); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateContentTemplateRequest }) => apiService.updateContentTemplate(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['content-templates'] }); setEditingTemplate(null); enqueueSnackbar(t('contentTemplates.messages.updated'), { variant: 'success' }); },
    onError: (error) => { const { detail, title } = resolveError(error); enqueueSnackbar(detail || title, { variant: 'error' }); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiService.deleteContentTemplate(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['content-templates'] }); setDeletingTemplate(null); enqueueSnackbar(t('contentTemplates.messages.deleted'), { variant: 'success' }); },
    onError: (error) => { const { detail, title } = resolveError(error); enqueueSnackbar(detail || title, { variant: 'error' }); },
  });

  return (
    <Box>
      <PageHeader
        title={t('contentTemplates.title')}
        subtitle={t('contentTemplates.subtitle')}
        action={selectedSiteId ? {
          label: t('contentTemplates.addTemplate'),
          icon: <AddIcon />,
          onClick: () => setFormOpen(true),
          hidden: !canWrite,
        } : undefined}
      />

      {!selectedSiteId ? (
        <EmptyState
          icon={<ViewQuiltIcon sx={{ fontSize: 64 }} />}
          title={t('common.noSiteSelected')}
          description={t('contentTemplates.empty.noSite')}
        />
      ) : (
        <Paper sx={{ p: 3 }}>
          {isLoading ? (
            <LoadingState label={t('contentTemplates.loading')} />
          ) : !templates || templates.length === 0 ? (
            <EmptyState
              icon={<ViewQuiltIcon sx={{ fontSize: 48 }} />}
              title={t('contentTemplates.empty.title')}
              description={t('contentTemplates.empty.description')}
              action={canWrite ? { label: t('contentTemplates.addTemplate'), onClick: () => setFormOpen(true) } : undefined}
            />
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>{t('contentTemplates.table.name')}</TableCell>
                    <TableCell>{t('contentTemplates.table.description')}</TableCell>
                    <TableCell>{t('contentTemplates.table.icon')}</TableCell>
                    <TableCell>{t('contentTemplates.table.active')}</TableCell>
                    <TableCell>{t('contentTemplates.table.created')}</TableCell>
                    <TableCell align="right">{t('contentTemplates.table.actions')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {templates.map((tpl) => (
                    <TableRow key={tpl.id}>
                      <TableCell>
                        <Typography variant="body2" fontWeight={500}>{tpl.name}</Typography>
                      </TableCell>
                      <TableCell sx={{ maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {tpl.description || '—'}
                      </TableCell>
                      <TableCell>
                        <Chip label={tpl.icon} size="small" variant="outlined" />
                      </TableCell>
                      <TableCell>
                        <Chip
                          label={tpl.is_active ? t('common.status.active') : t('common.status.inactive')}
                          size="small"
                          color={tpl.is_active ? 'success' : 'default'}
                        />
                      </TableCell>
                      <TableCell>{format(new Date(tpl.created_at), 'PP')}</TableCell>
                      <TableCell align="right">
                        {canWrite && (
                          <Tooltip title={t('common.actions.edit')}>
                            <IconButton size="small" onClick={() => setEditingTemplate(tpl)}>
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                        {isAdmin && (
                          <Tooltip title={t('common.actions.delete')}>
                            <IconButton size="small" color="error" onClick={() => setDeletingTemplate(tpl)}>
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
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
      <ContentTemplateFormDialog
        open={formOpen}
        onSubmitCreate={(data) => createMutation.mutate(data)}
        onClose={() => setFormOpen(false)}
        loading={createMutation.isPending}
      />

      {/* Edit dialog */}
      <ContentTemplateFormDialog
        open={!!editingTemplate}
        template={editingTemplate}
        onSubmitUpdate={(data) => editingTemplate && updateMutation.mutate({ id: editingTemplate.id, data })}
        onClose={() => setEditingTemplate(null)}
        loading={updateMutation.isPending}
      />

      {/* Delete confirmation */}
      <ConfirmDialog
        open={!!deletingTemplate}
        title={t('contentTemplates.deleteDialog.title')}
        message={t('contentTemplates.deleteDialog.message', { name: deletingTemplate?.name })}
        confirmLabel={t('common.actions.delete')}
        onConfirm={() => deletingTemplate && deleteMutation.mutate(deletingTemplate.id)}
        onCancel={() => setDeletingTemplate(null)}
        loading={deleteMutation.isPending}
      />
    </Box>
  );
}
