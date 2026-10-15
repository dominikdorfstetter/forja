import { Box } from '@mui/material';
import { Icon } from '@/components/design-system';

export type DashboardCardTone = 'primary' | 'tertiary' | 'warn' | 'err';

const CARD_PAINT: Record<DashboardCardTone, { bg: string; fg: string }> = {
  primary: { bg: 'var(--primary-container)', fg: 'var(--on-primary-container)' },
  tertiary: { bg: 'var(--tertiary-container)', fg: 'var(--on-tertiary-container)' },
  warn: { bg: 'var(--warn-container)', fg: 'var(--on-warn-container)' },
  err: { bg: 'color-mix(in oklch, var(--err) 18%, transparent)', fg: 'var(--err)' },
};

/**
 * Tokenised card with a tonal icon tile + title row and arbitrary
 * content slot. Replaces MUI Paper + Stack + Typography anchors to
 * make every dashboard card look the same.
 */
export default function DashboardCard({
  icon,
  title,
  tone,
  action,
  children,
  'data-testid': testId,
}: {
  icon: string;
  title: string;
  tone?: DashboardCardTone;
  action?: React.ReactNode;
  children: React.ReactNode;
  'data-testid'?: string;
}) {
  const paint = CARD_PAINT[tone ?? 'primary'];
  return (
    <Box
      data-testid={testId}
      sx={{
        height: '100%',
        p: 3,
        bgcolor: 'var(--surface-container)',
        border: '1px solid var(--outline-variant)',
        borderRadius: '20px',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, mb: 2 }}>
        <Box
          aria-hidden="true"
          sx={{
            width: 36,
            height: 36,
            borderRadius: '10px',
            bgcolor: paint.bg,
            color: paint.fg,
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Icon name={icon} size={20} />
        </Box>
        <Box
          component="h2"
          sx={{
            m: 0,
            flex: 1,
            fontSize: 16,
            fontWeight: 600,
            color: 'var(--on-surface)',
            fontVariationSettings: '"wght" 600, "opsz" 16',
          }}
        >
          {title}
        </Box>
        {action}
      </Box>
      {children}
    </Box>
  );
}
