import type { ReactNode } from 'react';
import { Box, Checkbox } from '@mui/material';

const EASE = 'cubic-bezier(0.2, 0, 0, 1)';
const ACTIONS_CLASS = 'library-card-actions';
const CHECKBOX_CLASS = 'library-card-checkbox';

/** Preview-area geometry: a padded icon tile (documents) or a full-bleed 4:3 thumbnail (media). */
const PREVIEW_SX = {
  tile: {
    py: 4,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    bgcolor: 'var(--surface-container-low)',
  },
  thumbnail: {
    aspectRatio: '4 / 3',
    bgcolor: 'var(--surface-container-high)',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
    overflow: 'hidden',
    flexShrink: 0,
  },
} as const;

export type LibraryCardPreviewLayout = keyof typeof PREVIEW_SX;

function cardSx(selected: boolean, cursor: LibraryCardProps['cursor']) {
  return {
    height: '100%',
    display: 'flex',
    flexDirection: 'column',
    bgcolor: 'var(--surface-container)',
    borderRadius: '20px',
    border: '1px solid var(--outline-variant)',
    overflow: 'hidden',
    cursor,
    position: 'relative',
    outline: selected ? '2px solid var(--primary)' : 'none',
    outlineOffset: selected ? -1 : 0,
    transition: `border-color 200ms ${EASE}, transform 200ms ${EASE}`,
    '&:hover': {
      borderColor: 'var(--outline)',
      transform: 'translateY(-2px)',
    },
    [`&:hover .${ACTIONS_CLASS}, &:focus-within .${ACTIONS_CLASS}`]: { opacity: 1, pointerEvents: 'auto' },
    [`&:hover .${CHECKBOX_CLASS}, &:focus-within .${CHECKBOX_CLASS}`]: { opacity: 1 },
  } as const;
}

export interface LibraryCardProps {
  /** `data-testid` of the card root. */
  testId: string;
  selected: boolean;
  /** Renders the hover-revealed selection checkbox when provided. */
  onToggleSelect?: () => void;
  /** Whole-card click (e.g. media selection mode); pair it with `cursor`. */
  onClick?: () => void;
  cursor?: 'pointer' | 'default';
  previewLayout: LibraryCardPreviewLayout;
  preview: ReactNode;
  /** Top-right corner badge (privacy lock, ALT marker, …). */
  badge?: ReactNode;
  /** Icon buttons for the hover-revealed tonal action strip; omit to hide the strip. */
  actions?: ReactNode;
  title: string;
  subtitle: ReactNode;
}

/**
 * M3 Expressive asset card shared by the media library and the documents
 * page: preview area with corner badge, hover-revealed selection checkbox and
 * tonal action strip, then a two-line caption.
 */
export function LibraryCard({
  testId,
  selected,
  onToggleSelect,
  onClick,
  cursor,
  previewLayout,
  preview,
  badge,
  actions,
  title,
  subtitle,
}: LibraryCardProps) {
  return (
    <Box data-testid={testId} onClick={onClick} sx={cardSx(selected, cursor)}>
      <Box sx={{ position: 'relative', ...PREVIEW_SX[previewLayout] }}>
        {preview}
        {badge && <Box sx={{ position: 'absolute', top: 10, right: 10 }}>{badge}</Box>}
        {onToggleSelect && <LibraryCardCheckbox checked={selected} onToggle={onToggleSelect} />}
        {actions && <LibraryCardActions>{actions}</LibraryCardActions>}
      </Box>
      <LibraryCardCaption title={title} subtitle={subtitle} />
    </Box>
  );
}

function LibraryCardCheckbox({ checked, onToggle }: { checked: boolean; onToggle: () => void }) {
  return (
    <Checkbox
      className={CHECKBOX_CLASS}
      checked={checked}
      onClick={(e) => e.stopPropagation()}
      onChange={() => onToggle()}
      size="small"
      sx={{
        position: 'absolute',
        top: 6,
        left: 6,
        opacity: checked ? 1 : 0,
        transition: `opacity 160ms ${EASE}`,
        bgcolor: 'rgba(255,255,255,0.9)',
        borderRadius: '8px',
        p: 0.25,
        '&:hover': { bgcolor: 'rgba(255,255,255,1)' },
      }}
    />
  );
}

function LibraryCardActions({ children }: { children: ReactNode }) {
  return (
    <Box
      className={ACTIONS_CLASS}
      onClick={(e) => e.stopPropagation()}
      sx={{
        position: 'absolute',
        left: 10,
        right: 10,
        bottom: 10,
        display: 'flex',
        gap: 0.5,
        justifyContent: 'flex-end',
        alignItems: 'center',
        p: 0.5,
        bgcolor: 'color-mix(in oklch, var(--surface-container) 85%, transparent)',
        color: 'var(--on-surface)',
        borderRadius: '14px',
        backdropFilter: 'blur(12px)',
        border: '1px solid var(--outline-variant)',
        opacity: 0,
        pointerEvents: 'none',
        transition: `opacity 180ms ${EASE}`,
      }}
    >
      {children}
    </Box>
  );
}

const captionLineSx = {
  display: 'block',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
} as const;

function LibraryCardCaption({ title, subtitle }: { title: string; subtitle: ReactNode }) {
  return (
    <Box sx={{ px: 2, py: 1.5, minWidth: 0 }}>
      <Box
        component="span"
        title={title}
        sx={{
          ...captionLineSx,
          fontSize: 14,
          fontWeight: 600,
          color: 'var(--on-surface)',
          fontVariationSettings: '"wght" 600, "opsz" 14',
        }}
      >
        {title}
      </Box>
      <Box
        component="span"
        sx={{ ...captionLineSx, mt: 0.25, fontSize: 12, color: 'var(--on-surface-variant)', minHeight: 16 }}
      >
        {subtitle}
      </Box>
    </Box>
  );
}
