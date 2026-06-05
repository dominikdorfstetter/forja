import { Box, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import FolderTree from '@/components/shared/FolderTree';
import type { DocumentFolder } from '@/types/api';

interface DocumentFolderSidebarProps {
  folders: DocumentFolder[];
  selectedFolderId: string | null;
  onSelectFolder: (id: string | null) => void;
  onCreateFolder: (name: string, parentId?: string) => void;
  onRenameFolder: (id: string, name: string) => void;
  onDeleteFolder: (id: string) => void;
  canWrite: boolean;
}

export default function DocumentFolderSidebar({
  folders,
  selectedFolderId,
  onSelectFolder,
  onCreateFolder,
  onRenameFolder,
  onDeleteFolder,
  canWrite,
}: DocumentFolderSidebarProps) {
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
      <FolderTree
        folders={folders}
        selectedFolderId={selectedFolderId}
        onSelectFolder={onSelectFolder}
        onCreateFolder={onCreateFolder}
        onRenameFolder={onRenameFolder}
        onDeleteFolder={onDeleteFolder}
        canWrite={canWrite}
        droppable={canWrite}
      />
    </Box>
  );
}
