import { Box, type SxProps, type Theme } from '@mui/material';
import { useTranslation } from 'react-i18next';
import type { ApiKeyStatus, ContentStatus, ApiKeyPermission } from '@/types/api';

interface Paint {
  bg: string;
  fg: string;
  border?: string;
}

/**
 * M3 Expressive status pill. Maps every content / API-key / permission
 * status to a tonal (container + on-container) pair driven by CSS
 * custom properties, so the palette auto-adapts per flavor via
 * buildTokenCss — and on-container foregrounds stay readable even on
 * the light Catppuccin flavors (the tokens darken themselves below the
 * container tint to clear WCAG AA).
 */
const STATUS_PAINT: Record<string, Paint> = {
  // Positive / active
  Active: { bg: 'var(--tertiary-container)', fg: 'var(--on-tertiary-container)' },
  Published: { bg: 'var(--tertiary-container)', fg: 'var(--on-tertiary-container)' },
  Read: { bg: 'var(--tertiary-container)', fg: 'var(--on-tertiary-container)' },

  // Warning / caution
  Blocked: { bg: 'var(--warn-container)', fg: 'var(--on-warn-container)' },
  Archived: { bg: 'var(--warn-container)', fg: 'var(--on-warn-container)' },
  Admin: { bg: 'var(--warn-container)', fg: 'var(--on-warn-container)' },

  // Informational / transitional
  InReview: { bg: 'var(--primary-container)', fg: 'var(--on-primary-container)' },
  Scheduled: {
    bg: 'color-mix(in oklch, var(--info) 18%, transparent)',
    fg: 'var(--info)',
  },
  Write: {
    bg: 'color-mix(in oklch, var(--info) 18%, transparent)',
    fg: 'var(--info)',
  },

  // Danger / revoked
  Revoked: {
    bg: 'color-mix(in oklch, var(--err) 18%, transparent)',
    fg: 'var(--err)',
  },
  Master: {
    bg: 'color-mix(in oklch, var(--err) 18%, transparent)',
    fg: 'var(--err)',
  },

  // Neutral ghost — outlined pill with no fill, for expired / draft states.
  Expired: {
    bg: 'transparent',
    fg: 'var(--on-surface-variant)',
    border: '1px solid var(--outline-variant)',
  },
  Draft: {
    bg: 'transparent',
    fg: 'var(--on-surface-variant)',
    border: '1px solid var(--outline-variant)',
  },
};

const labelKeys: Record<string, string> = {
  Active: 'common.status.active',
  Blocked: 'common.status.blocked',
  Expired: 'common.status.expired',
  Revoked: 'common.status.revoked',
  Draft: 'common.status.draft',
  InReview: 'common.status.inReview',
  Scheduled: 'common.status.scheduled',
  Published: 'common.status.published',
  Archived: 'common.status.archived',
  Master: 'apiKeys.permissions.Master',
  Admin: 'apiKeys.permissions.Admin',
  Write: 'apiKeys.permissions.Write',
  Read: 'apiKeys.permissions.Read',
};

interface StatusChipProps {
  value: ApiKeyStatus | ContentStatus | ApiKeyPermission | string;
  size?: 'small' | 'medium';
  testId?: string;
  sx?: SxProps<Theme>;
}

export default function StatusChip({ value, size = 'small', testId, sx }: StatusChipProps) {
  const { t } = useTranslation();
  const label = labelKeys[value] ? t(labelKeys[value], value) : value;
  const paint: Paint = STATUS_PAINT[value] ?? {
    bg: 'transparent',
    fg: 'var(--on-surface-variant)',
    border: '1px solid var(--outline-variant)',
  };
  const height = size === 'medium' ? 26 : 22;
  const fontSize = size === 'medium' ? 12 : 11;

  return (
    <Box
      component="span"
      data-testid={testId || 'status-chip'}
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        px: 1.25,
        height,
        borderRadius: '999px',
        bgcolor: paint.bg,
        color: paint.fg,
        border: paint.border ?? 'none',
        fontSize,
        fontWeight: 600,
        letterSpacing: 0.3,
        fontVariationSettings: `"wght" 600, "opsz" ${fontSize}`,
        whiteSpace: 'nowrap',
        ...sx,
      }}
    >
      {label}
    </Box>
  );
}
