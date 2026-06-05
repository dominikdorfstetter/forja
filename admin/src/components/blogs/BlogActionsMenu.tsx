import { useState } from 'react';
import { IconButton, Menu, MenuItem, ListItemIcon, ListItemText, Divider } from '@mui/material';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import VisibilityIcon from '@mui/icons-material/Visibility';
import PublishIcon from '@mui/icons-material/Publish';
import UnpublishedIcon from '@mui/icons-material/Unpublished';
import ArchiveIcon from '@mui/icons-material/Archive';
import UnarchiveIcon from '@mui/icons-material/Unarchive';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DeleteIcon from '@mui/icons-material/Delete';
import { useTranslation } from 'react-i18next';
import type { BlogListItem } from '@/types/api';

interface BlogActionsMenuProps {
  blog: BlogListItem;
  canWrite: boolean;
  isAdmin: boolean;
  onView: (blog: BlogListItem) => void;
  onClone: (blog: BlogListItem) => void;
  onPublish: (blog: BlogListItem) => void;
  onUnpublish: (blog: BlogListItem) => void;
  onDelete: (blog: BlogListItem) => void;
  onArchive?: (blog: BlogListItem) => void;
  onRestore?: (blog: BlogListItem) => void;
  cloneDisabled?: boolean;
}

export default function BlogActionsMenu({
  blog,
  canWrite,
  isAdmin,
  onView,
  onClone,
  onPublish,
  onUnpublish,
  onDelete,
  onArchive,
  onRestore,
  cloneDisabled,
}: BlogActionsMenuProps) {
  const { t } = useTranslation();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const handleClose = () => setAnchorEl(null);

  const canPublish = canWrite && (blog.status === 'Draft' || blog.status === 'Scheduled');
  const canUnpublish = canWrite && (blog.status === 'Published' || blog.status === 'Scheduled');
  const canArchive = canWrite && (blog.status === 'Published' || blog.status === 'Scheduled') && onArchive;
  const canRestore = canWrite && blog.status === 'Archived' && onRestore;

  return (
    <>
      <IconButton size="small" aria-label={t('common.table.actions')} aria-haspopup="menu" aria-expanded={!!anchorEl} data-testid="blog-actions.btn.menu" onClick={(e) => setAnchorEl(e.currentTarget)}>
        <MoreVertIcon />
      </IconButton>
      <Menu anchorEl={anchorEl} open={!!anchorEl} onClose={handleClose}>
        <MenuItem onClick={() => { handleClose(); onView(blog); }}>
          <ListItemIcon><VisibilityIcon fontSize="small" /></ListItemIcon>
          <ListItemText>{t('common.actions.viewDetails')}</ListItemText>
        </MenuItem>

        {canPublish && (
          <MenuItem onClick={() => { handleClose(); onPublish(blog); }}>
            <ListItemIcon><PublishIcon fontSize="small" /></ListItemIcon>
            <ListItemText>{t('bulk.publish')}</ListItemText>
          </MenuItem>
        )}

        {canUnpublish && (
          <MenuItem onClick={() => { handleClose(); onUnpublish(blog); }}>
            <ListItemIcon><UnpublishedIcon fontSize="small" /></ListItemIcon>
            <ListItemText>{t('bulk.unpublish')}</ListItemText>
          </MenuItem>
        )}

        {canWrite && (
          <MenuItem onClick={() => { handleClose(); onClone(blog); }} disabled={cloneDisabled}>
            <ListItemIcon><ContentCopyIcon fontSize="small" /></ListItemIcon>
            <ListItemText>{t('common.actions.clone')}</ListItemText>
          </MenuItem>
        )}

        {canArchive && (
          <MenuItem onClick={() => { handleClose(); onArchive(blog); }}>
            <ListItemIcon><ArchiveIcon fontSize="small" color="warning" /></ListItemIcon>
            <ListItemText>{t('bulk.archive')}</ListItemText>
          </MenuItem>
        )}

        {canRestore && (
          <MenuItem onClick={() => { handleClose(); onRestore(blog); }}>
            <ListItemIcon><UnarchiveIcon fontSize="small" /></ListItemIcon>
            <ListItemText>{t('bulk.restore')}</ListItemText>
          </MenuItem>
        )}

        {isAdmin && <Divider />}

        {isAdmin && (
          <MenuItem onClick={() => { handleClose(); onDelete(blog); }}>
            <ListItemIcon><DeleteIcon fontSize="small" color="error" /></ListItemIcon>
            <ListItemText sx={{ color: 'error.main' }}>{t('common.actions.delete')}</ListItemText>
          </MenuItem>
        )}
      </Menu>
    </>
  );
}
