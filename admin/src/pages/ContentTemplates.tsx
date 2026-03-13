import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Box, Paper, Chip, IconButton, Tooltip, Typography, TableSortLabel } from '@mui/material';
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
import TableFilterBar from '@/components/shared/TableFilterBar';
import ContentTemplateFormDialog from '@/components/content-templates/ContentTemplateFormDialog';
import CreateTemplateWizard from '@/components/content-templates/CreateTemplateWizard';

export default function ContentTemplatesPage() {
  const { t } = useTranslation();
  const { selectedSiteId } = useSiteContext();
  const { canWrite, isAdmin } = useAuth();

  const {
    page, pageSize, formOpen, editing, deleting,
    search, setSearch, debouncedSearch,
    sortBy, sortDir, handleSort,
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
    queryKey: ['content-templates', selectedSiteId, page, pageSize, debouncedSearch, sortBy, sortDir],
    queryFn: () => apiService.getContentTemplates(selectedSiteId, { page, page_size: pageSize, search: debouncedSearch || undefined, sort_by: sortBy || undefined, sort_dir: sortBy ? sortDir : undefined }),
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
    { header: (
        <TableSortLabel
          active={sortBy === 'name'}
          direction={sortBy === 'name' ? sortDir : 'asc'}
          onClick={() => handleSort('name')}
        >
          {t('contentTemplates.table.name')}
        </TableSortLabel>
      ), render: (tpl) => <Typography variant="body2" fontWeight={500}>{tpl.name}</Typography> },
    { header: t('contentTemplates.table.description'), render: (tpl) => <span style={{ maxWidth: 250, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', display: 'inline-block' }}>{tpl.description || '—'}</span> },
    { header: t('contentTemplates.table.icon'), render: (tpl) => <Chip label={tpl.icon} size="small" variant="outlined" /> },
    { header: (
        <TableSortLabel
          active={sortBy === 'is_active'}
          direction={sortBy === 'is_active' ? sortDir : 'asc'}
          onClick={() => handleSort('is_active')}
        >
          {t('contentTemplates.table.active')}
        </TableSortLabel>
      ), render: (tpl) => <Chip label={tpl.is_active ? t('common.status.active') : t('common.status.inactive')} size="small" color={tpl.is_active ? 'success' : 'default'} /> },
    { header: (
        <TableSortLabel
          active={sortBy === 'created_at'}
          direction={sortBy === 'created_at' ? sortDir : 'asc'}
          onClick={() => handleSort('created_at')}
        >
          {t('contentTemplates.table.created')}
        </TableSortLabel>
      ), render: (tpl) => format(new Date(tpl.created_at), 'PP') },
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
    <Box data-testid="content-templates.page">
      <PageHeader
        title={t('contentTemplates.title')}
        subtitle={t('contentTemplates.subtitle')}
        breadcrumbs={[
          { label: t('blogs.title'), path: '/blogs' },
          { label: t('contentTemplates.title') },
        ]}
        action={selectedSiteId ? { label: t('contentTemplates.addTemplate'), icon: <AddIcon />, onClick: openCreate, hidden: !canWrite } : undefined}
      />

      {!selectedSiteId ? (
        <EmptyState icon={<ViewQuiltIcon sx={{ fontSize: 64 }} />} title={t('common.noSiteSelected')} description={t('contentTemplates.empty.noSite')} />
      ) : (
        <Paper>
          <TableFilterBar searchValue={search} onSearchChange={setSearch} searchPlaceholder={t('contentTemplates.searchPlaceholder')} />
          {isLoading ? (
            <Box sx={{ p: 3 }}><LoadingState label={t('contentTemplates.loading')} /></Box>
          ) : !templates || templates.length === 0 ? (
            <Box sx={{ p: 3 }}><EmptyState icon={<ViewQuiltIcon sx={{ fontSize: 48 }} />} title={t('contentTemplates.empty.title')} description={t('contentTemplates.empty.description')} action={canWrite ? { label: t('contentTemplates.addTemplate'), onClick: openCreate } : undefined} /></Box>
          ) : (
            <DataTable
              data={templates}
              columns={columns}
              getRowKey={(tpl) => tpl.id}
              meta={data?.meta}
              page={page}
              onPageChange={handlePageChange}
              rowsPerPage={pageSize}
              onRowsPerPageChange={handleRowsPerPageChange}
            />
          )}
        </Paper>
      )}

      <CreateTemplateWizard open={formOpen} onClose={closeForm} onSubmit={(data) => createMutation.mutate(data)} loading={createMutation.isPending} />
      <ContentTemplateFormDialog open={!!editing} template={editing} onSubmitUpdate={(data) => editing && updateMutation.mutate({ id: editing.id, data })} onClose={closeEdit} loading={updateMutation.isPending} />
      <ConfirmDialog open={!!deleting} title={t('contentTemplates.deleteDialog.title')} message={t('contentTemplates.deleteDialog.message', { name: deleting?.name })} confirmLabel={t('common.actions.delete')} onConfirm={() => deleting && deleteMutation.mutate(deleting.id)} onCancel={closeDelete} loading={deleteMutation.isPending} confirmationText={t('common.actions.delete')} />
    </Box>
  );
}
