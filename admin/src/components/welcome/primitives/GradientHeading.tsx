import type { ElementType, ReactNode } from 'react';
import { Typography, type SxProps, type Theme } from '@mui/material';

interface GradientHeadingProps {
  /** Semantic level — `h1` for the hero, `h2` for sections. */
  component?: ElementType;
  /** A `--w-text-*` token, e.g. `var(--w-text-4xl)`. */
  fontSize?: string;
  id?: string;
  sx?: SxProps<Theme>;
  children: ReactNode;
}

/**
 * Display heading using the brand gradient-text motif (`--w-gradient-headline`)
 * on the Inter Display face. Shared by every Welcome section so the gradient is
 * defined once, not re-pasted per component.
 */
export default function GradientHeading({
  component = 'h2',
  fontSize = 'var(--w-text-4xl)',
  id,
  sx,
  children,
}: GradientHeadingProps) {
  return (
    <Typography
      component={component}
      id={id}
      sx={{
        fontFamily: 'var(--w-font-display)',
        fontWeight: 800,
        // Reset the inherited MUI variant axis pin so font-weight drives the
        // variable-font weight (otherwise the body1 variant forces wght 400).
        fontVariationSettings: 'normal',
        fontSize,
        letterSpacing: 'var(--w-tracking-tight)',
        lineHeight: 'var(--w-leading-tight)',
        backgroundImage: 'var(--w-gradient-headline)',
        backgroundClip: 'text',
        WebkitBackgroundClip: 'text',
        color: 'transparent',
        // Fallback so the heading is never invisible if clip is unsupported.
        '@supports not (background-clip: text)': { color: 'var(--w-fg)' },
        ...sx,
      }}
    >
      {children}
    </Typography>
  );
}
