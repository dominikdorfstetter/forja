import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import {
  Box,
  Alert,
  Button,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  Tooltip,
  TablePagination,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import VisibilityIcon from '@mui/icons-material/Visibility';
import GavelIcon from '@mui/icons-material/Gavel';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { format } from 'date-fns';
import apiService from '@/services/api';
import { resolveError } from '@/utils/errorResolver';
import type { LegalDocumentResponse, CreateLegalDocumentRequest, UpdateLegalDocumentRequest } from '@/types/api';
import { useSiteContext } from '@/store/SiteContext';
import { useAuth } from '@/store/AuthContext';
import PageHeader from '@/components/shared/PageHeader';
import LoadingState from '@/components/shared/LoadingState';
import EmptyState from '@/components/shared/EmptyState';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import LegalDocumentFormDialog from '@/components/legal/LegalDocumentFormDialog';

export default function LegalPage({ embedded }: { embedded?: boolean }) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const { selectedSiteId } = useSiteContext();
  const { canWrite, isAdmin } = useAuth();
  const [page, setPage] = useState(1);
  const [perPage, setPerPage] = useState(25);
  const [formOpen, setFormOpen] = useState(false);
  const [editingDoc, setEditingDoc] = useState<LegalDocumentResponse | null>(null);
  const [deletingDoc, setDeletingDoc] = useState<LegalDocumentResponse | null>(null);

  const { data: documentsData, isLoading, error } = useQuery({
    queryKey: ['legal', selectedSiteId, page, perPage],
    queryFn: () => apiService.getLegalDocuments(selectedSiteId, { page, per_page: perPage }),
    enabled: !!selectedSiteId,
  });
  const documents = documentsData?.data;

  const createMutation = useMutation({
    mutationFn: (data: CreateLegalDocumentRequest) => apiService.createLegalDocument(selectedSiteId, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['legal'] }); setFormOpen(false); enqueueSnackbar(t('legal.messages.created'), { variant: 'success' }); },
    onError: (error) => { const { detail, title } = resolveError(error); enqueueSnackbar(detail || title, { variant: 'error' }); },
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateLegalDocumentRequest }) => apiService.updateLegalDocument(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['legal'] }); setEditingDoc(null); enqueueSnackbar(t('legal.messages.updated'), { variant: 'success' }); },
    onError: (error) => { const { detail, title } = resolveError(error); enqueueSnackbar(detail || title, { variant: 'error' }); },
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiService.deleteLegalDocument(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['legal'] }); setDeletingDoc(null); enqueueSnackbar(t('legal.messages.deleted'), { variant: 'success' }); },
    onError: (error) => { const { detail, title } = resolveError(error); enqueueSnackbar(detail || title, { variant: 'error' }); },
  });

  return (
    <Box>
      {!embedded && (
        <PageHeader
          title={t('legal.title')}
          subtitle={t('legal.subtitle')}
          action={selectedSiteId ? { label: t('legal.addDocument'), icon: <AddIcon />, onClick: () => setFormOpen(true), hidden: !canWrite } : undefined}
        />
      )}
      {embedded && selectedSiteId && canWrite && (
        <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
          <Button variant="outlined" startIcon={<AddIcon />} onClick={() => setFormOpen(true)}>
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
        <EmptyState icon={<GavelIcon sx={{ fontSize: 64 }} />} title={t('legal.empty.title')} description={t('legal.empty.description')} action={{ label: t('legal.addDocument'), onClick: () => setFormOpen(true) }} />
      ) : (
        <TableContainer component={Paper}>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell scope="col">{t('legal.table.cookieName')}</TableCell>
                <TableCell scope="col">{t('legal.table.type')}</TableCell>
                <TableCell scope="col">{t('legal.table.created')}</TableCell>
                <TableCell scope="col" align="right">{t('legal.table.actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {documents.map((doc) => (
                <TableRow key={doc.id}>
                  <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{doc.cookie_name}</TableCell>
                  <TableCell>{doc.document_type}</TableCell>
                  <TableCell>{format(new Date(doc.created_at), 'PP')}</TableCell>
                  <TableCell align="right">
                    <Tooltip title={t('common.actions.view')}><IconButton size="small" aria-label={t('common.actions.view')} onClick={() => navigate(`/legal/${doc.id}`)}><VisibilityIcon fontSize="small" /></IconButton></Tooltip>
                    {canWrite && <Tooltip title={t('common.actions.edit')}><IconButton size="small" aria-label={t('common.actions.edit')} onClick={() => setEditingDoc(doc)}><EditIcon fontSize="small" /></IconButton></Tooltip>}
                    {isAdmin && <Tooltip title={t('common.actions.delete')}><IconButton size="small" aria-label={t('common.actions.delete')} color="error" onClick={() => setDeletingDoc(doc)}><DeleteIcon fontSize="small" /></IconButton></Tooltip>}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}
      {documentsData?.meta && (
        <TablePagination
          component="div"
          count={documentsData.meta.total_items}
          page={documentsData.meta.page - 1}
          onPageChange={(_, p) => setPage(p + 1)}
          rowsPerPage={documentsData.meta.page_size}
          onRowsPerPageChange={(e) => { setPerPage(+e.target.value); setPage(1); }}
          rowsPerPageOptions={[10, 25, 50]}
        />
      )}

      <LegalDocumentFormDialog open={formOpen} siteId={selectedSiteId} onSubmit={(data) => createMutation.mutate(data)} onClose={() => setFormOpen(false)} loading={createMutation.isPending} />
      <LegalDocumentFormDialog open={!!editingDoc} siteId={selectedSiteId} document={editingDoc} onSubmit={(data) => editingDoc && updateMutation.mutate({ id: editingDoc.id, data })} onClose={() => setEditingDoc(null)} loading={updateMutation.isPending} />
      <ConfirmDialog open={!!deletingDoc} title={t('legal.deleteDialog.title')} message={t('legal.deleteDialog.message', { cookieName: deletingDoc?.cookie_name })} confirmLabel={t('common.actions.delete')} onConfirm={() => deletingDoc && deleteMutation.mutate(deletingDoc.id)} onCancel={() => setDeletingDoc(null)} loading={deleteMutation.isPending} />
    </Box>
  );
}
