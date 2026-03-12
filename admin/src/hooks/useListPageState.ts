import { useState, useCallback } from 'react';
import { useUserPreferences } from '@/store/UserPreferencesContext';

interface UseListPageStateOptions {
  initialPage?: number;
  initialPageSize?: number;
}

export function useListPageState<T>(options?: UseListPageStateOptions) {
  const { preferences } = useUserPreferences();
  const [page, setPage] = useState(options?.initialPage ?? 1);
  const [pageSize, setPageSize] = useState(options?.initialPageSize ?? preferences.page_size);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<T | null>(null);
  const [deleting, setDeleting] = useState<T | null>(null);

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
  };
}
