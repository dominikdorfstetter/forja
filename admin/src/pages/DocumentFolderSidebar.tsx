import { Paper, Typography, Divider } from '@mui/material';
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
    <Paper
      variant="outlined"
      sx={{
        width: 260,
        minWidth: 260,
        flexShrink: 0,
        alignSelf: 'flex-start',
        py: 1,
      }}
    >
      <Typography variant="subtitle2" sx={{ px: 2, py: 1 }} color="text.secondary">
        {t('media.folders')}
      </Typography>
      <Divider />
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
    </Paper>
  );
}
