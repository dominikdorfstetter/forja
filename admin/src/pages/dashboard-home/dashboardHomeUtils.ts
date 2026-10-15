import type { WorkbenchFilter } from '@/components/dashboard/workbench';

/** localStorage key that remembers a dismissed setup checklist per site. */
export const checklistDismissedKey = (siteId: string) => `forja_checklist_dismissed_${siteId}`;

/** The user has no sites at all (once the site list has loaded) → welcome flow. */
export function hasNoSites(sitesLoading: boolean, sites: readonly unknown[] | undefined): boolean {
  return !sitesLoading && (!sites || sites.length === 0);
}

/** FocusCards highlight one of its three tiles; the default "attention" feed highlights none. */
export function focusCardFilter(filter: WorkbenchFilter): Exclude<WorkbenchFilter, 'attention'> | null {
  return filter === 'attention' ? null : filter;
}

/** True when an optional dashboard list has at least one entry. */
export function hasEntries(list: readonly unknown[] | undefined): boolean {
  return (list ?? []).length > 0;
}
