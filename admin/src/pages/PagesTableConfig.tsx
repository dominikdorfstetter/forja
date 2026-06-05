import type { TFunction } from 'i18next';
import type { PageListItem, PageStatusCounts } from '@/types/api';
import type { DataTableV2Column } from '@/components/shared/listPageV2';
import { DocIcon, StatusPill, type ContentStatus } from '@/components/design-system';
import PageTypeChip from '@/components/shared/PageTypeChip';
type SortDir = 'asc' | 'desc';

interface PagesColumnDeps {
  t: TFunction;
  fmt: (date: Date | number | string, pattern: string) => string;
  sortBy: string;
  sortDir: SortDir;
}

/**
 * DataTableV2 columns for the Pages list. Selection + row actions live in
 * the table shell (not inline), so this config only declares display
 * columns. Sort direction is signalled via `sorted`.
 */
export function buildPagesColumns(deps: PagesColumnDeps): DataTableV2Column<PageListItem>[] {
  const { t, fmt, sortBy, sortDir } = deps;

  const sortedDir = (key: string): 'asc' | 'desc' | undefined =>
    sortBy === key ? sortDir : undefined;

  return [
    {
      key: 'route',
      label: t('pages.table.route'),
      width: '1fr',
      sorted: sortedDir('route'),
      render: (pg) => (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 10,
            minWidth: 0,
            overflow: 'hidden',
          }}
        >
          <DocIcon type="page" size={18} />
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 13.5,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {pg.route}
          </span>
        </span>
      ),
    },
    {
      key: 'page_type',
      label: t('pages.table.type'),
      width: '140px',
      sorted: sortedDir('page_type'),
      render: (pg) => <PageTypeChip value={pg.page_type} />,
    },
    {
      key: 'status',
      label: t('pages.table.status'),
      width: '120px',
      sorted: sortedDir('status'),
      render: (pg) => <StatusPill status={pg.status as ContentStatus} size="sm" />,
    },
    {
      key: 'created_at',
      label: t('pages.table.created'),
      width: '140px',
      muted: true,
      sorted: sortedDir('created_at'),
      render: (pg) => fmt(pg.created_at, 'PP'),
    },
  ];
}

interface StatusChipOption {
  value: string;
  label: string;
  count?: number;
}

/**
 * Assemble filter-pill options for the Pages list toolbar.
 *
 * - "All" shows the total non-archived count.
 * - InReview and Scheduled pills appear when either the editorial workflow
 *   is enabled or at least one row already sits in that state, so legacy
 *   rows remain reachable even on sites where workflow was disabled.
 */
export function buildPagesStatusChipFilters(
  t: TFunction,
  workflowEnabled: boolean,
  counts?: PageStatusCounts,
): StatusChipOption[] {
  const totalActive = counts
    ? counts.draft + counts.in_review + counts.scheduled + counts.published
    : undefined;
  const showInReview = workflowEnabled || (counts?.in_review ?? 0) > 0;
  const showScheduled = workflowEnabled || (counts?.scheduled ?? 0) > 0;
  return [
    { value: 'all', label: t('common.filters.all'), count: totalActive },
    { value: 'Draft', label: t('common.status.draft'), count: counts?.draft },
    ...(showInReview
      ? [{ value: 'InReview', label: t('common.status.inReview'), count: counts?.in_review }]
      : []),
    ...(showScheduled
      ? [{ value: 'Scheduled', label: t('common.status.scheduled'), count: counts?.scheduled }]
      : []),
    { value: 'Published', label: t('common.status.published'), count: counts?.published },
  ];
}
