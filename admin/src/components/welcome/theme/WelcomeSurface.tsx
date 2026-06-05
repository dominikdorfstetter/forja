import type { ReactNode } from 'react';
import { Box, GlobalStyles } from '@mui/material';
import { buildWelcomeTokenCss } from './welcomeTokens';

interface WelcomeSurfaceProps {
  children: ReactNode;
  /** Accessible name for the surrounding landmark. */
  'aria-label'?: string;
}

/**
 * Root wrapper for the signed-out marketing surface. Injects the `--w-*` token
 * set scoped to `.welcome-surface` and owns the full-viewport scroll container,
 * so the Welcome page is themed by `prefers-color-scheme` independently of the
 * dashboard's M3 theme. First paint uses the correct palette (no FOUC) because
 * the tokens carry their own `color-scheme` and light defaults.
 */
export default function WelcomeSurface({
  children,
  'aria-label': ariaLabel,
}: WelcomeSurfaceProps) {
  return (
    <>
      <GlobalStyles styles={buildWelcomeTokenCss()} />
      <Box
        component="main"
        aria-label={ariaLabel}
        className="welcome-surface"
        sx={{
          minHeight: '100vh',
          height: '100vh',
          overflowY: 'auto',
          overflowX: 'hidden',
          position: 'relative',
        }}
      >
        {children}
      </Box>
    </>
  );
}
