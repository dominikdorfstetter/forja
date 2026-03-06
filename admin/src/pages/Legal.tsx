import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import { Box, Alert, Button, IconButton, Tooltip } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import VisibilityIcon from '@mui/icons-material/Visibility';
import GavelIcon from '@mui/icons-material/Gavel';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import apiService from '@/services/api';
import type { LegalDocumentResponse, CreateLegalDocumentRequest, UpdateLegalDocumentRequest } from '@/types/api';
import { useSiteContext } from '@/store/SiteContext';
import { useAuth } from '@/store/AuthContext';
import { useListPageState } from '@/hooks/useListPageState';
import { useCrudMutations } from '@/hooks/useCrudMutations';
import PageHeader from '@/components/shared/PageHeader';
import LoadingState from '@/components/shared/LoadingState';
import EmptyState from '@/components/shared/EmptyState';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import DataTable, { type DataTableColumn } from '@/components/shared/DataTable';
import LegalDocumentFormDialog from '@/components/legal/LegalDocumentFormDialog';

export default function LegalPage({ embedded }: { embedded?: boolean }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { selectedSiteId } = useSiteContext();
  const { canWrite, isAdmin } = useAuth();

  const {
    page, perPage, formOpen, editing, deleting,
    openCreate, closeForm, openEdit, closeEdit, openDelete, closeDelete,
    handlePageChange, handleRowsPerPageChange,
  } = useListPageState<LegalDocumentResponse>();

  // Command palette action listener
  useEffect(() => {
    const handler = (e: Event) => {
      if ((e as CustomEvent).detail === 'add-legal-doc') openCreate();
    };
    window.addEventListener('command-palette:action', handler);
    return () => window.removeEventListener('command-palette:action', handler);
  }, [openCreate]);

  const { data: documentsData, isLoading, error } = useQuery({
    queryKey: ['legal', selectedSiteId, page, perPage],
    queryFn: () => apiService.getLegalDocuments(selectedSiteId, { page, per_page: perPage }),
    enabled: !!selectedSiteId,
  });
  const documents = documentsData?.data;

  const { createMutation, updateMutation, deleteMutation } = useCrudMutations<
    CreateLegalDocumentRequest, UpdateLegalDocumentRequest
  >({
    queryKey: 'legal',
    create: {
      mutationFn: (data) => apiService.createLegalDocument(selectedSiteId, data),
      successMessage: t('legal.messages.created'),
      onSuccess: () => closeForm(),
    },
    update: {
      mutationFn: ({ id, data }) => apiService.updateLegalDocument(id, data),
      successMessage: t('legal.messages.updated'),
      onSuccess: () => closeEdit(),
    },
    delete: {
      mutationFn: (id) => apiService.deleteLegalDocument(id),
      successMessage: t('legal.messages.deleted'),
      onSuccess: () => closeDelete(),
    },
  });

  const columns: DataTableColumn<LegalDocumentResponse>[] = [
    { header: t('legal.table.cookieName'), scope: 'col', render: (doc) => <span style={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{doc.cookie_name}</span> },
    { header: t('legal.table.type'), scope: 'col', render: (doc) => doc.document_type },
    { header: t('legal.table.created'), scope: 'col', render: (doc) => format(new Date(doc.created_at), 'PP') },
    {
      header: t('legal.table.actions'),
      scope: 'col',
      align: 'right',
      render: (doc) => (
        <>
          <Tooltip title={t('common.actions.view')}><IconButton size="small" aria-label={t('common.actions.view')} onClick={() => navigate(`/legal/${doc.id}`)}><VisibilityIcon fontSize="small" /></IconButton></Tooltip>
          {canWrite && <Tooltip title={t('common.actions.edit')}><IconButton size="small" aria-label={t('common.actions.edit')} onClick={() => openEdit(doc)}><EditIcon fontSize="small" /></IconButton></Tooltip>}
          {isAdmin && <Tooltip title={t('common.actions.delete')}><IconButton size="small" aria-label={t('common.actions.delete')} color="error" onClick={() => openDelete(doc)}><DeleteIcon fontSize="small" /></IconButton></Tooltip>}
        </>
      ),
    },
  ];

  return (
    <Box data-testid="legal.page">
      {!embedded && (
        <PageHeader
          title={t('legal.title')}
          subtitle={t('legal.subtitle')}
          action={selectedSiteId ? { label: t('legal.addDocument'), icon: <AddIcon />, onClick: openCreate, hidden: !canWrite } : undefined}
        />
      )}
      {embedded && selectedSiteId && canWrite && (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
          <Button variant="outlined" startIcon={<AddIcon />} onClick={openCreate}>
            {t('legal.addDocument')}
          </Button>
        </Box>
      )}

      {!selectedSiteId ? (
        <EmptyState icon={<GavelIcon sx={{ fontSize: 64 }} />} title={t('common.noSiteSelected')} description={t('legal.empty.noSite')} />
      ) : isLoading ? (
        <LoadingState label={t('legal.loading')} />
      ) : error ? (
        <Alert severity="error">{t('legal.loadError')}</Alert>
      ) : !documents || documents.length === 0 ? (
        <EmptyState icon={<GavelIcon sx={{ fontSize: 64 }} />} title={t('legal.empty.title')} description={t('legal.empty.description')} action={{ label: t('legal.addDocument'), onClick: openCreate }} />
      ) : (
        <DataTable
          data={documents}
          columns={columns}
          getRowKey={(doc) => doc.id}
          meta={documentsData?.meta}
          page={page}
          onPageChange={handlePageChange}
          rowsPerPage={perPage}
          onRowsPerPageChange={handleRowsPerPageChange}
        />
      )}

      <LegalDocumentFormDialog open={formOpen} siteId={selectedSiteId} onSubmit={(data) => createMutation.mutate(data)} onClose={closeForm} loading={createMutation.isPending} />
      <LegalDocumentFormDialog open={!!editing} siteId={selectedSiteId} document={editing} onSubmit={(data) => editing && updateMutation.mutate({ id: editing.id, data })} onClose={closeEdit} loading={updateMutation.isPending} />
      <ConfirmDialog open={!!deleting} title={t('legal.deleteDialog.title')} message={t('legal.deleteDialog.message', { cookieName: deleting?.cookie_name })} confirmLabel={t('common.actions.delete')} onConfirm={() => deleting && deleteMutation.mutate(deleting.id)} onCancel={closeDelete} loading={deleteMutation.isPending} confirmationText={t('common.actions.delete')} />
    </Box>
  );
}
