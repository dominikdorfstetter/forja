import { useCallback, useEffect, useReducer, useState, type CSSProperties } from 'react';
import { useNavigate } from 'react-router';
import {
  Box,
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
  TextField,
  Stack,
  FormControlLabel,
  Switch,
} from '@mui/material';
import FormDialog from '@/components/shared/FormDialog';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import CookieIcon from '@mui/icons-material/Cookie';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useForm, Controller } from 'react-hook-form';
import { createLegalDocument, createLegalGroup, createLegalItem, deleteLegalGroup, deleteLegalItem, getLegalDocuments, getLegalGroups, getLegalItems, updateLegalDocument, updateLegalGroup, updateLegalItem } from '@/services/legal';
import { useErrorSnackbar } from '@/hooks/useErrorSnackbar';
import { useReorderableList } from '@/hooks/useReorderableList';
import type {
  LegalGroupResponse,
  CreateLegalGroupRequest,
  UpdateLegalGroupRequest,
  LegalItemResponse,
  CreateLegalItemRequest,
  UpdateLegalItemRequest,
} from '@/types/api';
import { useAuth } from '@/store/AuthContext';
import { useSiteContext } from '@/store/SiteContext';
import PageHeader from '@/components/shared/PageHeader';
import LoadingState from '@/components/shared/LoadingState';
import EmptyState from '@/components/shared/EmptyState';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import StatusChip from '@/components/shared/StatusChip';
import { Icon, M3Button, M3IconButton } from '@/components/design-system';

// --- Group form dialog ---

interface GroupFormData {
  cookie_name: string;
  is_required: boolean;
  default_enabled: boolean;
}

interface GroupFormDialogProps {
  open: boolean;
  group?: LegalGroupResponse | null;
  nextOrder: number;
  onSubmit: (data: CreateLegalGroupRequest) => void;
  onClose: () => void;
  loading?: boolean;
}

function GroupFormDialog({ open, group, nextOrder, onSubmit, onClose, loading }: GroupFormDialogProps) {
  const { t } = useTranslation();
  const { register, handleSubmit, reset, control, formState: { errors } } = useForm<GroupFormData>({
    defaultValues: { cookie_name: '', is_required: false, default_enabled: false },
  });

  useEffect(() => {
    if (!open) return;
    reset(group ? {
      cookie_name: group.cookie_name,
      is_required: group.is_required,
      default_enabled: group.default_enabled,
    } : { cookie_name: '', is_required: false, default_enabled: false });
  }, [open, group, reset]);

  const onFormSubmit = (data: GroupFormData) => {
    onSubmit({
      cookie_name: data.cookie_name,
      display_order: group?.display_order ?? nextOrder,
      is_required: data.is_required,
      default_enabled: data.default_enabled,
    });
  };

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      onSubmit={handleSubmit(onFormSubmit)}
      icon="cookie"
      title={group ? t('legalDetail.dialog.editGroup') : t('legalDetail.dialog.addGroup')}
      submitLabel={group ? t('common.actions.save') : t('common.actions.create')}
      loading={loading}
    >
      <TextField
        label={t('legalDetail.dialog.cookieName')}
        fullWidth
        size="small"
        data-testid="cookie-group-form.cookie-name"
        {...register('cookie_name', { required: t('legalDetail.dialog.cookieNameRequired') })}
        error={!!errors.cookie_name}
        helperText={errors.cookie_name?.message}
      />
      <Controller
        name="is_required"
        control={control}
        render={({ field }) => (
          <FormControlLabel
            control={<Switch checked={field.value} onChange={field.onChange} data-testid="cookie-group-form.is-required" />}
            label={t('legalDetail.dialog.required')}
          />
        )}
      />
      <Controller
        name="default_enabled"
        control={control}
        render={({ field }) => (
          <FormControlLabel
            control={<Switch checked={field.value} onChange={field.onChange} data-testid="cookie-group-form.default-enabled" />}
            label={t('legalDetail.dialog.defaultEnabled')}
          />
        )}
      />
    </FormDialog>
  );
}

// --- Item form dialog ---

interface ItemFormData {
  cookie_name: string;
  is_required: boolean;
}

interface ItemFormDialogProps {
  open: boolean;
  item?: LegalItemResponse | null;
  itemCount: number;
  onSubmit: (data: CreateLegalItemRequest) => void;
  onClose: () => void;
  loading?: boolean;
}

function ItemFormDialog({ open, item, itemCount, onSubmit, onClose, loading }: ItemFormDialogProps) {
  const { t } = useTranslation();
  const { register, handleSubmit, reset, control, formState: { errors } } = useForm<ItemFormData>({
    defaultValues: { cookie_name: '', is_required: false },
  });

  useEffect(() => {
    if (!open) return;
    reset(item ? {
      cookie_name: item.cookie_name,
      is_required: item.is_required,
    } : { cookie_name: '', is_required: false });
  }, [open, item, reset]);

  const onFormSubmit = (data: ItemFormData) => {
    onSubmit({
      cookie_name: data.cookie_name,
      display_order: item ? item.display_order : itemCount,
      is_required: data.is_required,
    });
  };

  return (
    <FormDialog
      open={open}
      onClose={onClose}
      onSubmit={handleSubmit(onFormSubmit)}
      icon="cookie"
      title={item ? t('legalDetail.dialog.editItem') : t('legalDetail.dialog.addItem')}
      submitLabel={item ? t('common.actions.save') : t('common.actions.create')}
      loading={loading}
    >
      <TextField
        label={t('legalDetail.dialog.cookieName')}
        fullWidth
        size="small"
        data-testid="cookie-item-form.cookie-name"
        {...register('cookie_name', { required: t('legalDetail.dialog.cookieNameRequired') })}
        error={!!errors.cookie_name}
        helperText={errors.cookie_name?.message}
      />
      <Controller
        name="is_required"
        control={control}
        render={({ field }) => (
          <FormControlLabel
            control={<Switch checked={field.value} onChange={field.onChange} data-testid="cookie-item-form.is-required" />}
            label={t('legalDetail.dialog.required')}
          />
        )}
      />
    </FormDialog>
  );
}

// --- Sortable item row ---

interface SortableItemRowProps {
  item: LegalItemResponse;
  canWrite: boolean;
  isAdmin: boolean;
  onEdit: (item: LegalItemResponse) => void;
  onDelete: (item: LegalItemResponse) => void;
}

function SortableItemRow({ item, canWrite, isAdmin, onEdit, onDelete }: SortableItemRowProps) {
  const { t } = useTranslation();
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.id });

  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };

  return (
    <TableRow ref={setNodeRef} style={style} {...attributes} data-testid={`cookie-item.${item.id}`}>
      {canWrite && (
        <TableCell sx={{ width: 48, px: 1 }}>
          <IconButton size="small" sx={{ cursor: 'grab' }} {...listeners} aria-label="Drag to reorder">
            <DragIndicatorIcon fontSize="small" />
          </IconButton>
        </TableCell>
      )}
      <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{item.cookie_name}</TableCell>
      <TableCell>
        <Chip
          label={item.is_required ? t('common.labels.yes') : t('common.labels.no')}
          size="small"
          color={item.is_required ? 'warning' : 'default'}
          variant="outlined"
        />
      </TableCell>
      <TableCell align="right">
        {canWrite && (
          <Tooltip title={t('common.actions.edit')} aria-label={t('common.actions.edit')}>
            <IconButton size="small" onClick={() => onEdit(item)} data-testid={`cookie-item.edit.${item.id}`}>
              <EditIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
        {isAdmin && (
          <Tooltip title={t('common.actions.delete')} aria-label={t('common.actions.delete')}>
            <IconButton size="small" color="error" onClick={() => onDelete(item)} data-testid={`cookie-item.delete.${item.id}`}>
              <DeleteIcon fontSize="small" />
            </IconButton>
          </Tooltip>
        )}
      </TableCell>
    </TableRow>
  );
}

// --- Items section for a group ---

interface GroupItemsSectionProps {
  groupId: string;
}

function GroupItemsSection({ groupId }: GroupItemsSectionProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { showError, showSuccess } = useErrorSnackbar();
  const { canWrite, isAdmin } = useAuth();
  const [itemFormOpen, setItemFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<LegalItemResponse | null>(null);
  const [deletingItem, setDeletingItem] = useState<LegalItemResponse | null>(null);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const { data: items, isLoading } = useQuery({
    queryKey: ['legalItems', groupId],
    queryFn: () => getLegalItems(groupId),
    enabled: !!groupId,
  });

  const { orderedItems, reorder, resetOrder } = useReorderableList(items);

  const createItemMutation = useMutation({
    mutationFn: (data: CreateLegalItemRequest) => createLegalItem(groupId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['legalItems', groupId] });
      setItemFormOpen(false);
      showSuccess(t('legalDetail.items.messages.created'));
    },
    onError: (error) => showError(error),
  });

  const updateItemMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateLegalItemRequest }) => updateLegalItem(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['legalItems', groupId] });
      setEditingItem(null);
      showSuccess(t('legalDetail.items.messages.updated'));
    },
    onError: (error) => showError(error),
  });

  const deleteItemMutation = useMutation({
    mutationFn: (id: string) => deleteLegalItem(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['legalItems', groupId] });
      setDeletingItem(null);
      showSuccess(t('legalDetail.items.messages.deleted'));
    },
    onError: (error) => showError(error),
  });

  const reorderMutation = useMutation({
    mutationFn: (reorderedItems: LegalItemResponse[]) =>
      Promise.all(
        reorderedItems.map((item, index) =>
          updateLegalItem(item.id, { display_order: index }),
        ),
      ),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['legalItems', groupId] });
    },
    onError: (error) => {
      showError(error);
      resetOrder();
      queryClient.invalidateQueries({ queryKey: ['legalItems', groupId] });
    },
  });

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const reordered = reorder(active.id as string, over.id as string);
    if (reordered) reorderMutation.mutate(reordered);
  }, [reorder, reorderMutation]);

  return (
    <Box data-testid={`cookie-group-items.${groupId}`}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
        <Box
          component="span"
          sx={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: 0.8,
            textTransform: 'uppercase',
            color: 'var(--on-surface-variant)',
            fontVariationSettings: '"wght" 600, "opsz" 11',
          }}
        >
          {t('legalDetail.items.title')}
        </Box>
        {canWrite && (
          <M3Button
            size="sm"
            variant="ghost"
            icon="add"
            onClick={() => setItemFormOpen(true)}
            data-testid="cookie-items.add-btn"
          >
            {t('legalDetail.items.add')}
          </M3Button>
        )}
      </Box>

      {isLoading ? (
        <LoadingState label={t('legalDetail.items.loadingItems')} />
      ) : !orderedItems || orderedItems.length === 0 ? (
        <Box
          sx={{
            py: 3,
            textAlign: 'center',
            fontSize: 13,
            color: 'var(--on-surface-variant)',
            bgcolor: 'var(--surface-container-low)',
            borderRadius: '14px',
            border: '1px dashed var(--outline-variant)',
          }}
        >
          {t('legalDetail.items.empty')}
        </Box>
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
          <Box
            sx={{
              bgcolor: 'var(--surface-container-low)',
              border: '1px solid var(--outline-variant)',
              borderRadius: '16px',
              overflow: 'hidden',
            }}
          >
            <Table
              size="small"
              data-testid={`cookie-items-table.${groupId}`}
              sx={{
                '& th': {
                  color: 'var(--on-surface-variant)',
                  fontSize: 11,
                  fontWeight: 600,
                  letterSpacing: 1,
                  textTransform: 'uppercase',
                  borderBottom: '1px solid var(--outline-variant)',
                  fontVariationSettings: '"wght" 600, "opsz" 11',
                  height: 44,
                  py: 0,
                },
                '& td': {
                  borderBottom: '1px solid var(--outline-variant)',
                  color: 'var(--on-surface)',
                },
                '& tbody tr:last-of-type td': { borderBottom: 'none' },
                '& tbody tr': {
                  transition: 'background 160ms cubic-bezier(0.2, 0, 0, 1)',
                  '&:hover': { bgcolor: 'var(--surface-container)' },
                },
              }}
            >
              <TableHead>
                <TableRow>
                  {canWrite && <TableCell sx={{ width: 48, px: 1 }} />}
                  <TableCell>{t('legalDetail.dialog.cookieName')}</TableCell>
                  <TableCell>{t('legalDetail.dialog.required')}</TableCell>
                  <TableCell align="right">{t('common.table.actions')}</TableCell>
                </TableRow>
              </TableHead>
              <SortableContext items={orderedItems.map((i) => i.id)} strategy={verticalListSortingStrategy}>
                <TableBody>
                  {orderedItems.map((item) => (
                    <SortableItemRow
                      key={item.id}
                      item={item}
                      canWrite={canWrite}
                      isAdmin={isAdmin}
                      onEdit={setEditingItem}
                      onDelete={setDeletingItem}
                    />
                  ))}
                </TableBody>
              </SortableContext>
            </Table>
          </Box>
        </DndContext>
      )}

      <ItemFormDialog
        open={itemFormOpen}
        itemCount={orderedItems.length}
        onSubmit={(data) => createItemMutation.mutate(data)}
        onClose={() => setItemFormOpen(false)}
        loading={createItemMutation.isPending}
      />
      <ItemFormDialog
        open={!!editingItem}
        item={editingItem}
        itemCount={orderedItems.length}
        onSubmit={(data) => editingItem && updateItemMutation.mutate({ id: editingItem.id, data })}
        onClose={() => setEditingItem(null)}
        loading={updateItemMutation.isPending}
      />
      <ConfirmDialog
        open={!!deletingItem}
        title={t('legalDetail.items.deleteItem')}
        message={t('legalDetail.items.deleteMessage', { name: deletingItem?.cookie_name })}
        confirmLabel={t('common.actions.delete')}
        onConfirm={() => deletingItem && deleteItemMutation.mutate(deletingItem.id)}
        onCancel={() => setDeletingItem(null)}
        loading={deleteItemMutation.isPending}
      />
    </Box>
  );
}

// --- Dialog state reducer ---

interface CookieDialogState {
  groupFormOpen: boolean;
  editingGroup: LegalGroupResponse | null;
  deletingGroup: LegalGroupResponse | null;
}

type CookieDialogAction =
  | { type: 'OPEN_GROUP_FORM' }
  | { type: 'CLOSE_GROUP_FORM' }
  | { type: 'SET_EDITING_GROUP'; payload: LegalGroupResponse | null }
  | { type: 'SET_DELETING_GROUP'; payload: LegalGroupResponse | null };

const initialDialogState: CookieDialogState = {
  groupFormOpen: false,
  editingGroup: null,
  deletingGroup: null,
};

function cookieDialogReducer(state: CookieDialogState, action: CookieDialogAction): CookieDialogState {
  switch (action.type) {
    case 'OPEN_GROUP_FORM':
      return { ...state, groupFormOpen: true };
    case 'CLOSE_GROUP_FORM':
      return { ...state, groupFormOpen: false };
    case 'SET_EDITING_GROUP':
      return { ...state, editingGroup: action.payload };
    case 'SET_DELETING_GROUP':
      return { ...state, deletingGroup: action.payload };
    default:
      return state;
  }
}

// --- Main page ---

interface CookieConsentPageProps {
  embedded?: boolean;
}

export default function CookieConsentPage({ embedded = false }: CookieConsentPageProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { selectedSiteId } = useSiteContext();
  const { canWrite, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const { showError, showSuccess } = useErrorSnackbar();
  const [dialogState, dialogDispatch] = useReducer(cookieDialogReducer, initialDialogState);

  // Fetch cookie consent document
  const { data: cookieDoc, isLoading: docLoading, error: docError } = useQuery({
    queryKey: ['legal-cookie-consent', selectedSiteId],
    queryFn: async () => {
      const result = await getLegalDocuments(selectedSiteId!, { page: 1, page_size: 100 });
      return result.data.find((d) => d.document_type === 'CookieConsent') ?? null;
    },
    enabled: !!selectedSiteId,
  });

  // Fetch groups for the document
  const { data: groups, isLoading: groupsLoading, error: groupsError } = useQuery({
    queryKey: ['legalGroups', cookieDoc?.id],
    queryFn: () => getLegalGroups(cookieDoc!.id),
    enabled: !!cookieDoc?.id,
  });

  // Create the cookie consent document
  const createDocMutation = useMutation({
    mutationFn: () => createLegalDocument(selectedSiteId!, {
      cookie_name: 'cookie_consent',
      document_type: 'CookieConsent',
      status: 'Draft',
      site_ids: [selectedSiteId!],
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['legal-cookie-consent', selectedSiteId] });
      showSuccess(t('cookieConsent.messages.created'));
    },
    onError: (error) => showError(error),
  });

  // Publish / unpublish cookie consent document
  const publishMutation = useMutation({
    mutationFn: () => updateLegalDocument(cookieDoc!.id, { status: 'Published' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['legal-cookie-consent', selectedSiteId] });
      showSuccess(t('legal.messages.published'));
    },
    onError: (error) => showError(error),
  });

  const unpublishMutation = useMutation({
    mutationFn: () => updateLegalDocument(cookieDoc!.id, { status: 'Draft' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['legal-cookie-consent', selectedSiteId] });
      showSuccess(t('legal.messages.unpublished'));
    },
    onError: (error) => showError(error),
  });

  // Group mutations
  const createGroupMutation = useMutation({
    mutationFn: (data: CreateLegalGroupRequest) => createLegalGroup(cookieDoc!.id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['legalGroups', cookieDoc?.id] });
      dialogDispatch({ type: 'CLOSE_GROUP_FORM' });
      showSuccess(t('legalDetail.groups.messages.created'));
    },
    onError: (error) => showError(error),
  });

  const updateGroupMutation = useMutation({
    mutationFn: ({ groupId, data }: { groupId: string; data: UpdateLegalGroupRequest }) =>
      updateLegalGroup(groupId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['legalGroups', cookieDoc?.id] });
      dialogDispatch({ type: 'SET_EDITING_GROUP', payload: null });
      showSuccess(t('legalDetail.groups.messages.updated'));
    },
    onError: (error) => showError(error),
  });

  const deleteGroupMutation = useMutation({
    mutationFn: (groupId: string) => deleteLegalGroup(groupId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['legalGroups', cookieDoc?.id] });
      dialogDispatch({ type: 'SET_DELETING_GROUP', payload: null });
      showSuccess(t('legalDetail.groups.messages.deleted'));
    },
    onError: (error) => showError(error),
  });

  const handleMoveGroup = async (currentIndex: number, direction: 'up' | 'down') => {
    if (!groups) return;
    const targetIndex = direction === 'up' ? currentIndex - 1 : currentIndex + 1;
    if (targetIndex < 0 || targetIndex >= groups.length) return;
    // Build new order: swap the two items, then assign sequential display_order
    const reordered = [...groups];
    [reordered[currentIndex], reordered[targetIndex]] = [reordered[targetIndex], reordered[currentIndex]];
    await Promise.all(
      reordered.map((g, i) => updateLegalGroup(g.id, { display_order: i }))
    );
    queryClient.invalidateQueries({ queryKey: ['legalGroups', cookieDoc?.id] });
  };

  // No site selected
  if (!selectedSiteId) {
    return (
      <Box data-testid="cookie-consent.page">
        {!embedded && <PageHeader icon="cookie" title={t('cookieConsent.title')} subtitle={t('cookieConsent.subtitle')} />}
        <EmptyState
          icon={<CookieIcon sx={{ fontSize: 64 }} />}
          title={t('common.noSiteSelected')}
          description={t('cookieConsent.empty.noSite')}
        />
      </Box>
    );
  }

  // Loading the document
  if (docLoading) {
    return (
      <Box data-testid="cookie-consent.page">
        {!embedded && <PageHeader icon="cookie" title={t('cookieConsent.title')} subtitle={t('cookieConsent.subtitle')} />}
        <LoadingState label={t('cookieConsent.loading')} />
      </Box>
    );
  }

  // Error loading document
  if (docError) {
    return (
      <Box data-testid="cookie-consent.page">
        {!embedded && <PageHeader icon="cookie" title={t('cookieConsent.title')} subtitle={t('cookieConsent.subtitle')} />}
        <Alert severity="error">{t('common.errors.loadFailed')}</Alert>
      </Box>
    );
  }

  // No cookie consent document yet
  if (!cookieDoc) {
    return (
      <Box data-testid="cookie-consent.page">
        {!embedded && <PageHeader icon="cookie" title={t('cookieConsent.title')} subtitle={t('cookieConsent.subtitle')} />}
        <EmptyState
          icon={<CookieIcon sx={{ fontSize: 64 }} />}
          title={t('cookieConsent.empty.title')}
          description={t('cookieConsent.empty.description')}
          action={canWrite ? {
            label: t('cookieConsent.createDocument'),
            onClick: () => createDocMutation.mutate(),
          } : undefined}
        />
      </Box>
    );
  }

  return (
    <Box data-testid="cookie-consent.page">
      {!embedded && (
        <PageHeader
          icon="cookie"
          title={t('cookieConsent.title')}
          subtitle={t('cookieConsent.subtitle')}
          breadcrumbs={[
            { label: t('layout.sidebar.content') },
            { label: t('layout.sidebar.legal'), path: '/legal' },
            { label: t('cookieConsent.title') },
          ]}
          action={{
            label: t('cookieConsent.manageDocument'),
            icon: <OpenInNewIcon />,
            onClick: () => navigate(`/legal/${cookieDoc.id}`),
          }}
        />
      )}

      {/* Document info — tokenised card with tonal icon tile */}
      <Box
        data-testid="cookie-consent.doc-info"
        sx={{
          mb: 3,
          p: 2.5,
          bgcolor: 'var(--surface-container)',
          border: '1px solid var(--outline-variant)',
          borderRadius: '20px',
          display: 'flex',
          alignItems: 'center',
          gap: 2,
          flexWrap: 'wrap',
        }}
      >
        <Box
          aria-hidden="true"
          sx={{
            width: 44,
            height: 44,
            borderRadius: '14px',
            bgcolor: 'var(--primary-container)',
            color: 'var(--on-primary-container)',
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Icon name="cookie" size={24} />
        </Box>
        <Box sx={{ minWidth: 0 }}>
          <Box
            component="div"
            sx={{
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: 0.5,
              textTransform: 'uppercase',
              color: 'var(--on-surface-variant)',
              fontVariationSettings: '"wght" 600, "opsz" 11',
            }}
          >
            {t('legalDetail.cookieName')}
          </Box>
          <Box
            component="div"
            sx={{
              fontFamily: 'var(--font-mono)',
              fontSize: 14,
              color: 'var(--on-surface)',
              wordBreak: 'break-all',
            }}
          >
            {cookieDoc.cookie_name}
          </Box>
        </Box>
        <StatusChip value={cookieDoc.status} size="medium" />
        <Box sx={{ flex: 1 }} />
        {canWrite && cookieDoc.status === 'Draft' && (
          <M3Button
            size="sm"
            variant="filled"
            icon="publish"
            onClick={() => publishMutation.mutate()}
            disabled={publishMutation.isPending}
            data-testid="cookie-consent.publish-btn"
          >
            {t('workflow.publish')}
          </M3Button>
        )}
        {canWrite && cookieDoc.status === 'Published' && (
          <M3Button
            size="sm"
            variant="outlined"
            icon="unpublished"
            onClick={() => unpublishMutation.mutate()}
            disabled={unpublishMutation.isPending}
            data-testid="cookie-consent.unpublish-btn"
          >
            {t('workflow.unpublish')}
          </M3Button>
        )}
        <M3Button
          size="sm"
          variant="outlined"
          icon="open_in_new"
          onClick={() => navigate(`/legal/${cookieDoc.id}`)}
          data-testid="cookie-consent.edit-content-btn"
        >
          {t('cookieConsent.editContent')}
        </M3Button>
      </Box>

      {/* Groups section */}
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box
          component="h2"
          sx={{
            m: 0,
            fontSize: 20,
            fontWeight: 700,
            color: 'var(--on-surface)',
            fontVariationSettings: '"wght" 700, "opsz" 20',
            letterSpacing: -0.2,
          }}
        >
          {t('legalDetail.groups.title')}
        </Box>
        {canWrite && (
          <M3Button
            variant="filled"
            icon="add"
            onClick={() => dialogDispatch({ type: 'OPEN_GROUP_FORM' })}
            data-testid="cookie-consent.add-group-btn"
          >
            {t('legalDetail.groups.add')}
          </M3Button>
        )}
      </Box>

      {groupsLoading ? (
        <LoadingState label={t('legalDetail.groups.loadingGroups')} />
      ) : groupsError ? (
        <Alert severity="error" data-testid="cookie-consent.groups-error">{t('legalDetail.loadGroupsFailed')}</Alert>
      ) : !groups || groups.length === 0 ? (
        <EmptyState
          icon={<CookieIcon sx={{ fontSize: 48 }} />}
          title={t('legalDetail.groups.empty')}
          description={t('legalDetail.groups.emptyDescription')}
          action={canWrite ? { label: t('legalDetail.groups.add'), onClick: () => dialogDispatch({ type: 'OPEN_GROUP_FORM' }) } : undefined}
        />
      ) : (
        <Stack spacing={2}>
          {groups.map((group, index) => (
            <Accordion
              key={group.id}
              defaultExpanded
              disableGutters
              elevation={0}
              data-testid={`cookie-group.${group.id}`}
              sx={{
                bgcolor: 'var(--surface-container)',
                border: '1px solid var(--outline-variant)',
                borderRadius: '20px !important',
                overflow: 'hidden',
                '&:before': { display: 'none' },
                '&.Mui-expanded': { my: 0 },
              }}
            >
              <AccordionSummary
                expandIcon={<ExpandMoreIcon sx={{ color: 'var(--on-surface-variant)' }} />}
                sx={{
                  px: 2.5,
                  py: 0.5,
                  minHeight: 64,
                  '&.Mui-expanded': { minHeight: 64 },
                  '& .MuiAccordionSummary-content': { gap: 1.5, alignItems: 'center' },
                }}
              >
                <Box
                  aria-hidden="true"
                  sx={{
                    width: 36,
                    height: 36,
                    borderRadius: '10px',
                    bgcolor: group.is_required
                      ? 'var(--warn-container)'
                      : 'var(--tertiary-container)',
                    color: group.is_required
                      ? 'var(--on-warn-container)'
                      : 'var(--on-tertiary-container)',
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <Icon name={group.is_required ? 'lock' : 'toggle_on'} size={18} />
                </Box>
                <Box
                  component="span"
                  sx={{
                    flexGrow: 1,
                    fontFamily: 'var(--font-mono)',
                    fontSize: 14,
                    color: 'var(--on-surface)',
                  }}
                >
                  {group.cookie_name}
                </Box>
                <Box
                  component="span"
                  sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    px: 1.25,
                    height: 22,
                    borderRadius: '999px',
                    bgcolor: group.is_required
                      ? 'var(--warn-container)'
                      : 'transparent',
                    color: group.is_required
                      ? 'var(--on-warn-container)'
                      : 'var(--on-surface-variant)',
                    border: group.is_required
                      ? 'none'
                      : '1px solid var(--outline-variant)',
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: 0.3,
                    fontVariationSettings: '"wght" 600, "opsz" 11',
                  }}
                >
                  {group.is_required ? t('legalDetail.groups.required') : t('legalDetail.groups.optional')}
                </Box>
                <Box
                  component="span"
                  sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    px: 1.25,
                    height: 22,
                    borderRadius: '999px',
                    bgcolor: group.default_enabled
                      ? 'var(--tertiary-container)'
                      : 'transparent',
                    color: group.default_enabled
                      ? 'var(--on-tertiary-container)'
                      : 'var(--on-surface-variant)',
                    border: group.default_enabled
                      ? 'none'
                      : '1px solid var(--outline-variant)',
                    fontSize: 11,
                    fontWeight: 600,
                    letterSpacing: 0.3,
                    fontVariationSettings: '"wght" 600, "opsz" 11',
                  }}
                >
                  {group.default_enabled ? t('legalDetail.groups.enabled') : t('legalDetail.groups.disabled')}
                </Box>
              </AccordionSummary>
              <AccordionDetails sx={{ px: 2.5, pb: 2.5, pt: 0 }}>
                <Box
                  sx={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 0.5,
                    mb: 1.5,
                    justifyContent: 'flex-end',
                    borderTop: '1px solid var(--outline-variant)',
                    pt: 1.5,
                  }}
                >
                  {canWrite && (
                    <>
                      <M3IconButton
                        name="arrow_upward"
                        size={34}
                        tooltip={t('common.actions.moveUp')}
                        disabled={index === 0}
                        onClick={() => handleMoveGroup(index, 'up')}
                        data-testid={`cookie-group.move-up.${group.id}`}
                      />
                      <M3IconButton
                        name="arrow_downward"
                        size={34}
                        tooltip={t('common.actions.moveDown')}
                        disabled={index === groups.length - 1}
                        onClick={() => handleMoveGroup(index, 'down')}
                        data-testid={`cookie-group.move-down.${group.id}`}
                      />
                      <M3IconButton
                        name="edit"
                        size={34}
                        tooltip={t('legalDetail.groups.editGroup')}
                        onClick={() => dialogDispatch({ type: 'SET_EDITING_GROUP', payload: group })}
                        data-testid={`cookie-group.edit.${group.id}`}
                      />
                    </>
                  )}
                  {isAdmin && (
                    <M3IconButton
                      name="delete"
                      size={34}
                      tooltip={t('legalDetail.groups.deleteGroup')}
                      onClick={() => dialogDispatch({ type: 'SET_DELETING_GROUP', payload: group })}
                      data-testid={`cookie-group.delete.${group.id}`}
                    />
                  )}
                </Box>
                <GroupItemsSection groupId={group.id} />
              </AccordionDetails>
            </Accordion>
          ))}
        </Stack>
      )}

      {/* Group form dialogs */}
      <GroupFormDialog
        open={dialogState.groupFormOpen}
        nextOrder={groups?.length ?? 0}
        onSubmit={(data) => createGroupMutation.mutate(data)}
        onClose={() => dialogDispatch({ type: 'CLOSE_GROUP_FORM' })}
        loading={createGroupMutation.isPending}
      />
      <GroupFormDialog
        open={!!dialogState.editingGroup}
        group={dialogState.editingGroup}
        nextOrder={groups?.length ?? 0}
        onSubmit={(data) => dialogState.editingGroup && updateGroupMutation.mutate({ groupId: dialogState.editingGroup.id, data })}
        onClose={() => dialogDispatch({ type: 'SET_EDITING_GROUP', payload: null })}
        loading={updateGroupMutation.isPending}
      />
      <ConfirmDialog
        open={!!dialogState.deletingGroup}
        title={t('legalDetail.groups.deleteGroup')}
        message={t('legalDetail.groups.deleteMessage', { name: dialogState.deletingGroup?.cookie_name })}
        confirmLabel={t('common.actions.delete')}
        onConfirm={() => dialogState.deletingGroup && deleteGroupMutation.mutate(dialogState.deletingGroup.id)}
        onCancel={() => dialogDispatch({ type: 'SET_DELETING_GROUP', payload: null })}
        loading={deleteGroupMutation.isPending}
      />
    </Box>
  );
}
