import { Box, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { M3Button } from '@/components/design-system';

interface LibraryBulkBarProps {
  count: number;
  onDelete: () => void;
  onClear: () => void;
  testId: string;
}

/** Floating pill with bulk delete / clear while library cards are selected; renders nothing at zero. */
export function LibraryBulkBar({ count, onDelete, onClear, testId }: LibraryBulkBarProps) {
  const { t } = useTranslation();

  if (count === 0) return null;

  return (
    <Box
      data-testid={testId}
      sx={{
        position: 'fixed',
        bottom: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 1300,
        display: 'flex',
        alignItems: 'center',
        gap: 1.5,
        px: 2,
        py: 1,
        borderRadius: '999px',
        bgcolor: 'var(--surface-container-highest)',
        border: '1px solid var(--outline-variant)',
        boxShadow: '0 8px 24px -6px rgb(0 0 0 / 0.35)',
        backdropFilter: 'blur(12px)',
        animation: 'var(--motion-fade-in-up)',
      }}
    >
      <Typography
        variant="body2"
        sx={{
          fontWeight: 600,
          color: 'var(--on-surface)',
          px: 1,
          fontVariationSettings: '"wght" 600, "opsz" 14',
        }}
      >
        {t('bulk.selectedCount', { count })}
      </Typography>
      <M3Button variant="filled" size="sm" icon="delete" danger onClick={onDelete}>
        {t('common.actions.delete')}
      </M3Button>
      <M3Button variant="ghost" size="sm" onClick={onClear}>
        {t('bulk.clearSelection')}
      </M3Button>
    </Box>
  );
}
