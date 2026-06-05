import type { ReactNode } from 'react';
import { Box, Container, type SxProps, type Theme } from '@mui/material';

interface WelcomeSectionProps {
  /** Heading element id this section is labelled by (region landmark). */
  labelledBy?: string;
  /** Subtle elevated background for visual rhythm between sections. */
  alt?: boolean;
  maxWidth?: 'md' | 'lg' | 'xl';
  'data-testid'?: string;
  sx?: SxProps<Theme>;
  children: ReactNode;
}

/**
 * Consistent `<section>` rhythm for the Welcome surface: vertical padding,
 * optional alternating surface background, centred container. Becomes a labelled
 * region landmark when `labelledBy` references its heading. Shared by all
 * Welcome sections so spacing/landmark wiring lives in one place.
 */
export default function WelcomeSection({
  labelledBy,
  alt = false,
  maxWidth = 'lg',
  'data-testid': testId,
  sx,
  children,
}: WelcomeSectionProps) {
  return (
    <Box
      component="section"
      aria-labelledby={labelledBy}
      data-testid={testId}
      sx={{
        position: 'relative',
        zIndex: 1,
        py: { xs: 8, md: 14 },
        backgroundColor: alt ? 'var(--w-bg-elevated)' : 'transparent',
        ...sx,
      }}
    >
      <Container maxWidth={maxWidth} sx={{ px: { xs: 3, md: 6 } }}>
        {children}
      </Container>
    </Box>
  );
}
