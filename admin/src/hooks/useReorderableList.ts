import { useCallback, useMemo, useState } from 'react';

interface Identifiable {
  id: string;
}

export interface ReorderableList<T extends Identifiable> {
  /** Server items in the user's local order (server order until reordered). */
  orderedItems: T[];
  /**
   * Move `activeId` to `overId`'s position. Returns the new order for the
   * persistence payload, or null when either id is unknown.
   */
  reorder: (activeId: string, overId: string) => T[] | null;
  /** Drop the local order and follow server order again (failure recovery). */
  resetOrder: () => void;
}

/**
 * Drag-reorder ordering for a server-fetched list, derived instead of
 * synced: server data stays the single source of truth and only the id
 * order is kept locally. Items created after a reorder are appended in
 * server order; deleted items drop out automatically.
 */
export function useReorderableList<T extends Identifiable>(
  items: T[] | undefined,
): ReorderableList<T> {
  const [localOrder, setLocalOrder] = useState<string[] | null>(null);

  const orderedItems = useMemo(() => {
    if (!items) return [];
    if (!localOrder) return items;
    const byId = new Map(items.map((item) => [item.id, item]));
    const known = localOrder
      .map((id) => byId.get(id))
      .filter((item): item is T => item !== undefined);
    const inLocalOrder = new Set(localOrder);
    return [...known, ...items.filter((item) => !inLocalOrder.has(item.id))];
  }, [items, localOrder]);

  const reorder = useCallback(
    (activeId: string, overId: string): T[] | null => {
      const oldIndex = orderedItems.findIndex((item) => item.id === activeId);
      const newIndex = orderedItems.findIndex((item) => item.id === overId);
      if (oldIndex === -1 || newIndex === -1) return null;

      const next = [...orderedItems];
      const [moved] = next.splice(oldIndex, 1);
      next.splice(newIndex, 0, moved);
      setLocalOrder(next.map((item) => item.id));
      return next;
    },
    [orderedItems],
  );

  const resetOrder = useCallback(() => setLocalOrder(null), []);

  return { orderedItems, reorder, resetOrder };
}
