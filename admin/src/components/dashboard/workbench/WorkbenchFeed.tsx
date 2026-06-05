import { useMemo } from 'react';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import type { BlogListItem, PageListItem, ContentStatus } from '@/types/api';
import {
  Chip,
  Icon,
  StatusPill,
  STATUS_META,
  DocIcon,
  M3IconButton,
  M3Button,
} from '@/components/design-system';

export type WorkbenchFilter = 'attention' | 'review' | 'drafts' | 'scheduled';

type ItemKind = 'needs-review' | 'draft' | 'scheduled';

interface FeedItem {
  key: string;
  kind: ItemKind;
  docType: 'blog' | 'page';
  slug: string;
  status: ContentStatus;
  href: string;
}

export interface WorkbenchFeedProps {
  inReviewBlogs: BlogListItem[];
  inReviewPages: PageListItem[];
  draftBlogs: BlogListItem[];
  draftPages: PageListItem[];
  blogStatusCounts: Record<ContentStatus, number>;
  pageStatusCounts: Record<ContentStatus, number>;
  scheduledItems?: FeedItem[];
  filter: WorkbenchFilter;
  onFilterChange: (next: WorkbenchFilter) => void;
  loading?: boolean;
}

const KIND_META: Record<ItemKind, { icon: string; color: string; labelKey: string; defaultLabel: string }> = {
  'needs-review': {
    icon: 'rate_review',
    color: STATUS_META.InReview.dot,
    labelKey: 'dashboard.workbench.feed.kinds.needsReview',
    defaultLabel: 'Needs review',
  },
  draft: {
    icon: 'edit_note',
    color: STATUS_META.Draft.dot,
    labelKey: 'dashboard.workbench.feed.kinds.draft',
    defaultLabel: 'Draft',
  },
  scheduled: {
    icon: 'schedule',
    color: STATUS_META.Scheduled.dot,
    labelKey: 'dashboard.workbench.feed.kinds.scheduled',
    defaultLabel: 'Scheduled',
  },
};

/**
 * Inbox-style feed of items that need action. Filter chips at the top
 * narrow the view (All attention / Review / Drafts / Scheduled). Each row:
 * tinted icon tile + monospaced slug + kind label + status pill + contextual
 * action button (Review / Continue / chevron-right). Row click navigates
 * to the item's detail editor.
 */
export function WorkbenchFeed({
  inReviewBlogs,
  inReviewPages,
  draftBlogs,
  draftPages,
  blogStatusCounts,
  pageStatusCounts,
  scheduledItems,
  filter,
  onFilterChange,
  loading,
}: WorkbenchFeedProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();

  const allItems = useMemo<FeedItem[]>(() => {
    const reviewItems: FeedItem[] = [
      ...inReviewBlogs.map<FeedItem>((b) => ({
        key: `blog-review-${b.id}`,
        kind: 'needs-review',
        docType: 'blog',
        slug: b.slug || b.id,
        status: b.status,
        href: `/blogs/${b.id}`,
      })),
      ...inReviewPages.map<FeedItem>((p) => ({
        key: `page-review-${p.id}`,
        kind: 'needs-review',
        docType: 'page',
        slug: p.slug || p.id,
        status: p.status,
        href: `/pages/${p.id}`,
      })),
    ];
    const draftItems: FeedItem[] = [
      ...draftBlogs.map<FeedItem>((b) => ({
        key: `blog-draft-${b.id}`,
        kind: 'draft',
        docType: 'blog',
        slug: b.slug || b.id,
        status: b.status,
        href: `/blogs/${b.id}`,
      })),
      ...draftPages.map<FeedItem>((p) => ({
        key: `page-draft-${p.id}`,
        kind: 'draft',
        docType: 'page',
        slug: p.slug || p.id,
        status: p.status,
        href: `/pages/${p.id}`,
      })),
    ];
    return [...reviewItems, ...draftItems, ...(scheduledItems ?? [])];
  }, [inReviewBlogs, inReviewPages, draftBlogs, draftPages, scheduledItems]);

  const visibleItems = useMemo(() => {
    if (filter === 'attention') return allItems;
    if (filter === 'review') return allItems.filter((i) => i.kind === 'needs-review');
    if (filter === 'drafts') return allItems.filter((i) => i.kind === 'draft');
    if (filter === 'scheduled') return allItems.filter((i) => i.kind === 'scheduled');
    return allItems;
  }, [allItems, filter]);

  const totalReview = blogStatusCounts.InReview + pageStatusCounts.InReview;
  const totalDrafts = blogStatusCounts.Draft + pageStatusCounts.Draft;
  const totalScheduled = blogStatusCounts.Scheduled + pageStatusCounts.Scheduled;
  const totalAttention = totalReview + totalDrafts + totalScheduled;

  return (
    <div
      style={{
        background: 'var(--surface-container-low)',
        border: '1px solid var(--outline-variant)',
        borderRadius: 24,
        overflow: 'hidden',
      }}
      data-testid="workbench.feed"
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '14px 20px',
          borderBottom: '1px solid var(--outline-variant)',
          flexWrap: 'wrap',
        }}
      >
        <Chip
          active={filter === 'attention'}
          onClick={() => onFilterChange('attention')}
          icon="inbox"
          count={totalAttention}
        >
          {t('dashboard.workbench.feed.filter.attention', 'Needs attention')}
        </Chip>
        <Chip
          active={filter === 'drafts'}
          onClick={() => onFilterChange('drafts')}
          count={totalDrafts}
        >
          {t('dashboard.workbench.feed.filter.drafts', 'Drafts')}
        </Chip>
        <Chip
          active={filter === 'review'}
          onClick={() => onFilterChange('review')}
          count={totalReview}
        >
          {t('dashboard.workbench.feed.filter.review', 'Review')}
        </Chip>
        <Chip
          active={filter === 'scheduled'}
          onClick={() => onFilterChange('scheduled')}
          count={totalScheduled}
        >
          {t('dashboard.workbench.feed.filter.scheduled', 'Scheduled')}
        </Chip>
      </div>

      {loading ? (
        <div
          style={{
            padding: '32px 20px',
            color: 'var(--on-surface-variant)',
            fontSize: 13,
            textAlign: 'center',
          }}
        >
          {t('dashboard.workbench.feed.loading', 'Loading…')}
        </div>
      ) : visibleItems.length === 0 ? (
        <div
          style={{
            padding: '32px 20px',
            color: 'var(--on-surface-variant)',
            fontSize: 13,
            textAlign: 'center',
          }}
        >
          {t('dashboard.workbench.feed.empty', 'All caught up 🎉')}
        </div>
      ) : (
        visibleItems.map((item, i) => {
          const kind = KIND_META[item.kind];
          const kindLabel = t(kind.labelKey, kind.defaultLabel);
          return (
            <div
              key={item.key}
              role="button"
              tabIndex={0}
              onClick={() => navigate(item.href)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  navigate(item.href);
                }
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 14,
                minHeight: 62,
                padding: '10px 20px',
                borderBottom:
                  i < visibleItems.length - 1 ? '1px solid var(--outline-variant)' : 'none',
                cursor: 'pointer',
                transition: 'background 120ms',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'var(--surface-container)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'transparent';
              }}
            >
              <div
                aria-hidden="true"
                style={{
                  width: 36,
                  height: 36,
                  borderRadius: 10,
                  background: kind.color + '22',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  flexShrink: 0,
                }}
              >
                <Icon name={kind.icon} size={18} color={kind.color} />
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div
                  style={{
                    fontSize: 14,
                    fontWeight: 500,
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    color: 'var(--on-surface)',
                  }}
                >
                  <DocIcon type={item.docType} size={14} />
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: 13,
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {item.slug}
                  </span>
                </div>
                <div style={{ fontSize: 12, color: 'var(--on-surface-variant)', marginTop: 2 }}>
                  {kindLabel}
                </div>
              </div>
              <StatusPill status={item.status} size="sm" />
              {item.kind === 'needs-review' ? (
                <M3Button
                  variant="tonal"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(item.href);
                  }}
                >
                  {t('dashboard.workbench.feed.action.review', 'Review')}
                </M3Button>
              ) : item.kind === 'draft' ? (
                <M3Button
                  variant="outlined"
                  size="sm"
                  icon="edit"
                  onClick={(e) => {
                    e.stopPropagation();
                    navigate(item.href);
                  }}
                >
                  {t('dashboard.workbench.feed.action.continue', 'Continue')}
                </M3Button>
              ) : (
                <M3IconButton name="chevron_right" size={32} ariaLabel={t('common.actions.open', 'Open')} />
              )}
            </div>
          );
        })
      )}
    </div>
  );
}
