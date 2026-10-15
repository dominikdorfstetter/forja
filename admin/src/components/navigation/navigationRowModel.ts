import type { NavigationItem } from '@/types/api';

/** What a navigation item links to, in display-precedence order. */
export type NavigationLinkKind = 'broken' | 'internal' | 'legal' | 'cv' | 'blog' | 'external';

const EM_DASH = '—';

function resolvePageRoute(item: NavigationItem, pageRouteMap: Map<string, string>): string | undefined {
  return item.page_id ? pageRouteMap.get(item.page_id) : undefined;
}

function resolveLegalRoute(item: NavigationItem, legalRouteMap: Map<string, string>): string | undefined {
  return item.legal_document_id ? legalRouteMap.get(item.legal_document_id) : undefined;
}

/** Row label: explicit title, else the resolved target, else an em dash. */
export function getNavigationItemDisplayTitle(
  item: NavigationItem,
  pageRouteMap: Map<string, string>,
  legalRouteMap: Map<string, string>,
): string {
  return item.title
    || resolvePageRoute(item, pageRouteMap)
    || item.external_url
    || resolveLegalRoute(item, legalRouteMap)
    || EM_DASH;
}

/** Link-target column: resolved route, falling back to the raw id / URL. */
export function getNavigationItemLinkTarget(
  item: NavigationItem,
  pageRouteMap: Map<string, string>,
  legalRouteMap: Map<string, string>,
): string {
  if (item.page_id) return resolvePageRoute(item, pageRouteMap) || item.page_id;
  if (item.legal_document_id) return resolveLegalRoute(item, legalRouteMap) || item.legal_document_id;
  return item.external_url || EM_DASH;
}

/** Classify an item's link; an item with no target at all is `broken`. */
export function getNavigationLinkKind(item: NavigationItem): NavigationLinkKind {
  if (!item.page_id && !item.external_url && !item.legal_document_id) return 'broken';
  if (item.page_id) return 'internal';
  if (item.legal_document_id) return 'legal';
  if (item.external_url === '/cv') return 'cv';
  if (item.external_url?.startsWith('/blog/')) return 'blog';
  return 'external';
}
