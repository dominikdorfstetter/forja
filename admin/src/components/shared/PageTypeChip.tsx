import { Box } from '@mui/material';
import { useTranslation } from 'react-i18next';
import type { PageType } from '@/types/api';

interface Paint {
  bg: string;
  fg: string;
}

/**
 * Tonal page-type pill. Each PageType maps to a container / on-container
 * pair from the M3 token set so the chip palette adapts per flavor —
 * identical visual grammar to StatusChip and the system dashboard
 * TonalPill. Previously used hardcoded Material-style hex colours that
 * only shipped contrast for a neutral MUI theme.
 */
const TYPE_PAINT: Record<PageType, Paint> = {
  Static: { bg: 'var(--primary-container)', fg: 'var(--on-primary-container)' },
  Landing: { bg: 'var(--tertiary-container)', fg: 'var(--on-tertiary-container)' },
  Contact: { bg: 'var(--warn-container)', fg: 'var(--on-warn-container)' },
  BlogIndex: {
    bg: 'color-mix(in oklch, var(--err) 18%, transparent)',
    fg: 'var(--err)',
  },
  Custom: {
    bg: 'color-mix(in oklch, var(--info) 18%, transparent)',
    fg: 'var(--info)',
  },
};

const labelKeys: Record<PageType, string> = {
  Static: 'pages.wizard.types.static',
  Landing: 'pages.wizard.types.landing',
  Contact: 'pages.wizard.types.contact',
  BlogIndex: 'pages.wizard.types.blogIndex',
  Custom: 'pages.wizard.types.custom',
};

interface PageTypeChipProps {
  value: PageType | string;
  size?: 'small' | 'medium';
}

export default function PageTypeChip({ value, size = 'small' }: PageTypeChipProps) {
  const { t } = useTranslation();
  const paint = TYPE_PAINT[value as PageType];
  const label = labelKeys[value as PageType]
    ? t(labelKeys[value as PageType])
    : value;
  const height = size === 'medium' ? 26 : 22;
  const fontSize = size === 'medium' ? 12 : 11;

  return (
    <Box
      component="span"
      data-testid="page-type-chip"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        px: 1.25,
        height,
        borderRadius: '999px',
        bgcolor: paint?.bg ?? 'transparent',
        color: paint?.fg ?? 'var(--on-surface-variant)',
        border: paint ? 'none' : '1px solid var(--outline-variant)',
        fontSize,
        fontWeight: 600,
        letterSpacing: 0.3,
        fontVariationSettings: `"wght" 600, "opsz" ${fontSize}`,
        whiteSpace: 'nowrap',
      }}
    >
      {label}
    </Box>
  );
}
