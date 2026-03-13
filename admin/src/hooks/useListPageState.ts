import { useState, useCallback, useEffect, useRef } from 'react';
import { useUserPreferences } from '@/store/UserPreferencesContext';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';

interface UseListPageStateOptions {
  initialPage?: number;
  initialPageSize?: number;
  initialSortBy?: string;
  initialSortDir?: 'asc' | 'desc';
}

export function useListPageState<T>(options?: UseListPageStateOptions) {
  const { preferences } = useUserPreferences();
  const [page, setPage] = useState(options?.initialPage ?? 1);
  const [pageSize, setPageSize] = useState(options?.initialPageSize ?? preferences.page_size);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<T | null>(null);
  const [deleting, setDeleting] = useState<T | null>(null);

  // Search state
  const [search, setSearch] = useState('');
  const debouncedSearch = useDebouncedValue(search);

  // Sort state
  const [sortBy, setSortBy] = useState(options?.initialSortBy ?? '');
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>(options?.initialSortDir ?? 'asc');

  // Reset to page 1 when debounced search changes (skip initial mount)
  const prevDebouncedSearch = useRef(debouncedSearch);
  useEffect(() => {
    if (prevDebouncedSearch.current !== debouncedSearch) {
      prevDebouncedSearch.current = debouncedSearch;
      setPage(1);
    }
  }, [debouncedSearch]);

  const openCreate = useCallback(() => setFormOpen(true), []);
  const closeForm = useCallback(() => setFormOpen(false), []);
  const openEdit = useCallback((item: T) => setEditing(item), []);
  const closeEdit = useCallback(() => setEditing(null), []);
  const openDelete = useCallback((item: T) => setDeleting(item), []);
  const closeDelete = useCallback(() => setDeleting(null), []);

  const handlePageChange = useCallback((_: unknown, p: number) => setPage(p + 1), []);
  const handleRowsPerPageChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      setPageSize(+e.target.value);
      setPage(1);
    },
    [],
  );

  const handleSort = useCallback((column: string) => {
    setSortBy((prevSortBy) => {
      setSortDir((prevSortDir) =>
        prevSortBy === column ? (prevSortDir === 'asc' ? 'desc' : 'asc') : 'asc'
      );
      return column;
    });
    setPage(1);
  }, []);

  return {
    page,
    setPage,
    pageSize,
    setPageSize,
    formOpen,
    setFormOpen,
    editing,
    setEditing,
    deleting,
    setDeleting,
    openCreate,
    closeForm,
    openEdit,
    closeEdit,
    openDelete,
    closeDelete,
    handlePageChange,
    handleRowsPerPageChange,
    // Search
    search,
    setSearch,
    debouncedSearch,
    // Sort
    sortBy,
    sortDir,
    handleSort,
  };
}
