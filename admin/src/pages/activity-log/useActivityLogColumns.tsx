import type { ReactNode } from 'react';
import { Box, Tooltip, Link as MuiLink } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { Link as RouterLink } from 'react-router';
import { useLocalizedFormat, useLocalizedDistanceToNow } from '@/utils/dateFnsLocale';
import type { DataTableV2Column } from '@/components/shared/listPageV2';
import type { AuditLogEntry } from '@/types/api';
import { ACTION_TONE, ENTITY_DETAIL_ROUTES, type PillTone } from './activityLogConfig';

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

function TokenPill({ tone, children }: { tone: PillTone; children: ReactNode }) {
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

/** Entity cell — links to the entity's detail page when one exists and the
 * entity still exists (not a Delete entry); falls back to a short mono id
 * when the backend could not resolve a display name. */
function EntityCell({ log }: { log: AuditLogEntry }) {
  const detailRoute = ENTITY_DETAIL_ROUTES[log.entity_type];
  const display = log.entity_display?.trim();
  const content = display || log.entity_id.slice(0, 8);
  const fontFamily = display ? 'inherit' : 'var(--font-mono)';
  const linkable = detailRoute && log.action !== 'Delete';

  return (
    <Tooltip title={log.entity_id} arrow>
      {linkable ? (
        <MuiLink
          component={RouterLink}
          to={`${detailRoute}/${log.entity_id}`}
          sx={{
            fontSize: 13.5,
            fontFamily,
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
            fontFamily,
            color: display ? 'var(--on-surface)' : 'var(--on-surface-variant)',
          }}
        >
          {content}
        </Box>
      )}
    </Tooltip>
  );
}

interface UseActivityLogColumnsArgs {
  sortBy: string;
  sortDir: 'asc' | 'desc';
  userNameMap: Map<string, string>;
}

/** Column definitions for the activity-log DataTableV2. */
export function useActivityLogColumns({
  sortBy,
  sortDir,
  userNameMap,
}: UseActivityLogColumnsArgs): DataTableV2Column<AuditLogEntry>[] {
  const { t } = useTranslation();
  const fmt = useLocalizedFormat();
  const distanceToNow = useLocalizedDistanceToNow();

  const sortedDir = (k: string): 'asc' | 'desc' | undefined =>
    sortBy === k ? sortDir : undefined;

  return [
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
      render: (log) => <EntityCell log={log} />,
    },
  ];
}
