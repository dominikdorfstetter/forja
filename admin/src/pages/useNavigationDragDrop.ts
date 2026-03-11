import { useCallback } from 'react';
import {
  PointerSensor,
  useSensor,
  useSensors,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import apiService from '@/services/api';
import { useErrorSnackbar } from '@/hooks/useErrorSnackbar';
import type { NavigationItem, NavigationMenu, ReorderTreeItem } from '@/types/api';
import { flattenItemsWithDepth } from '@/pages/NavigationReducer';

interface UseNavigationDragDropArgs {
  selectedSiteId: string;
  selectedMenu: NavigationMenu | null;
  setOrderedItems: (fn: NavigationItem[] | ((prev: NavigationItem[]) => NavigationItem[])) => void;
  onDragStarted: (id: string) => void;
  onDragEnded: () => void;
}

export function useNavigationDragDrop({
  selectedSiteId,
  selectedMenu,
  setOrderedItems,
  onDragStarted,
  onDragEnded,
}: UseNavigationDragDropArgs) {
  const queryClient = useQueryClient();
  const { showError } = useErrorSnackbar();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const reorderMutation = useMutation({
    mutationFn: (reorderItems: ReorderTreeItem[]) => {
      if (selectedMenu) {
        return apiService.reorderMenuItems(selectedMenu.id, reorderItems);
      }
      return apiService.reorderNavigationItems(selectedSiteId, reorderItems.map(i => ({ id: i.id, display_order: i.display_order })));
    },
    onError: (error) => {
      showError(error);
      queryClient.invalidateQueries({ queryKey: ['navigation-items'] });
    },
  });

  const handleDragStart = useCallback((event: DragStartEvent) => {
    onDragStarted(event.active.id as string);
  }, [onDragStarted]);

  const isDescendant = useCallback((items: NavigationItem[], parentId: string, candidateChildId: string): boolean => {
    let current = items.find(i => i.id === candidateChildId);
    while (current?.parent_id) {
      if (current.parent_id === parentId) return true;
      current = items.find(i => i.id === current!.parent_id);
    }
    return false;
  }, []);

  const sendReorder = useCallback((items: NavigationItem[]) => {
    const reorderItems: ReorderTreeItem[] = items.map(item => ({
      id: item.id,
      parent_id: item.parent_id,
      display_order: item.display_order,
    }));
    reorderMutation.mutate(reorderItems);
  }, [reorderMutation]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    onDragEnded();
    const { active, over, delta } = event;
    if (!over || active.id === over.id) return;

    const maxDepth = selectedMenu?.max_depth || 3;
    const nestThreshold = 50;
    const shouldNest = delta.x > nestThreshold;

    setOrderedItems((prev) => {
      const flat = flattenItemsWithDepth(prev);
      const activeEntry = flat.find(f => f.item.id === active.id);
      const overEntry = flat.find(f => f.item.id === over.id);
      if (!activeEntry || !overEntry) return prev;

      const activeItem = activeEntry.item;
      const overItem = overEntry.item;

      if (shouldNest) {
        if (overEntry.depth + 1 >= maxDepth) return prev;
        if (isDescendant(prev, active.id as string, over.id as string)) return prev;

        const overChildren = prev.filter(i => i.parent_id === overItem.id);
        const updated = prev.map(item =>
          item.id === activeItem.id
            ? { ...item, parent_id: overItem.id, display_order: overChildren.length }
            : item
        );
        sendReorder(updated);
        return updated;
      } else {
        const newParentId = overItem.parent_id;
        const siblings = prev
          .filter(i => (i.parent_id ?? undefined) === (newParentId ?? undefined) && i.id !== activeItem.id)
          .sort((a, b) => a.display_order - b.display_order);

        const overSiblingIndex = siblings.findIndex(s => s.id === overItem.id);
        const insertIndex = overSiblingIndex >= 0 ? overSiblingIndex : siblings.length;

        const updatedOrders = new Map<string, number>();
        let order = 0;
        for (let i = 0; i < siblings.length + 1; i++) {
          if (i === insertIndex) {
            updatedOrders.set(activeItem.id, order++);
          }
          if (i < siblings.length) {
            updatedOrders.set(siblings[i].id, order++);
          }
        }

        const updated = prev.map(item => {
          if (item.id === activeItem.id) {
            return { ...item, parent_id: newParentId, display_order: updatedOrders.get(item.id) ?? item.display_order };
          }
          const newOrder = updatedOrders.get(item.id);
          if (newOrder !== undefined) {
            return { ...item, display_order: newOrder };
          }
          return item;
        });

        sendReorder(updated);
        return updated;
      }
    });
  }, [selectedMenu, isDescendant, sendReorder, setOrderedItems, onDragEnded]);

  return { sensors, handleDragStart, handleDragEnd };
}
