import type { NavigationTree } from "./api";

/**
 * Resolve a nav item's href along the target chain:
 * `external_url ?? '/' + page_slug ?? '/legal/' + legal_slug ?? '#'`.
 * Target-less items are filtered out of the public tree by the API; the
 * `'#'` terminal is kept for robustness.
 */
export function navItemHref(item: NavigationTree): string {
  if (item.external_url) return item.external_url;
  if (item.page_slug != null) return `/${item.page_slug}`;
  if (item.legal_slug) return `/legal/${item.legal_slug}`;
  return "#";
}
