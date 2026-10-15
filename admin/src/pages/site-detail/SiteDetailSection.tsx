import type { ReactNode } from 'react';
import { Box, Divider, Typography } from '@mui/material';

interface SiteDetailSectionProps {
  title: string;
  /** Bottom margin (theme spacing) when another section follows in the column. */
  mb?: number;
  children: ReactNode;
}

/** Tonal card with an h2 title and divider — the site detail page's section frame. */
export default function SiteDetailSection({ title, mb, children }: SiteDetailSectionProps) {
  return (
    <Box
      sx={{
        p: 3,
        mb,
        borderRadius: '16px',
        bgcolor: 'var(--surface-container-low)',
        border: '1px solid var(--outline-variant)',
      }}
    >
      <Typography
        component="h2"
        sx={{
          fontSize: 16,
          fontWeight: 700,
          color: 'var(--on-surface)',
          fontVariationSettings: '"wght" 700, "opsz" 16',
          mb: 2,
        }}
      >
        {title}
      </Typography>
      <Divider sx={{ borderColor: 'var(--outline-variant)', mb: 2 }} />
      {children}
    </Box>
  );
}
