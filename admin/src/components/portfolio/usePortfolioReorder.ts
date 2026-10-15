import { useCallback, useMemo, useState } from 'react';
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import { arrayMove } from '@dnd-kit/sortable';
import { useMutation, useQueryClient, type QueryKey } from '@tanstack/react-query';
import type { ReorderItem } from '@/types/api';
import { useErrorSnackbar } from '@/hooks/useErrorSnackbar';

/** A drop's order, remembered against the server array it was made on. */
interface LocalOrder<T> {
  source: T[] | undefined;
  order: T[];
}

/**
 * Drag-to-reorder state for a portfolio list: applies a drop optimistically,
 * persists the new `display_order`s and refetches `listKey` if that fails.
 * Unlike `useReorderableList`, server order wins whenever the query hands back
 * a new array: these lists are sorted and paginated server-side, so a stale
 * local order must never override a new sort or page.
 */
export function usePortfolioReorder<T extends { id: string }>(
  items: T[] | undefined,
  persist: (order: ReorderItem[]) => Promise<unknown>,
  listKey: QueryKey,
) {
  const queryClient = useQueryClient();
  const { showError } = useErrorSnackbar();
  const [localOrder, setLocalOrder] = useState<LocalOrder<T> | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);

  const ordered = useMemo(
    () => (localOrder && localOrder.source === items ? localOrder.order : (items ?? [])),
    [localOrder, items],
  );

  const { mutate: persistOrder } = useMutation({
    mutationFn: persist,
    onError: (err) => {
      showError(err);
      queryClient.invalidateQueries({ queryKey: listKey });
    },
  });

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = ordered.findIndex((item) => item.id === active.id);
    const newIndex = ordered.findIndex((item) => item.id === over.id);
    const reordered = arrayMove(ordered, oldIndex, newIndex);
    setLocalOrder({ source: items, order: reordered });
    persistOrder(reordered.map((item, index) => ({ id: item.id, display_order: index })));
  }, [items, ordered, persistOrder]);

  const activeItem = activeId ? ordered.find((item) => item.id === activeId) : undefined;

  return { ordered, activeItem, handleDragStart, handleDragEnd };
}
