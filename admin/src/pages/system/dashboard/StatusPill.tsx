import { Box } from '@mui/material';

export type StatusPillTone = 'tertiary' | 'warn' | 'err' | 'neutral';

const PILL_PAINT: Record<StatusPillTone, { bg: string; fg: string; border?: string }> = {
  tertiary: { bg: 'var(--tertiary-container)', fg: 'var(--on-tertiary-container)' },
  warn: { bg: 'var(--warn-container)', fg: 'var(--on-warn-container)' },
  err: { bg: 'color-mix(in oklch, var(--err) 18%, transparent)', fg: 'var(--err)' },
  neutral: {
    bg: 'transparent',
    fg: 'var(--on-surface-variant)',
    border: '1px solid var(--outline-variant)',
  },
};

/**
 * Tonal status pill matching the chip vocabulary used in legal /
 * navigation / system sites tables. Three tones cover every status
 * we surface on the dashboard: healthy (tertiary), degraded (warn),
 * unhealthy (err).
 */
export default function StatusPill({ label, tone }: { label: string; tone: StatusPillTone }) {
  const paint = PILL_PAINT[tone];
  return (
    <Box
      component="span"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        px: 1.25,
        height: 22,
        borderRadius: '999px',
        bgcolor: paint.bg,
        color: paint.fg,
        border: paint.border ?? 'none',
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: 0.3,
        fontVariationSettings: '"wght" 600, "opsz" 11',
        textTransform: 'capitalize',
      }}
    >
      {label}
    </Box>
  );
}
