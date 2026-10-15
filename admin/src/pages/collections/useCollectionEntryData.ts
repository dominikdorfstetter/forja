import { useQuery } from '@tanstack/react-query';

import { getSiteLocales } from '@/services/siteLocales';
import { useCustomEntry, useCustomType } from '@/hooks/useCustomTypes';
import { queryKeys } from '@/lib/queryKeys';

/**
 * Loads everything the entry create/edit page needs: the type schema, the
 * entry (only when `entryId` is set — create flows pass `undefined`), and the
 * site's locale codes for the localized tabs (falling back to `['en']`).
 */
export function useCollectionEntryData(siteId: string, typeKey: string, entryId: string | undefined) {
  const { data: type, isLoading: typeLoading } = useCustomType(siteId, typeKey);
  const { data: entry, isLoading: entryLoading } = useCustomEntry(siteId, typeKey, entryId);
  const { data: siteLocales } = useQuery({
    queryKey: queryKeys.siteLocales(siteId),
    queryFn: () => getSiteLocales(siteId),
    enabled: !!siteId,
  });

  const codes = (siteLocales ?? []).map((l) => l.code);

  return {
    type,
    entry: entryId ? entry : undefined,
    isLoading: typeLoading || (!!entryId && entryLoading),
    locales: codes.length ? codes : ['en'],
  };
}
