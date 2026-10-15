import type { ReactNode } from 'react';
import { Box, ButtonBase, LinearProgress, Typography } from '@mui/material';
import { Icon } from '@/components/design-system';

interface StatCardProps {
  icon: string;
  label: string;
  primary: ReactNode;
  secondary?: ReactNode;
  progress?: number;
  onClick?: () => void;
  testId?: string;
}

/**
 * Click-through stat card for the site detail dashboard. Each card
 * deep-links to the management surface relevant to the number it
 * shows — members count → /site-settings/members, storage →
 * /site-settings/content, etc. — so the detail page reads as a
 * jumping-off point rather than a static info card.
 */
export default function StatCard({ icon, label, primary, secondary, progress, onClick, testId }: StatCardProps) {
  const sharedSx = {
    width: '100%',
    textAlign: 'left' as const,
    display: 'block',
    p: 2.25,
    borderRadius: '16px',
    bgcolor: 'var(--surface-container-low)',
    border: '1px solid var(--outline-variant)',
    transition: 'background-color 140ms, border-color 140ms, transform 140ms',
    ...(onClick
      ? {
          cursor: 'pointer',
          '&:hover': {
            bgcolor: 'var(--surface-container)',
            borderColor: 'color-mix(in srgb, var(--primary) 45%, var(--outline-variant))',
            transform: 'translateY(-1px)',
          },
          '&:focus-visible': { outline: '2px solid var(--primary)', outlineOffset: 2 },
        }
      : {}),
  };

  const body = (
    <>
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.25, mb: 1.25 }}>
        <Box
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 32,
            height: 32,
            borderRadius: '10px',
            bgcolor: 'var(--primary-container)',
            color: 'var(--on-primary-container)',
          }}
        >
          <Icon name={icon} size={18} />
        </Box>
        <Typography
          component="span"
          sx={{
            fontSize: 11,
            fontWeight: 600,
            letterSpacing: 0.6,
            color: 'var(--on-surface-variant)',
            textTransform: 'uppercase',
            fontVariationSettings: '"wght" 600, "opsz" 11',
          }}
        >
          {label}
        </Typography>
      </Box>
      <Typography
        component="div"
        sx={{
          fontSize: 24,
          fontWeight: 700,
          color: 'var(--on-surface)',
          fontVariationSettings: '"wght" 700, "opsz" 24',
          letterSpacing: -0.3,
          lineHeight: 1.15,
          minHeight: 28,
        }}
      >
        {primary}
      </Typography>
      {progress != null && (
        <Box sx={{ mt: 1 }}>
          <LinearProgress
            variant="determinate"
            value={Math.min(100, Math.max(0, progress))}
            sx={{
              height: 6,
              borderRadius: 999,
              bgcolor: 'var(--surface-container-highest)',
              '& .MuiLinearProgress-bar': {
                bgcolor: progress > 85 ? 'var(--err)' : 'var(--primary)',
                borderRadius: 999,
              },
            }}
          />
        </Box>
      )}
      {secondary && (
        <Typography
          component="div"
          sx={{
            mt: 0.75,
            fontSize: 12,
            color: 'var(--on-surface-variant)',
            fontVariationSettings: '"wght" 500, "opsz" 12',
          }}
        >
          {secondary}
        </Typography>
      )}
    </>
  );

  if (onClick) {
    return (
      <ButtonBase focusRipple onClick={onClick} data-testid={testId} sx={sharedSx}>
        {body}
      </ButtonBase>
    );
  }
  return (
    <Box data-testid={testId} sx={sharedSx}>
      {body}
    </Box>
  );
}
