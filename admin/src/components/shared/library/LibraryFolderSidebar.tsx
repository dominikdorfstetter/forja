import type { ComponentProps } from 'react';
import { Box, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import FolderTree from '@/components/shared/FolderTree';

export type LibraryFolderSidebarProps = Omit<ComponentProps<typeof FolderTree>, 'droppable'>;

/**
 * Side panel holding the folder tree of the media library / documents page.
 * Writers can also drop cards onto folders.
 */
export function LibraryFolderSidebar(props: LibraryFolderSidebarProps) {
  const { t } = useTranslation();

  return (
    <Box
      sx={{
        width: 260,
        minWidth: 260,
        flexShrink: 0,
        alignSelf: 'flex-start',
        bgcolor: 'var(--surface-container)',
        border: '1px solid var(--outline-variant)',
        borderRadius: '20px',
        overflow: 'hidden',
        py: 1,
      }}
    >
      <Typography
        variant="subtitle2"
        sx={{
          px: 2,
          py: 1,
          color: 'var(--on-surface-variant)',
          fontVariationSettings: '"wght" 600, "opsz" 14',
          letterSpacing: 0.5,
          textTransform: 'uppercase',
          fontSize: 11,
        }}
      >
        {t('media.folders')}
      </Typography>
      <FolderTree {...props} droppable={props.canWrite} />
    </Box>
  );
}
