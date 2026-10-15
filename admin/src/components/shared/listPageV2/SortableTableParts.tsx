import type { ReactNode } from 'react';
import type { DraggableSyntheticListeners } from '@dnd-kit/core';
import { Box, IconButton, TableCell, Tooltip, Typography } from '@mui/material';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import { useTranslation } from 'react-i18next';

/**
 * Leading grab-handle cell of a drag-to-reorder table row. Spread dnd-kit's
 * `useSortable().listeners` onto it; pair with `sortableContentTableSx` and
 * `DragPreviewCard` for the full sortable-table chrome.
 */
export function DragHandleCell({ listeners }: { listeners: DraggableSyntheticListeners }) {
  const { t } = useTranslation();
  const label = t('common.actions.dragToReorder');

  return (
    <TableCell sx={{ width: 48, px: 1 }}>
      <Tooltip title={label}>
        <IconButton
          size="small"
          sx={{ cursor: 'grab', '&:hover': { bgcolor: 'action.hover' } }}
          {...listeners}
          aria-label={label}
          data-testid="drag-handle"
        >
          <DragIndicatorIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    </TableCell>
  );
}

interface DragPreviewCardProps {
  children: ReactNode;
  /** Leading icon; defaults to the drag-handle glyph. */
  icon?: ReactNode;
  maxWidth?: number;
}

/** Floating card that follows the pointer inside a dnd-kit `DragOverlay`. */
export function DragPreviewCard({ children, icon, maxWidth }: DragPreviewCardProps) {
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        px: 2,
        py: 1,
        borderRadius: '14px',
        bgcolor: 'var(--surface-container-highest)',
        border: '1px solid var(--primary)',
        boxShadow: '0 12px 24px -6px rgb(0 0 0 / 0.45)',
        maxWidth,
        pointerEvents: 'none',
        color: 'var(--on-surface)',
      }}
    >
      {icon ?? <DragIndicatorIcon fontSize="small" sx={{ color: 'var(--primary)' }} />}
      <Typography variant="body2" noWrap sx={{ fontWeight: 600, fontVariationSettings: '"wght" 600, "opsz" 14' }}>
        {children}
      </Typography>
    </Box>
  );
}
