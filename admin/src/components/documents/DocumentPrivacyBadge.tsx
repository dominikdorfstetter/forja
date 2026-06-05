import { useMemo } from 'react';
import { Box, Tooltip } from '@mui/material';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import HistoryToggleOffIcon from '@mui/icons-material/HistoryToggleOff';
import LockClockOutlinedIcon from '@mui/icons-material/LockClockOutlined';
import { useTranslation } from 'react-i18next';

import {
  classifyPrivacyState,
  type DocumentPrivacyState,
  type PrivacyStateInput,
} from './privacyState';

interface DocumentPrivacyBadgeProps {
  doc: PrivacyStateInput;
  /** Visual size — smaller for grid card overlays, default for detail/banner. */
  variant?: 'card' | 'inline';
}

const STATE_STYLES: Record<
  Exclude<DocumentPrivacyState, 'public'>,
  { bg: string; fg: string; Icon: typeof LockOutlinedIcon; tKey: string }
> = {
  active: {
    bg: 'color-mix(in oklch, var(--warn-container) 85%, transparent)',
    fg: 'var(--on-warn-container)',
    Icon: LockOutlinedIcon,
    tKey: 'documents.privacy.badge',
  },
  expiring: {
    bg: 'color-mix(in oklch, var(--warn-container) 90%, transparent)',
    fg: 'var(--on-warn-container)',
    Icon: HourglassEmptyIcon,
    tKey: 'documents.privacy.expiringBadge',
  },
  expired: {
    bg: 'color-mix(in oklch, var(--surface-container-high) 90%, transparent)',
    fg: 'var(--on-surface-variant)',
    Icon: HistoryToggleOffIcon,
    tKey: 'documents.privacy.expiredBadge',
  },
  locked: {
    bg: 'color-mix(in oklch, var(--err-container) 90%, transparent)',
    fg: 'var(--on-err-container)',
    Icon: LockClockOutlinedIcon,
    tKey: 'documents.privacy.lockedBadge',
  },
};

/**
 * Reads the document's privacy fields, classifies the state, and renders
 * the appropriate badge. Returns `null` for public documents so the caller
 * can use it unconditionally.
 */
export default function DocumentPrivacyBadge({
  doc,
  variant = 'card',
}: DocumentPrivacyBadgeProps) {
  const { t } = useTranslation();
  const state = useMemo(() => classifyPrivacyState(doc), [doc]);

  if (state === 'public') return null;

  const style = STATE_STYLES[state];
  const Icon = style.Icon;
  const label = t(style.tKey).toUpperCase();
  const tooltip = t(`${style.tKey}.tooltip`, { defaultValue: label });

  const sizing =
    variant === 'card'
      ? { px: 0.75, height: 22, fontSize: 10, iconSize: 12, gap: 0.25, radius: '999px' }
      : { px: 1, height: 24, fontSize: 11, iconSize: 14, gap: 0.5, radius: '999px' };

  return (
    <Tooltip title={tooltip}>
      <Box
        component="span"
        data-testid={`document-privacy-badge.${state}`}
        aria-label={label}
        sx={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: sizing.gap,
          px: sizing.px,
          height: sizing.height,
          bgcolor: style.bg,
          color: style.fg,
          fontSize: sizing.fontSize,
          fontWeight: 700,
          letterSpacing: 0.5,
          borderRadius: sizing.radius,
          backdropFilter: 'blur(6px)',
        }}
      >
        <Icon sx={{ fontSize: sizing.iconSize }} />
        {label}
      </Box>
    </Tooltip>
  );
}
