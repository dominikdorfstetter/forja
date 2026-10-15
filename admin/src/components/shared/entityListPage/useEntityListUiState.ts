import { useCallback, useEffect, useMemo, useReducer, useRef, type Dispatch, type SyntheticEvent } from 'react';
import { useSearchParams } from 'react-router';
import { useDebouncedValue } from '@/hooks/useDebouncedValue';
import { makeEntityListReducer, type EntityListUIAction } from './entityListReducer';
import { nextSortDir } from './entityListHelpers';
import type { BulkDialogActions, RowDialogActions, SortDir } from './types';

/**
 * Local UI state of the list harness: view tab, search (debounced, resetting
 * to page 1), chip filter, sort, and which row/bulk dialog is open — plus the
 * stable dispatchers handed to the consumer's dialog slots.
 */
export function useEntityListUiState<TItem>(
  defaultSort: { sortBy: string; sortDir: SortDir },
  setPage: (page: number) => void,
) {
  const { reducer, initial } = useMemo(() => makeEntityListReducer<TItem>(defaultSort), [defaultSort]);
  const [ui, dispatch] = useReducer(reducer, initial);

  const debouncedSearch = useDebouncedValue(ui.searchQuery);

  // Reset page to 1 when debounced search changes (skip mount).
  const prevDebouncedSearch = useRef(debouncedSearch);
  useEffect(() => {
    if (prevDebouncedSearch.current !== debouncedSearch) {
      prevDebouncedSearch.current = debouncedSearch;
      setPage(1);
    }
  }, [debouncedSearch, setPage]);

  const handleSort = useCallback(
    (column: string) => {
      const sortDir = nextSortDir({ sortBy: ui.sortBy, sortDir: ui.sortDir }, column);
      dispatch({ type: 'setSort', sortBy: column, sortDir });
      setPage(1);
    },
    [ui.sortBy, ui.sortDir, setPage],
  );

  const handleChipFilterChange = useCallback(
    (value: string) => {
      dispatch({ type: 'setStatusFilter', value: value === 'all' ? '' : value });
      setPage(1);
    },
    [setPage],
  );

  const rowActions: RowDialogActions<TItem> = useMemo(
    () => ({
      openPublish: (item) => dispatch({ type: 'openPublish', item }),
      openUnpublish: (item) => dispatch({ type: 'openUnpublish', item }),
      openArchive: (item) => dispatch({ type: 'openArchive', item }),
      openRestore: (item) => dispatch({ type: 'openRestore', item }),
      closePublish: () => dispatch({ type: 'closePublish' }),
      closeUnpublish: () => dispatch({ type: 'closeUnpublish' }),
      closeArchive: () => dispatch({ type: 'closeArchive' }),
      closeRestore: () => dispatch({ type: 'closeRestore' }),
    }),
    [],
  );

  const bulkActions: BulkDialogActions = useMemo(
    () => ({
      openBulkPublish: () => dispatch({ type: 'openBulkPublish' }),
      openBulkUnpublish: () => dispatch({ type: 'openBulkUnpublish' }),
      openBulkArchive: () => dispatch({ type: 'openBulkArchive' }),
      openBulkRestore: () => dispatch({ type: 'openBulkRestore' }),
      openBulkDelete: () => dispatch({ type: 'openBulkDelete' }),
      closeAllBulk: () => dispatch({ type: 'closeAllBulk' }),
    }),
    [],
  );

  return { ui, dispatch, debouncedSearch, handleSort, handleChipFilterChange, rowActions, bulkActions };
}

/**
 * Keeps the Active/Archived tab in sync with `?tab=archived`: URL changes
 * (including back/forward) switch the tab and call `onTabReset`; tab clicks
 * write the URL. Returns the Tabs `onChange` handler.
 */
export function useArchivedTabParam<TItem>(
  viewTab: 'active' | 'archived',
  dispatch: Dispatch<EntityListUIAction<TItem>>,
  onTabReset: () => void,
) {
  const [searchParams, setSearchParams] = useSearchParams();

  const urlTab = searchParams.get('tab') === 'archived' ? 'archived' : 'active';
  useEffect(() => {
    if (viewTab !== urlTab) {
      dispatch({ type: 'setViewTab', value: urlTab });
      onTabReset();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlTab]);

  return useCallback(
    (_: SyntheticEvent, newValue: 'active' | 'archived') => {
      setSearchParams(newValue === 'archived' ? { tab: 'archived' } : {}, { replace: true });
    },
    [setSearchParams],
  );
}
