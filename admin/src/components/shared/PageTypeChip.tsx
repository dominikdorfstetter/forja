import { Chip } from '@mui/material';
import { useTranslation } from 'react-i18next';
import type { PageType } from '@/types/api';

const typeStyles: Record<PageType, { bg: string; color: string }> = {
  Static: { bg: '#e8eaf6', color: '#3949ab' },
  Landing: { bg: '#e0f2f1', color: '#00796b' },
  Contact: { bg: '#fff3e0', color: '#bf360c' },
  BlogIndex: { bg: '#fce4ec', color: '#c62828' },
  Custom: { bg: '#f3e5f5', color: '#7b1fa2' },
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
  const style = typeStyles[value as PageType];
  const label = labelKeys[value as PageType]
    ? t(labelKeys[value as PageType])
    : value;

  return (
    <Chip
      label={label}
      size={size}
      data-testid="page-type-chip"
      sx={
        style
          ? { bgcolor: style.bg, color: style.color, fontWeight: 500 }
          : undefined
      }
    />
  );
}
