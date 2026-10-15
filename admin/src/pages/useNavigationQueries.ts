import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getMenuItems, getNavigationMenus } from '@/services/navigation';
import { getPages } from '@/services/pages';
import { getLegalDocuments } from '@/services/legal';
import { getSiteLocales } from '@/services/siteLocales';
import { queryKeys } from '@/lib/queryKeys';
import { buildLegalRouteMap, buildPageRouteMap } from '@/pages/navigationLookups';
import { activeSiteLocalesAsLocales } from '@/utils/siteLocales';

/**
 * Server state for the Navigation page: the site's menus, the selected
 * menu's items, active locales, and the page / legal route lookups used to
 * label item link targets.
 */
export function useNavigationQueries(selectedSiteId: string, selectedMenuIndex: number) {
  const { data: menus, isLoading: menusLoading } = useQuery({
    queryKey: queryKeys.navigationMenus(selectedSiteId),
    queryFn: () => getNavigationMenus(selectedSiteId),
    enabled: !!selectedSiteId,
  });

  // Site-specific locales for title fields
  const { data: siteLocalesRaw } = useQuery({
    queryKey: queryKeys.siteLocales(selectedSiteId),
    queryFn: () => getSiteLocales(selectedSiteId),
    enabled: !!selectedSiteId,
  });
  const locales = activeSiteLocalesAsLocales(siteLocalesRaw);

  // Pages resolve page UUIDs → routes
  const { data: pagesData } = useQuery({
    queryKey: queryKeys.pagesForNav(selectedSiteId),
    queryFn: () => getPages(selectedSiteId, { page_size: 200 }),
    enabled: !!selectedSiteId,
    staleTime: 60_000,
  });
  const pageRouteMap = useMemo(() => buildPageRouteMap(pagesData?.data), [pagesData]);

  const selectedMenu = menus?.[selectedMenuIndex] ?? null;

  const { data: items, isLoading: itemsLoading, error: itemsError } = useQuery({
    queryKey: queryKeys.navigationItems(selectedMenu?.id),
    queryFn: () => getMenuItems(selectedMenu!.id),
    enabled: !!selectedMenu?.id,
  });

  // Legal documents resolve legal_document_id UUIDs → /legal/{slug} routes
  const hasLegalItems = useMemo(() => (items ?? []).some((i) => i.legal_document_id), [items]);
  const { data: legalData } = useQuery({
    queryKey: queryKeys.legalForNav(selectedSiteId),
    queryFn: () => getLegalDocuments(selectedSiteId, { page_size: 200 }),
    enabled: !!selectedSiteId && hasLegalItems,
    staleTime: 60_000,
  });
  const legalRouteMap = useMemo(() => buildLegalRouteMap(legalData?.data), [legalData]);

  return {
    menus,
    selectedMenu,
    items,
    itemsError,
    isLoading: menusLoading || itemsLoading,
    locales,
    pageRouteMap,
    legalRouteMap,
  };
}
