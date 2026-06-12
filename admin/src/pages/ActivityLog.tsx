import { useMemo, useState } from 'react';
import {
  Box,
  Alert,
  Tooltip,
  Link as MuiLink,
} from '@mui/material';
import { useQuery } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import { useLocalizedFormat, useLocalizedDistanceToNow } from '@/utils/dateFnsLocale';
import { Link as RouterLink } from 'react-router';
import { v5 as uuidv5 } from 'uuid';
import { getAuditAiUsage, getAuditLogs } from '@/services/audit';
import { getClerkUsers } from '@/services/clerkUsers';
import { useSiteContext } from '@/store/SiteContext';
import { useListPageState } from '@/hooks/useListPageState';
import LoadingState from '@/components/shared/LoadingState';
import EmptyState from '@/components/shared/EmptyState';
import {
  PageHeader,
  Toolbar,
  ToolbarSpacer,
  DataTableV2,
  type DataTableV2Column,
  Pagination,
  FilterSelect,
} from '@/components/shared/listPageV2';
import { Icon } from '@/components/design-system';
import type { AuditAction, AuditLogEntry } from '@/types/api';
import { queryKeys } from '@/lib/queryKeys';

/**
 * Same namespace the backend uses (RFC 4122 DNS namespace) to derive
 * deterministic UUIDs from Clerk user IDs.
 */
const CLERK_UUID_NAMESPACE = '6ba7b810-9dad-11d1-80b4-00c04fd430c8';

type PillTone = 'success' | 'info' | 'warn' | 'err' | 'neutral';

/** Action → visual tone for the ActionPill. Grouped so the reader can
 * scan a long log and tell constructive (green) from destructive (red)
 * and workflow-signal (orange) actions at a glance. */
const ACTION_TONE: Record<AuditAction, PillTone> = {
  Create: 'success',
  Read: 'neutral',
  Update: 'info',
  Delete: 'err',
  Publish: 'success',
  Unpublish: 'warn',
  Archive: 'warn',
  Restore: 'info',
  Login: 'neutral',
  Logout: 'neutral',
  SubmitReview: 'info',
  Approve: 'success',
  RequestChanges: 'warn',
  SettingsUpdate: 'info',
  PermissionDenied: 'err',
  OwnershipTransfer: 'warn',
  Export: 'neutral',
};

const TONE_STYLES: Record<PillTone, { bg: string; fg: string; border?: string }> = {
  success: { bg: 'var(--tertiary-container)', fg: 'var(--on-tertiary-container)' },
  info: {
    bg: 'color-mix(in srgb, var(--info) 18%, transparent)',
    fg: 'var(--info)',
  },
  warn: { bg: 'var(--warn-container)', fg: 'var(--on-warn-container)' },
  err: {
    bg: 'color-mix(in srgb, var(--err) 18%, transparent)',
    fg: 'var(--err)',
  },
  neutral: {
    bg: 'var(--surface-container-high)',
    fg: 'var(--on-surface-variant)',
    border: '1px solid var(--outline-variant)',
  },
};

function TokenPill({ tone, children }: { tone: PillTone; children: React.ReactNode }) {
  const paint = TONE_STYLES[tone];
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        padding: '2px 10px',
        height: 22,
        borderRadius: 999,
        background: paint.bg,
        color: paint.fg,
        border: paint.border ?? '1px solid transparent',
        fontSize: 12,
        fontWeight: 600,
        letterSpacing: 0.3,
        fontVariationSettings: '"wght" 600, "opsz" 12',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </span>
  );
}

const ENTITY_DETAIL_ROUTES: Record<string, string> = {
  blog: '/blogs',
  page: '/pages',
  site: '/sites',
  legal_document: '/legal',
};

const ENTITY_TYPES = [
  'blog',
  'page',
  'media',
  'document',
  'navigation_item',
  'navigation_menu',
  'legal_document',
  'cv_entry',
  'skill',
  'social_link',
  'tag',
  'category',
  'site',
  'site_settings',
  'project',
  'api_key',
  'member',
];

const ACTION_TYPES: AuditAction[] = [
  'Create',
  'Update',
  'Delete',
  'Publish',
  'Unpublish',
  'Archive',
  'Restore',
  'SubmitReview',
  'Approve',
  'RequestChanges',
  'SettingsUpdate',
];

/** Map the TypeScript PascalCase action to the DB enum string that the
 * backend compares against (sqlx lowercases, then snake-cases the two
 * multi-word variants). */
const ACTION_DB_NAME: Record<AuditAction, string> = {
  Create: 'create',
  Read: 'read',
  Update: 'update',
  Delete: 'delete',
  Publish: 'publish',
  Unpublish: 'unpublish',
  Archive: 'archive',
  Restore: 'restore',
  Login: 'login',
  Logout: 'logout',
  SubmitReview: 'submit_review',
  Approve: 'approve',
  RequestChanges: 'request_changes',
  SettingsUpdate: 'settings_update',
  PermissionDenied: 'permission_denied',
  OwnershipTransfer: 'ownership_transfer',
  Export: 'export',
};

type Timeframe = 'all' | '24h' | '7d' | '30d';

/** Map the selected preset to an ISO-8601 `from_date`. `all` omits it. */
function timeframeFrom(tf: Timeframe): string | undefined {
  if (tf === 'all') return undefined;
  const now = new Date();
  const ms =
    tf === '24h' ? 24 * 60 * 60 * 1000 : tf === '7d' ? 7 * 24 * 60 * 60 * 1000 : 30 * 24 * 60 * 60 * 1000;
  return new Date(now.getTime() - ms).toISOString();
}

export default function ActivityLogPage() {
  const { t } = useTranslation();
  const fmt = useLocalizedFormat();
  const distanceToNow = useLocalizedDistanceToNow();
  const { selectedSiteId } = useSiteContext();
  const { page, setPage, pageSize, setPageSize, sortBy, sortDir, handleSort } =
    useListPageState();
  const [actionFilter, setActionFilter] = useState<string>('');
  const [entityFilter, setEntityFilter] = useState<string>('');
  const [timeframe, setTimeframe] = useState<Timeframe>('all');

  const fromDate = timeframeFrom(timeframe);

  const { data, isLoading } = useQuery({
    queryKey: queryKeys.auditLogs(selectedSiteId, page, pageSize, sortBy, sortDir, actionFilter, entityFilter, timeframe),
    queryFn: () =>
      getAuditLogs(selectedSiteId, {
        page,
        page_size: pageSize,
        sort_by: sortBy || undefined,
        sort_dir: sortBy ? sortDir : undefined,
        action: actionFilter || undefined,
        entity_type: entityFilter || undefined,
        from_date: fromDate,
      }),
    enabled: !!selectedSiteId,
  });

  const { data: clerkUsers } = useQuery({
    queryKey: queryKeys.clerkUsers(),
    queryFn: () => getClerkUsers({ limit: 200 }),
  });

  const { data: aiUsage } = useQuery({
    queryKey: queryKeys.auditAiUsage(selectedSiteId),
    queryFn: () => getAuditAiUsage(selectedSiteId),
    enabled: !!selectedSiteId,
  });

  const userNameMap = useMemo(() => {
    const map = new Map<string, string>();
    if (!clerkUsers?.data) return map;
    for (const user of clerkUsers.data) {
      const internalUuid = uuidv5(user.id, CLERK_UUID_NAMESPACE);
      map.set(internalUuid, user.name || user.email || user.id);
    }
    return map;
  }, [clerkUsers]);

  if (!selectedSiteId) {
    return (
      <Box>
        <PageHeader
          icon="history"
          breadcrumb={t('layout.sidebar.administration') + ' / ' + t('activity.title')}
          title={t('activity.title')}
          subtitle={t('activity.subtitle')}
        />
        <Alert severity="info">{t('common.noSiteSelected')}</Alert>
      </Box>
    );
  }

  const rows: AuditLogEntry[] = data?.data ?? [];
  const sortedDir = (k: string): 'asc' | 'desc' | undefined =>
    sortBy === k ? sortDir : undefined;

  const columns: DataTableV2Column<AuditLogEntry>[] = [
    {
      key: 'created_at',
      label: t('activity.columns.timestamp'),
      width: '180px',
      muted: true,
      sorted: sortedDir('created_at'),
      render: (log) => (
        <Tooltip title={fmt(log.created_at, 'PPpp')} arrow>
          <span>{distanceToNow(log.created_at, { addSuffix: true })}</span>
        </Tooltip>
      ),
    },
    {
      key: 'user',
      label: t('activity.columns.userId'),
      width: '180px',
      render: (log) => (log.user_id ? userNameMap.get(log.user_id) || '—' : '—'),
    },
    {
      key: 'action',
      label: t('activity.columns.action'),
      width: '160px',
      sorted: sortedDir('action'),
      render: (log) => (
        <TokenPill tone={ACTION_TONE[log.action] ?? 'neutral'}>
          {t(`activity.actions.${log.action}`, log.action)}
        </TokenPill>
      ),
    },
    {
      key: 'entity_type',
      label: t('activity.columns.entityType'),
      width: '140px',
      sorted: sortedDir('entity_type'),
      render: (log) => (
        <TokenPill tone="neutral">{t(`activity.entities.${log.entity_type}`, log.entity_type)}</TokenPill>
      ),
    },
    {
      key: 'entity',
      label: t('activity.columns.entity'),
      width: '1fr',
      render: (log) => {
        const detailRoute = ENTITY_DETAIL_ROUTES[log.entity_type];
        const display = log.entity_display?.trim();
        const shortId = log.entity_id.slice(0, 8);
        const content = display || shortId;
        const isMono = !display;
        const linkable = detailRoute && log.action !== 'Delete';

        return (
          <Tooltip title={log.entity_id} arrow>
            {linkable ? (
              <MuiLink
                component={RouterLink}
                to={`${detailRoute}/${log.entity_id}`}
                sx={{
                  fontSize: 13.5,
                  fontFamily: isMono ? 'var(--font-mono)' : 'inherit',
                  fontWeight: display ? 600 : 500,
                  color: 'var(--primary)',
                  textDecoration: 'none',
                  '&:hover': { textDecoration: 'underline' },
                }}
              >
                {content}
              </MuiLink>
            ) : (
              <Box
                component="span"
                sx={{
                  fontSize: 13.5,
                  fontFamily: isMono ? 'var(--font-mono)' : 'inherit',
                  color: display ? 'var(--on-surface)' : 'var(--on-surface-variant)',
                }}
              >
                {content}
              </Box>
            )}
          </Tooltip>
        );
      },
    },
  ];

  const timeframeOptions: { value: Timeframe; label: string }[] = [
    { value: 'all', label: t('activity.filters.all') },
    { value: '24h', label: t('activity.filters.last24h') },
    { value: '7d', label: t('activity.filters.last7d') },
    { value: '30d', label: t('activity.filters.last30d') },
  ];

  return (
    <Box data-testid="activity.page">
      <PageHeader
        icon="history"
        breadcrumb={t('layout.sidebar.administration') + ' / ' + t('activity.title')}
        title={t('activity.title')}
        subtitle={t('activity.subtitle')}
      />

      {isLoading && rows.length === 0 ? (
        <LoadingState label={t('activity.loading')} />
      ) : (
        <>
          <Toolbar>
            <FilterSelect
              value={timeframe}
              onChange={(v) => {
                setTimeframe(v as Timeframe);
                setPage(1);
              }}
              options={timeframeOptions}
              placeholder={t('activity.filters.timeframe')}
              width={200}
              data-testid="activity.timeframe-filter"
            />
            <FilterSelect
              value={actionFilter}
              onChange={(v) => {
                setActionFilter(v);
                setPage(1);
              }}
              options={ACTION_TYPES.map((a) => ({
                value: ACTION_DB_NAME[a],
                label: t(`activity.actions.${a}`, a),
              }))}
              placeholder={`${t('activity.filters.action')}: ${t('common.filters.all')}`}
              width={200}
              data-testid="activity.action-filter"
            />
            <FilterSelect
              value={entityFilter}
              onChange={(v) => {
                setEntityFilter(v);
                setPage(1);
              }}
              options={ENTITY_TYPES.map((et) => ({
                value: et,
                label: t(`activity.entities.${et}`, et),
              }))}
              placeholder={`${t('activity.filters.entityType')}: ${t('common.filters.all')}`}
              width={220}
              data-testid="activity.entity-filter"
            />
            <ToolbarSpacer />
            {aiUsage && aiUsage.total > 0 && (
              <Tooltip
                title={`${t('activity.aiUsage.last30d')}: ${aiUsage.last_30_days}`}
                arrow
              >
                <Box
                  component="span"
                  data-testid="activity.ai-usage"
                  sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 0.75,
                    px: 1.25,
                    height: 32,
                    borderRadius: 999,
                    bgcolor: 'color-mix(in srgb, var(--primary) 12%, transparent)',
                    color: 'var(--primary)',
                    border: '1px solid color-mix(in srgb, var(--primary) 35%, transparent)',
                    fontSize: 12,
                    fontWeight: 600,
                    fontVariationSettings: '"wght" 600, "opsz" 12',
                    letterSpacing: 0.2,
                  }}
                >
                  <Icon name="auto_awesome" size={16} filled />
                  {t('activity.aiUsage.label')} {aiUsage.total} {t('activity.aiUsage.totalSuffix')}
                </Box>
              </Tooltip>
            )}
          </Toolbar>

          {rows.length === 0 ? (
            <EmptyState
              title={
                actionFilter || entityFilter || timeframe !== 'all'
                  ? t('activity.noFilterResults')
                  : t('activity.empty')
              }
              description={
                actionFilter || entityFilter || timeframe !== 'all'
                  ? t('activity.noFilterResultsDescription')
                  : t('activity.emptyDescription')
              }
            />
          ) : (
            <>
              <DataTableV2<AuditLogEntry>
                data-testid="activity.table"
                columns={columns}
                rows={rows}
                getKey={(log) => log.id}
                onSort={handleSort}
              />
              <Pagination
                total={data?.meta?.total_items || 0}
                page={page}
                perPage={pageSize}
                onPage={setPage}
                onPerPage={(n) => {
                  setPageSize(n);
                  setPage(1);
                }}
              />
            </>
          )}
        </>
      )}
    </Box>
  );
}
