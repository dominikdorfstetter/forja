import { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import {
  Box,
  Paper,
  Typography,
  Grid,
  Button,
  Alert,
  Chip,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  IconButton,
  Tooltip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Stack,
  FormControlLabel,
  Switch,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import GavelIcon from '@mui/icons-material/Gavel';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { useTranslation } from 'react-i18next';
import { useForm, Controller } from 'react-hook-form';
import apiService from '@/services/api';
import { resolveError } from '@/utils/errorResolver';
import type {
  LegalDocType,
  LegalGroupResponse,
  CreateLegalGroupRequest,
  UpdateLegalGroupRequest,
  LegalItemResponse,
  CreateLegalItemRequest,
  UpdateLegalItemRequest,
  UpdateLegalDocumentRequest,
} from '@/types/api';
import { useAuth } from '@/store/AuthContext';
import PageHeader from '@/components/shared/PageHeader';
import LoadingState from '@/components/shared/LoadingState';
import EmptyState from '@/components/shared/EmptyState';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import LegalDocumentFormDialog from '@/components/legal/LegalDocumentFormDialog';

// --- Group form dialog (inline) ---

interface GroupFormData {
  cookie_name: string;
  display_order: number;
  is_required: boolean;
  default_enabled: boolean;
}

interface GroupFormDialogProps {
  open: boolean;
  group?: LegalGroupResponse | null;
  onSubmit: (data: CreateLegalGroupRequest) => void;
  onClose: () => void;
  loading?: boolean;
}

function GroupFormDialog({ open, group, onSubmit, onClose, loading }: GroupFormDialogProps) {
  const { t } = useTranslation();
  const { register, handleSubmit, reset, control, formState: { errors } } = useForm<GroupFormData>({
    defaultValues: { cookie_name: '', display_order: 0, is_required: false, default_enabled: false },
  });

  useEffect(() => {
    if (open) {
      reset(group ? {
        cookie_name: group.cookie_name,
        display_order: group.display_order,
        is_required: group.is_required,
        default_enabled: group.default_enabled,
      } : { cookie_name: '', display_order: 0, is_required: false, default_enabled: false });
    }
  }, [open, group, reset]);

  const onFormSubmit = (data: GroupFormData) => {
    onSubmit({
      cookie_name: data.cookie_name,
      display_order: data.display_order,
      is_required: data.is_required,
      default_enabled: data.default_enabled,
    });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <form onSubmit={handleSubmit(onFormSubmit)}>
        <DialogTitle>{group ? t('legalDetail.dialog.editGroup') : t('legalDetail.dialog.addGroup')}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label={t('legalDetail.dialog.cookieName')} fullWidth {...register('cookie_name', { required: t('legalDetail.dialog.cookieNameRequired') })} error={!!errors.cookie_name} helperText={errors.cookie_name?.message} />
            <TextField label={t('legalDetail.dialog.displayOrder')} type="number" fullWidth {...register('display_order', { valueAsNumber: true })} />
            <Controller name="is_required" control={control} render={({ field }) => (
              <FormControlLabel control={<Switch checked={field.value} onChange={field.onChange} />} label={t('legalDetail.dialog.required')} />
            )} />
            <Controller name="default_enabled" control={control} render={({ field }) => (
              <FormControlLabel control={<Switch checked={field.value} onChange={field.onChange} />} label={t('legalDetail.dialog.defaultEnabled')} />
            )} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={loading}>{t('common.actions.cancel')}</Button>
          <Button type="submit" variant="contained" disabled={loading}>{loading ? t('common.actions.saving') : (group ? t('common.actions.save') : t('common.actions.create'))}</Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

// --- Item form dialog (inline) ---

interface ItemFormData {
  cookie_name: string;
  display_order: number;
  is_required: boolean;
}

interface ItemFormDialogProps {
  open: boolean;
  item?: LegalItemResponse | null;
  onSubmit: (data: CreateLegalItemRequest) => void;
  onClose: () => void;
  loading?: boolean;
}

function ItemFormDialog({ open, item, onSubmit, onClose, loading }: ItemFormDialogProps) {
  const { t } = useTranslation();
  const { register, handleSubmit, reset, control, formState: { errors } } = useForm<ItemFormData>({
    defaultValues: { cookie_name: '', display_order: 0, is_required: false },
  });

  useEffect(() => {
    if (open) {
      reset(item ? {
        cookie_name: item.cookie_name,
        display_order: item.display_order,
        is_required: item.is_required,
      } : { cookie_name: '', display_order: 0, is_required: false });
    }
  }, [open, item, reset]);

  const onFormSubmit = (data: ItemFormData) => {
    onSubmit({
      cookie_name: data.cookie_name,
      display_order: data.display_order,
      is_required: data.is_required,
    });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <form onSubmit={handleSubmit(onFormSubmit)}>
        <DialogTitle>{item ? t('legalDetail.dialog.editItem') : t('legalDetail.dialog.addItem')}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField label={t('legalDetail.dialog.cookieName')} fullWidth {...register('cookie_name', { required: t('legalDetail.dialog.cookieNameRequired') })} error={!!errors.cookie_name} helperText={errors.cookie_name?.message} />
            <TextField label={t('legalDetail.dialog.displayOrder')} type="number" fullWidth {...register('display_order', { valueAsNumber: true })} />
            <Controller name="is_required" control={control} render={({ field }) => (
              <FormControlLabel control={<Switch checked={field.value} onChange={field.onChange} />} label={t('legalDetail.dialog.required')} />
            )} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={loading}>{t('common.actions.cancel')}</Button>
          <Button type="submit" variant="contained" disabled={loading}>{loading ? t('common.actions.saving') : (item ? t('common.actions.save') : t('common.actions.create'))}</Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

// --- Items section for a group ---

interface GroupItemsSectionProps {
  groupId: string;
}

function GroupItemsSection({ groupId }: GroupItemsSectionProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const { canWrite, isAdmin } = useAuth();
  const [itemFormOpen, setItemFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<LegalItemResponse | null>(null);
  const [deletingItem, setDeletingItem] = useState<LegalItemResponse | null>(null);

  const { data: items, isLoading } = useQuery({
    queryKey: ['legalItems', groupId],
    queryFn: () => apiService.getLegalItems(groupId),
    enabled: !!groupId,
  });

  const createItemMutation = useMutation({
    mutationFn: (data: CreateLegalItemRequest) => apiService.createLegalItem(groupId, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['legalItems', groupId] }); setItemFormOpen(false); enqueueSnackbar(t('legalDetail.items.messages.created'), { variant: 'success' }); },
    onError: (error) => { const { detail, title } = resolveError(error); enqueueSnackbar(detail || title, { variant: 'error' }); },
  });

  const updateItemMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateLegalItemRequest }) => apiService.updateLegalItem(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['legalItems', groupId] }); setEditingItem(null); enqueueSnackbar(t('legalDetail.items.messages.updated'), { variant: 'success' }); },
    onError: (error) => { const { detail, title } = resolveError(error); enqueueSnackbar(detail || title, { variant: 'error' }); },
  });

  const deleteItemMutation = useMutation({
    mutationFn: (id: string) => apiService.deleteLegalItem(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['legalItems', groupId] }); setDeletingItem(null); enqueueSnackbar(t('legalDetail.items.messages.deleted'), { variant: 'success' }); },
    onError: (error) => { const { detail, title } = resolveError(error); enqueueSnackbar(detail || title, { variant: 'error' }); },
  });

  return (
    <Box sx={{ mt: 1 }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <Typography variant="subtitle2" color="text.secondary">{t('legalDetail.items.title')}</Typography>
        {canWrite && <Button size="small" startIcon={<AddIcon />} onClick={() => setItemFormOpen(true)}>{t('legalDetail.items.add')}</Button>}
      </Box>

      {isLoading ? (
        <LoadingState label={t('legalDetail.items.loadingItems')} />
      ) : !items || items.length === 0 ? (
        <Typography variant="body2" color="text.disabled" sx={{ py: 1 }}>{t('legalDetail.items.empty')}</Typography>
      ) : (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>{t('legalDetail.dialog.cookieName')}</TableCell>
              <TableCell>{t('legalDetail.dialog.displayOrder')}</TableCell>
              <TableCell>{t('legalDetail.dialog.required')}</TableCell>
              <TableCell align="right">{t('common.table.actions')}</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {items.map((item) => (
              <TableRow key={item.id}>
                <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{item.cookie_name}</TableCell>
                <TableCell>{item.display_order}</TableCell>
                <TableCell><Chip label={item.is_required ? t('common.labels.yes') : t('common.labels.no')} size="small" color={item.is_required ? 'warning' : 'default'} variant="outlined" /></TableCell>
                <TableCell align="right">
                  {canWrite && <Tooltip title={t('common.actions.edit')}><IconButton size="small" onClick={() => setEditingItem(item)}><EditIcon fontSize="small" /></IconButton></Tooltip>}
                  {isAdmin && <Tooltip title={t('common.actions.delete')}><IconButton size="small" color="error" onClick={() => setDeletingItem(item)}><DeleteIcon fontSize="small" /></IconButton></Tooltip>}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}

      <ItemFormDialog open={itemFormOpen} onSubmit={(data) => createItemMutation.mutate(data)} onClose={() => setItemFormOpen(false)} loading={createItemMutation.isPending} />
      <ItemFormDialog open={!!editingItem} item={editingItem} onSubmit={(data) => editingItem && updateItemMutation.mutate({ id: editingItem.id, data })} onClose={() => setEditingItem(null)} loading={updateItemMutation.isPending} />
      <ConfirmDialog open={!!deletingItem} title={t('legalDetail.items.deleteItem')} message={t('legalDetail.items.deleteMessage', { name: deletingItem?.cookie_name })} confirmLabel={t('common.actions.delete')} onConfirm={() => deletingItem && deleteItemMutation.mutate(deletingItem.id)} onCancel={() => setDeletingItem(null)} loading={deleteItemMutation.isPending} />
    </Box>
  );
}

// --- Main detail page ---

export default function LegalDocumentDetailPage() {
  const { t } = useTranslation();
  const { id } = useParams<{ id: string }>();
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();

  const { canWrite, isAdmin } = useAuth();
  const [editDocOpen, setEditDocOpen] = useState(false);
  const [groupFormOpen, setGroupFormOpen] = useState(false);
  const [editingGroup, setEditingGroup] = useState<LegalGroupResponse | null>(null);
  const [deletingGroup, setDeletingGroup] = useState<LegalGroupResponse | null>(null);

  // Fetch groups for this document
  const { data: groups, isLoading: groupsLoading, error: groupsError } = useQuery({
    queryKey: ['legalGroups', id],
    queryFn: () => apiService.getLegalGroups(id!),
    enabled: !!id,
  });

  // We need to fetch the document info. Since there is no getDocument(id) endpoint,
  // we derive the info from the groups query or store it from navigation state.
  // For simplicity, we use the legal documents list from all sites.
  const { data: sites } = useQuery({ queryKey: ['sites'], queryFn: () => apiService.getSites() });

  // Try to find the document across all sites
  const [document, setDocument] = useState<{ cookie_name: string; document_type: LegalDocType } | null>(null);

  useEffect(() => {
    if (!sites || !id) return;
    let cancelled = false;

    async function findDocument() {
      for (const site of sites!) {
        try {
          const result = await apiService.getLegalDocuments(site.id);
          const found = result.data.find((d) => d.id === id);
          if (found && !cancelled) {
            setDocument({ cookie_name: found.cookie_name, document_type: found.document_type });
            return;
          }
        } catch {
          // continue searching other sites
        }
      }
    }

    findDocument();
    return () => { cancelled = true; };
  }, [sites, id]);

  const updateDocMutation = useMutation({
    mutationFn: (data: UpdateLegalDocumentRequest) => apiService.updateLegalDocument(id!, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['legal'] });
      setEditDocOpen(false);
      enqueueSnackbar(t('legalDetail.updatedMessage'), { variant: 'success' });
      // Refresh document info
      if (sites) {
        for (const site of sites) {
          apiService.getLegalDocuments(site.id).then((result) => {
            const found = result.data.find((d) => d.id === id);
            if (found) setDocument({ cookie_name: found.cookie_name, document_type: found.document_type });
          }).catch(() => {});
        }
      }
    },
    onError: (error) => { const { detail, title } = resolveError(error); enqueueSnackbar(detail || title, { variant: 'error' }); },
  });

  const createGroupMutation = useMutation({
    mutationFn: (data: CreateLegalGroupRequest) => apiService.createLegalGroup(id!, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['legalGroups', id] }); setGroupFormOpen(false); enqueueSnackbar(t('legalDetail.groups.messages.created'), { variant: 'success' }); },
    onError: (error) => { const { detail, title } = resolveError(error); enqueueSnackbar(detail || title, { variant: 'error' }); },
  });

  const updateGroupMutation = useMutation({
    mutationFn: ({ groupId, data }: { groupId: string; data: UpdateLegalGroupRequest }) => apiService.updateLegalGroup(groupId, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['legalGroups', id] }); setEditingGroup(null); enqueueSnackbar(t('legalDetail.groups.messages.updated'), { variant: 'success' }); },
    onError: (error) => { const { detail, title } = resolveError(error); enqueueSnackbar(detail || title, { variant: 'error' }); },
  });

  const deleteGroupMutation = useMutation({
    mutationFn: (groupId: string) => apiService.deleteLegalGroup(groupId),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['legalGroups', id] }); setDeletingGroup(null); enqueueSnackbar(t('legalDetail.groups.messages.deleted'), { variant: 'success' }); },
    onError: (error) => { const { detail, title } = resolveError(error); enqueueSnackbar(detail || title, { variant: 'error' }); },
  });

  return (
    <Box>
      <PageHeader
        title={document?.cookie_name || t('legalDetail.title')}
        subtitle={document?.document_type || t('common.actions.loading')}
        breadcrumbs={[
          { label: t('layout.sidebar.legal'), path: '/legal' },
          { label: document?.cookie_name || t('legalDetail.title') },
        ]}
        action={{ label: t('legalDetail.editDocument'), icon: <EditIcon />, onClick: () => setEditDocOpen(true), hidden: !canWrite }}
      />

      {/* Document info */}
      <Paper sx={{ p: 3, mb: 3 }}>
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <Typography variant="caption" color="text.secondary">{t('legalDetail.cookieName')}</Typography>
            <Typography variant="body1" fontFamily="monospace">{document?.cookie_name || '...'}</Typography>
          </Grid>
          <Grid item xs={12} sm={6}>
            <Typography variant="caption" color="text.secondary">{t('legalDetail.documentType')}</Typography>
            <Typography variant="body1">{document?.document_type || '...'}</Typography>
          </Grid>
          <Grid item xs={12} sm={6}>
            <Typography variant="caption" color="text.secondary">{t('legalDetail.documentId')}</Typography>
            <Typography variant="body2" fontFamily="monospace" sx={{ wordBreak: 'break-all' }}>{id}</Typography>
          </Grid>
        </Grid>
      </Paper>

      {/* Groups section */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6">{t('legalDetail.groups.title')}</Typography>
        {canWrite && <Button variant="outlined" startIcon={<AddIcon />} onClick={() => setGroupFormOpen(true)}>{t('legalDetail.groups.add')}</Button>}
      </Box>

      {groupsLoading ? (
        <LoadingState label={t('legalDetail.groups.loadingGroups')} />
      ) : groupsError ? (
        <Alert severity="error">{t('legalDetail.loadGroupsFailed')}</Alert>
      ) : !groups || groups.length === 0 ? (
        <EmptyState icon={<GavelIcon sx={{ fontSize: 48 }} />} title={t('legalDetail.groups.empty')} description={t('legalDetail.groups.emptyDescription')} action={{ label: t('legalDetail.groups.add'), onClick: () => setGroupFormOpen(true) }} />
      ) : (
        groups.map((group) => (
          <Accordion key={group.id} defaultExpanded>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, width: '100%', mr: 2 }}>
                <Typography variant="subtitle1" fontFamily="monospace" sx={{ flexGrow: 1 }}>{group.cookie_name}</Typography>
                <Chip label={t('legalDetail.groups.order', { order: group.display_order })} size="small" variant="outlined" />
                <Chip label={group.is_required ? t('legalDetail.groups.required') : t('legalDetail.groups.optional')} size="small" color={group.is_required ? 'warning' : 'default'} variant="outlined" />
                <Chip label={group.default_enabled ? t('legalDetail.groups.enabled') : t('legalDetail.groups.disabled')} size="small" color={group.default_enabled ? 'success' : 'default'} variant="outlined" />
                {canWrite && <Tooltip title={t('legalDetail.groups.editGroup')}>
                  <IconButton size="small" onClick={(e) => { e.stopPropagation(); setEditingGroup(group); }}>
                    <EditIcon fontSize="small" />
                  </IconButton>
                </Tooltip>}
                {isAdmin && <Tooltip title={t('legalDetail.groups.deleteGroup')}>
                  <IconButton size="small" color="error" onClick={(e) => { e.stopPropagation(); setDeletingGroup(group); }}>
                    <DeleteIcon fontSize="small" />
                  </IconButton>
                </Tooltip>}
              </Box>
            </AccordionSummary>
            <AccordionDetails>
              <GroupItemsSection groupId={group.id} />
            </AccordionDetails>
          </Accordion>
        ))
      )}

      {/* Document edit dialog */}
      <LegalDocumentFormDialog
        open={editDocOpen}
        siteId=""
        document={document ? { id: id!, cookie_name: document.cookie_name, document_type: document.document_type as any, created_at: '', updated_at: '' } : null}
        onSubmit={(data) => updateDocMutation.mutate({ cookie_name: data.cookie_name, document_type: data.document_type })}
        onClose={() => setEditDocOpen(false)}
        loading={updateDocMutation.isPending}
      />

      {/* Group form dialogs */}
      <GroupFormDialog open={groupFormOpen} onSubmit={(data) => createGroupMutation.mutate(data)} onClose={() => setGroupFormOpen(false)} loading={createGroupMutation.isPending} />
      <GroupFormDialog open={!!editingGroup} group={editingGroup} onSubmit={(data) => editingGroup && updateGroupMutation.mutate({ groupId: editingGroup.id, data })} onClose={() => setEditingGroup(null)} loading={updateGroupMutation.isPending} />
      <ConfirmDialog open={!!deletingGroup} title={t('legalDetail.groups.deleteGroup')} message={t('legalDetail.groups.deleteMessage', { name: deletingGroup?.cookie_name })} confirmLabel={t('common.actions.delete')} onConfirm={() => deletingGroup && deleteGroupMutation.mutate(deletingGroup.id)} onCancel={() => setDeletingGroup(null)} loading={deleteGroupMutation.isPending} />
    </Box>
  );
}
