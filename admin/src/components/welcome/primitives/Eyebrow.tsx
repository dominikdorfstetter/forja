import type { ReactNode } from 'react';
import { Box, Typography, type SxProps, type Theme } from '@mui/material';

interface EyebrowProps {
  children: ReactNode;
  sx?: SxProps<Theme>;
}

/**
 * The teal kicker label that opens every section: a short rule followed by an
 * uppercase, wide-tracked word in the primary hue. Defined once so the hero and
 * all section headers share an identical kicker (no per-section re-styling).
 */
export default function Eyebrow({ children, sx }: EyebrowProps) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, ...sx }}>
      <Box aria-hidden sx={{ width: 28, height: '2px', backgroundColor: 'var(--w-primary)' }} />
      <Typography
        component="span"
        sx={{
          fontSize: 'var(--w-text-sm)',
          fontWeight: 600,
          fontVariationSettings: 'normal',
          letterSpacing: 'var(--w-tracking-wider)',
          textTransform: 'uppercase',
          color: 'var(--w-primary)',
        }}
      >
        {children}
      </Typography>
    </Box>
  );
}
