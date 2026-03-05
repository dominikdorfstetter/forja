import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Box, Paper, Chip, IconButton, Tooltip, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import EditIcon from '@mui/icons-material/Edit';
import ViewQuiltIcon from '@mui/icons-material/ViewQuilt';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import apiService from '@/services/api';
import type { ContentTemplate, CreateContentTemplateRequest, UpdateContentTemplateRequest } from '@/types/api';
import { useSiteContext } from '@/store/SiteContext';
import { useAuth } from '@/store/AuthContext';
import { useListPageState } from '@/hooks/useListPageState';
import { useCrudMutations } from '@/hooks/useCrudMutations';
import PageHeader from '@/components/shared/PageHeader';
import LoadingState from '@/components/shared/LoadingState';
import EmptyState from '@/components/shared/EmptyState';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import DataTable, { type DataTableColumn } from '@/components/shared/DataTable';
import ContentTemplateFormDialog from '@/components/content-templates/ContentTemplateFormDialog';

export default function ContentTemplatesPage() {
  const { t } = useTranslation();
  const { selectedSiteId } = useSiteContext();
  const { canWrite, isAdmin } = useAuth();

  const {
    page, perPage, formOpen, editing, deleting,
    openCreate, closeForm, openEdit, closeEdit, openDelete, closeDelete,
    handlePageChange, handleRowsPerPageChange,
  } = useListPageState<ContentTemplate>();

  // Command palette action listener
  useEffect(() => {
    const handler = (e: Event) => {
      if ((e as CustomEvent).detail === 'create-template') openCreate();
    };
    window.addEventListener('command-palette:action', handler);
    return () => window.removeEventListener('command-palette:action', handler);
  }, [openCreate]);

  const { data, isLoading } = useQuery({
    queryKey: ['content-templates', selectedSiteId, page, perPage],
    queryFn: () => apiService.getContentTemplates(selectedSiteId, { page, per_page: perPage }),
    enabled: !!selectedSiteId,
  });
  const templates = data?.data;

  const { createMutation, updateMutation, deleteMutation } = useCrudMutations<
    CreateContentTemplateRequest, UpdateContentTemplateRequest
  >({
    queryKey: 'content-templates',
    create: {
      mutationFn: (req) => apiService.createContentTemplate(selectedSiteId, req),
      successMessage: t('contentTemplates.messages.created'),
      onSuccess: () => closeForm(),
    },
    update: {
      mutationFn: ({ id, data }) => apiService.updateContentTemplate(id, data),
      successMessage: t('contentTemplates.messages.updated'),
      onSuccess: () => closeEdit(),
    },
    delete: {
      mutationFn: (id) => apiService.deleteContentTemplate(id),
      successMessage: t('contentTemplates.messages.deleted'),
      onSuccess: () => closeDelete(),
    },
  });

  const columns: DataTableColumn<ContentTemplate>[] = [
    { header: t('contentTemplates.table.name'), render: (tpl) => <Typography variant="body2" fontWeight={500}>{tpl.name}</Typography> },
    { header: t('contentTemplates.table.description'), render: (tpl) => <span style={{ maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-block' }}>{tpl.description || '—'}</span> },
    { header: t('contentTemplates.table.icon'), render: (tpl) => <Chip label={tpl.icon} size="small" variant="outlined" /> },
    { header: t('contentTemplates.table.active'), render: (tpl) => <Chip label={tpl.is_active ? t('common.status.active') : t('common.status.inactive')} size="small" color={tpl.is_active ? 'success' : 'default'} /> },
    { header: t('contentTemplates.table.created'), render: (tpl) => format(new Date(tpl.created_at), 'PP') },
    {
      header: t('contentTemplates.table.actions'),
      align: 'right',
      render: (tpl) => (
        <>
          {canWrite && <Tooltip title={t('common.actions.edit')}><IconButton size="small" onClick={() => openEdit(tpl)}><EditIcon fontSize="small" /></IconButton></Tooltip>}
          {isAdmin && <Tooltip title={t('common.actions.delete')}><IconButton size="small" color="error" onClick={() => openDelete(tpl)}><DeleteIcon fontSize="small" /></IconButton></Tooltip>}
        </>
      ),
    },
  ];

  return (
    <Box>
      <PageHeader
        title={t('contentTemplates.title')}
        subtitle={t('contentTemplates.subtitle')}
        action={selectedSiteId ? { label: t('contentTemplates.addTemplate'), icon: <AddIcon />, onClick: openCreate, hidden: !canWrite } : undefined}
      />

      {!selectedSiteId ? (
        <EmptyState icon={<ViewQuiltIcon sx={{ fontSize: 64 }} />} title={t('common.noSiteSelected')} description={t('contentTemplates.empty.noSite')} />
      ) : (
        <Paper sx={{ p: 3 }}>
          {isLoading ? (
            <LoadingState label={t('contentTemplates.loading')} />
          ) : !templates || templates.length === 0 ? (
            <EmptyState icon={<ViewQuiltIcon sx={{ fontSize: 48 }} />} title={t('contentTemplates.empty.title')} description={t('contentTemplates.empty.description')} action={canWrite ? { label: t('contentTemplates.addTemplate'), onClick: openCreate } : undefined} />
          ) : (
            <DataTable
              data={templates}
              columns={columns}
              getRowKey={(tpl) => tpl.id}
              meta={data?.meta}
              page={page}
              onPageChange={handlePageChange}
              rowsPerPage={perPage}
              onRowsPerPageChange={handleRowsPerPageChange}
            />
          )}
        </Paper>
      )}

      <ContentTemplateFormDialog open={formOpen} onSubmitCreate={(data) => createMutation.mutate(data)} onClose={closeForm} loading={createMutation.isPending} />
      <ContentTemplateFormDialog open={!!editing} template={editing} onSubmitUpdate={(data) => editing && updateMutation.mutate({ id: editing.id, data })} onClose={closeEdit} loading={updateMutation.isPending} />
      <ConfirmDialog open={!!deleting} title={t('contentTemplates.deleteDialog.title')} message={t('contentTemplates.deleteDialog.message', { name: deleting?.name })} confirmLabel={t('common.actions.delete')} onConfirm={() => deleting && deleteMutation.mutate(deleting.id)} onCancel={closeDelete} loading={deleteMutation.isPending} />
    </Box>
  );
}
