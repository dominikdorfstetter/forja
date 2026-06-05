import type { TFunction } from 'i18next';
import type { BlogListItem, BlogStatusCounts } from '@/types/api';
import type { DataTableV2Column } from '@/components/shared/listPageV2';
import { DocIcon, Icon, StatusPill, type ContentStatus } from '@/components/design-system';
type SortDir = 'asc' | 'desc';

interface BlogsColumnDeps {
  t: TFunction;
  fmt: (date: Date | number | string, pattern: string) => string;
  sortBy: string;
  sortDir: SortDir;
}

/**
 * Build DataTableV2 columns for the Blogs list. Selection + row actions
 * are rendered by the table shell (not per-column), so this config only
 * declares display columns. Sort direction is signalled via `sorted`;
 * `onSort` is supplied at the call site on a per-table basis.
 */
export function buildBlogsColumns(deps: BlogsColumnDeps): DataTableV2Column<BlogListItem>[] {
  const { t, fmt, sortBy, sortDir } = deps;

  const sortedDir = (key: string): 'asc' | 'desc' | undefined =>
    sortBy === key ? sortDir : undefined;

  return [
    {
      key: 'slug',
      label: t('blogs.table.slug'),
      width: '1fr',
      sorted: sortedDir('slug'),
      render: (blog) => (
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 10,
            minWidth: 0,
            overflow: 'hidden',
          }}
        >
          <DocIcon type="blog" size={18} />
          <span
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 13.5,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
          >
            {blog.slug || '—'}
          </span>
          {blog.is_featured && (
            <Icon
              name="star"
              size={14}
              color="#ffc98a"
              filled
              ariaLabel={t('common.labels.featured')}
            />
          )}
        </span>
      ),
    },
    {
      key: 'author',
      label: t('blogs.table.author'),
      width: '140px',
      muted: true,
      sorted: sortedDir('author'),
      render: (blog) => blog.author,
    },
    {
      key: 'status',
      label: t('blogs.table.status'),
      width: '120px',
      sorted: sortedDir('status'),
      render: (blog) => <StatusPill status={blog.status as ContentStatus} size="sm" />,
    },
    {
      key: 'published_date',
      label: t('blogs.table.published'),
      width: '140px',
      muted: true,
      sorted: sortedDir('published_date'),
      render: (blog) => fmt(blog.published_date, 'PP'),
    },
  ];
}

interface StatusChipOption {
  value: string;
  label: string;
  count?: number;
}

interface BlogsChipFiltersDeps {
  t: TFunction;
  workflowEnabled: boolean;
  counts?: BlogStatusCounts;
}

/**
 * Assemble the filter-pill options for the Blogs list toolbar.
 *
 * - "All" always shows the total count across non-archived states.
 * - InReview and Scheduled pills appear when either (a) the editorial
 *   workflow is enabled for the site, or (b) there are legacy rows in
 *   that state, so the user can still filter their way to them.
 * - Archived is intentionally omitted — it's the alternate view tab.
 */
export function buildBlogsChipFilters({ t, workflowEnabled, counts }: BlogsChipFiltersDeps): StatusChipOption[] {
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
