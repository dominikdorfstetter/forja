import type { NavigationTree } from "./api";

/**
 * Navigation tree item including the first-class legal-document reference
 * fields the API returns (`legal_document_id` FK, `legal_slug` resolved via
 * the version chain root). Declared as an extension so the template keeps
 * building against SDK versions that don't type them yet.
 */
export type NavItem = NavigationTree & {
  legal_document_id?: string | null;
  legal_slug?: string | null;
};

/**
 * Resolve a nav item's href along the target chain:
 * `external_url ?? '/' + page_slug ?? '/legal/' + legal_slug ?? '#'`.
 * Target-less items are filtered out of the public tree by the API; the
 * `'#'` terminal is kept for robustness.
 */
export function navItemHref(item: NavItem): string {
  if (item.external_url) return item.external_url;
  if (item.page_slug != null) return `/${item.page_slug}`;
  if (item.legal_slug) return `/legal/${item.legal_slug}`;
  return "#";
}
