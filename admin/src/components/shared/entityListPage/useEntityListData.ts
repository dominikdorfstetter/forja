import { useMemo } from 'react';
import { useQuery, keepPreviousData } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryKeys';
import type { EntityListAdapter, ListQueryParams } from './types';

interface EntityListDataOptions<TItem, TStatusCounts> {
  adapter: EntityListAdapter<TItem, TStatusCounts>;
  selectedSiteId: string;
  queryParams: ListQueryParams;
  /** Extra reactive deps for the list query key (consumer-owned filters). */
  extraQueryDeps?: readonly unknown[];
}

/** The current page of items plus (when the adapter supports it) status counts. */
export function useEntityListData<TItem, TStatusCounts>({
  adapter,
  selectedSiteId,
  queryParams,
  extraQueryDeps,
}: EntityListDataOptions<TItem, TStatusCounts>) {
  const listQueryKey = useMemo(
    () => [...adapter.listQueryKey(selectedSiteId, queryParams), ...(extraQueryDeps ?? [])],
    [adapter, selectedSiteId, queryParams, extraQueryDeps],
  );

  const { data: listData, isLoading, error } = useQuery({
    queryKey: listQueryKey,
    queryFn: () => adapter.fetchList(selectedSiteId, queryParams),
    enabled: !!selectedSiteId,
    placeholderData: keepPreviousData,
  });

  const { data: statusCounts } = useQuery({
    queryKey: adapter.statusCountsQueryKey?.(selectedSiteId) ?? queryKeys.entityListNoCounts(adapter.entityKey),
    queryFn: () => adapter.fetchStatusCounts!(selectedSiteId),
    enabled: !!selectedSiteId && !!adapter.fetchStatusCounts,
    placeholderData: keepPreviousData,
  });

  return {
    listData,
    items: listData?.data ?? [],
    total: listData?.meta.total_items ?? 0,
    isLoading,
    error,
    statusCounts,
  };
}
