import type { ReactNode } from 'react';
import { Box, Typography, type SxProps, type Theme } from '@mui/material';

interface MediaDetailListProps<T> {
  items: T[] | undefined;
  getKey: (item: T) => string;
  renderRow: (item: T) => ReactNode;
  /** Layout of each row; dividers between rows are added here. */
  rowSx: SxProps<Theme>;
  emptyLabel: string;
}

/** Bordered card of divided rows (variants, usage), or an empty note. */
export default function MediaDetailList<T>({ items, getKey, renderRow, rowSx, emptyLabel }: MediaDetailListProps<T>) {
  if (!items || items.length === 0) {
    return (
      <Box>
        <Typography sx={{ color: 'var(--on-surface-variant)' }} variant="body2">
          {emptyLabel}
        </Typography>
      </Box>
    );
  }

  return (
    <Box>
      <Box
        sx={{
          bgcolor: 'var(--surface-container)',
          border: '1px solid var(--outline-variant)',
          borderRadius: '16px',
          overflow: 'hidden',
        }}
      >
        {items.map((item, i) => (
          <Box
            key={getKey(item)}
            sx={[
              { borderBottom: i === items.length - 1 ? 'none' : '1px solid var(--outline-variant)' },
              ...(Array.isArray(rowSx) ? rowSx : [rowSx]),
            ]}
          >
            {renderRow(item)}
          </Box>
        ))}
      </Box>
    </Box>
  );
}
