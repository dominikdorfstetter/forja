import { useState, useCallback, useMemo, useEffect } from 'react';

interface UseBulkSelectionReturn {
  selectedIds: Set<string>;
  toggle: (id: string) => void;
  selectAll: (ids: string[]) => void;
  clear: () => void;
  isSelected: (id: string) => boolean;
  allSelected: (ids: string[]) => boolean;
  count: number;
}

export function useBulkSelection(deps: unknown[] = []): UseBulkSelectionReturn {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Clear selection when dependencies change (e.g. page, perPage, data)
  useEffect(() => {
    setSelectedIds(new Set());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  const toggle = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback((ids: string[]) => {
    setSelectedIds((prev) => {
      const allCurrentlySelected = ids.every((id) => prev.has(id));
      if (allCurrentlySelected) {
        return new Set();
      }
      return new Set(ids);
    });
  }, []);

  const clear = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const isSelected = useCallback((id: string) => selectedIds.has(id), [selectedIds]);

  const allSelected = useCallback(
    (ids: string[]) => ids.length > 0 && ids.every((id) => selectedIds.has(id)),
    [selectedIds],
  );

  const count = useMemo(() => selectedIds.size, [selectedIds]);

  return { selectedIds, toggle, selectAll, clear, isSelected, allSelected, count };
}
