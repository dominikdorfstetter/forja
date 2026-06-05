import { useState } from 'react';
import { IconButton, Menu, MenuItem, ListItemIcon, ListItemText, Divider } from '@mui/material';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import EditIcon from '@mui/icons-material/Edit';
import PublishIcon from '@mui/icons-material/Publish';
import UnpublishedIcon from '@mui/icons-material/Unpublished';
import ArchiveIcon from '@mui/icons-material/Archive';
import UnarchiveIcon from '@mui/icons-material/Unarchive';
import DeleteIcon from '@mui/icons-material/Delete';
import { useTranslation } from 'react-i18next';
import type { ProjectResponse } from '@/types/api';

interface ProjectActionsMenuProps {
  project: ProjectResponse;
  canWrite: boolean;
  isAdmin: boolean;
  onEdit: (project: ProjectResponse) => void;
  onPublish: (project: ProjectResponse) => void;
  onUnpublish: (project: ProjectResponse) => void;
  onDelete: (project: ProjectResponse) => void;
  onArchive?: (project: ProjectResponse) => void;
  onRestore?: (project: ProjectResponse) => void;
}

export default function ProjectActionsMenu({
  project,
  canWrite,
  isAdmin,
  onEdit,
  onPublish,
  onUnpublish,
  onDelete,
  onArchive,
  onRestore,
}: ProjectActionsMenuProps) {
  const { t } = useTranslation();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const handleClose = () => setAnchorEl(null);

  const canPublish = canWrite && (project.status === 'Draft' || project.status === 'Scheduled');
  const canUnpublish = canWrite && (project.status === 'Published' || project.status === 'Scheduled');
  const canArchive = canWrite && (project.status === 'Published' || project.status === 'Scheduled') && onArchive;
  const canRestore = canWrite && project.status === 'Archived' && onRestore;

  return (
    <>
      <IconButton size="small" aria-label={t('common.table.actions')} aria-haspopup="menu" aria-expanded={!!anchorEl} data-testid="project-actions.btn.menu" onClick={(e) => setAnchorEl(e.currentTarget)}>
        <MoreVertIcon />
      </IconButton>
      <Menu anchorEl={anchorEl} open={!!anchorEl} onClose={handleClose}>
        {canWrite && (
          <MenuItem onClick={() => { handleClose(); onEdit(project); }}>
            <ListItemIcon><EditIcon fontSize="small" /></ListItemIcon>
            <ListItemText>{t('common.actions.edit')}</ListItemText>
          </MenuItem>
        )}

        {canPublish && (
          <MenuItem onClick={() => { handleClose(); onPublish(project); }}>
            <ListItemIcon><PublishIcon fontSize="small" /></ListItemIcon>
            <ListItemText>{t('bulk.publish')}</ListItemText>
          </MenuItem>
        )}

        {canUnpublish && (
          <MenuItem onClick={() => { handleClose(); onUnpublish(project); }}>
            <ListItemIcon><UnpublishedIcon fontSize="small" /></ListItemIcon>
            <ListItemText>{t('bulk.unpublish')}</ListItemText>
          </MenuItem>
        )}

        {canArchive && (
          <MenuItem onClick={() => { handleClose(); onArchive(project); }}>
            <ListItemIcon><ArchiveIcon fontSize="small" color="warning" /></ListItemIcon>
            <ListItemText>{t('bulk.archive')}</ListItemText>
          </MenuItem>
        )}

        {canRestore && (
          <MenuItem onClick={() => { handleClose(); onRestore(project); }}>
            <ListItemIcon><UnarchiveIcon fontSize="small" /></ListItemIcon>
            <ListItemText>{t('bulk.restore')}</ListItemText>
          </MenuItem>
        )}

        {isAdmin && <Divider />}

        {isAdmin && (
          <MenuItem onClick={() => { handleClose(); onDelete(project); }}>
            <ListItemIcon><DeleteIcon fontSize="small" color="error" /></ListItemIcon>
            <ListItemText sx={{ color: 'error.main' }}>{t('common.actions.delete')}</ListItemText>
          </MenuItem>
        )}
      </Menu>
    </>
  );
}
