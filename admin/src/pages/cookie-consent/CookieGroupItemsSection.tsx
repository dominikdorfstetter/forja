import { useCallback, useState } from 'react';
import { Box, Table, TableBody, TableCell, TableHead, TableRow } from '@mui/material';
import {
  DndContext,
  closestCenter,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { createLegalItem, deleteLegalItem, getLegalItems, updateLegalItem } from '@/services/legal';
import { useErrorSnackbar } from '@/hooks/useErrorSnackbar';
import { useReorderableList } from '@/hooks/useReorderableList';
import type { LegalItemResponse, CreateLegalItemRequest, UpdateLegalItemRequest } from '@/types/api';
import { useAuth } from '@/store/AuthContext';
import LoadingState from '@/components/shared/LoadingState';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import { M3Button } from '@/components/design-system';
import { queryKeys } from '@/lib/queryKeys';
import { useReorderSensors } from '@/components/shared/listPageV2';
import CookieItemFormDialog from './CookieItemFormDialog';
import CookieItemRow from './CookieItemRow';

interface CookieGroupItemsSectionProps {
  groupId: string;
}

/** Items table (drag-to-reorder) + item CRUD dialogs for one cookie group. */
export default function CookieGroupItemsSection({ groupId }: CookieGroupItemsSectionProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { showError, showSuccess } = useErrorSnackbar();
  const { canWrite, isAdmin } = useAuth();
  const [itemFormOpen, setItemFormOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<LegalItemResponse | null>(null);
  const [deletingItem, setDeletingItem] = useState<LegalItemResponse | null>(null);

  const sensors = useReorderSensors();

  const { data: items, isLoading } = useQuery({
    queryKey: queryKeys.legalItems(groupId),
    queryFn: () => getLegalItems(groupId),
    enabled: !!groupId,
  });

  const { orderedItems, reorder, resetOrder } = useReorderableList(items);

  const createItemMutation = useMutation({
    mutationFn: (data: CreateLegalItemRequest) => createLegalItem(groupId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.legalItems(groupId) });
      setItemFormOpen(false);
      showSuccess(t('legalDetail.items.messages.created'));
    },
    onError: (error) => showError(error),
  });

  const updateItemMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateLegalItemRequest }) => updateLegalItem(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.legalItems(groupId) });
      setEditingItem(null);
      showSuccess(t('legalDetail.items.messages.updated'));
    },
    onError: (error) => showError(error),
  });

  const deleteItemMutation = useMutation({
    mutationFn: (id: string) => deleteLegalItem(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.legalItems(groupId) });
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
      queryClient.invalidateQueries({ queryKey: queryKeys.legalItems(groupId) });
    },
    onError: (error) => {
      showError(error);
      resetOrder();
      queryClient.invalidateQueries({ queryKey: queryKeys.legalItems(groupId) });
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
                    <CookieItemRow
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

      <CookieItemFormDialog
        open={itemFormOpen}
        itemCount={orderedItems.length}
        onSubmit={(data) => createItemMutation.mutate(data)}
        onClose={() => setItemFormOpen(false)}
        loading={createItemMutation.isPending}
      />
      <CookieItemFormDialog
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
