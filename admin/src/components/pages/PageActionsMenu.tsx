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
import type { PageListItem } from '@/types/api';

interface PageActionsMenuProps {
  page: PageListItem;
  canWrite: boolean;
  isAdmin: boolean;
  onView: (page: PageListItem) => void;
  onClone: (page: PageListItem) => void;
  onPublish: (page: PageListItem) => void;
  onUnpublish: (page: PageListItem) => void;
  onDelete: (page: PageListItem) => void;
  onArchive?: (page: PageListItem) => void;
  onRestore?: (page: PageListItem) => void;
  cloneDisabled?: boolean;
}

export default function PageActionsMenu({
  page,
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
}: PageActionsMenuProps) {
  const { t } = useTranslation();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const handleClose = () => setAnchorEl(null);

  const canPublishPage = canWrite && (page.status === 'Draft' || page.status === 'Scheduled');
  const canUnpublishPage = canWrite && (page.status === 'Published' || page.status === 'Scheduled');
  const canArchivePage = canWrite && (page.status === 'Published' || page.status === 'Scheduled') && onArchive;
  const canRestorePage = canWrite && page.status === 'Archived' && onRestore;

  return (
    <>
      <IconButton size="small" aria-label={t('common.table.actions')} aria-haspopup="menu" aria-expanded={!!anchorEl} data-testid="page-actions.btn.menu" onClick={(e) => setAnchorEl(e.currentTarget)}>
        <MoreVertIcon />
      </IconButton>
      <Menu anchorEl={anchorEl} open={!!anchorEl} onClose={handleClose}>
        <MenuItem onClick={() => { handleClose(); onView(page); }}>
          <ListItemIcon><VisibilityIcon fontSize="small" /></ListItemIcon>
          <ListItemText>{t('common.actions.viewDetails')}</ListItemText>
        </MenuItem>

        {canPublishPage && (
          <MenuItem onClick={() => { handleClose(); onPublish(page); }}>
            <ListItemIcon><PublishIcon fontSize="small" /></ListItemIcon>
            <ListItemText>{t('bulk.publish')}</ListItemText>
          </MenuItem>
        )}

        {canUnpublishPage && (
          <MenuItem onClick={() => { handleClose(); onUnpublish(page); }}>
            <ListItemIcon><UnpublishedIcon fontSize="small" /></ListItemIcon>
            <ListItemText>{t('bulk.unpublish')}</ListItemText>
          </MenuItem>
        )}

        {canWrite && (
          <MenuItem onClick={() => { handleClose(); onClone(page); }} disabled={cloneDisabled}>
            <ListItemIcon><ContentCopyIcon fontSize="small" /></ListItemIcon>
            <ListItemText>{t('common.actions.clone')}</ListItemText>
          </MenuItem>
        )}

        {canArchivePage && (
          <MenuItem onClick={() => { handleClose(); onArchive(page); }}>
            <ListItemIcon><ArchiveIcon fontSize="small" color="warning" /></ListItemIcon>
            <ListItemText>{t('bulk.archive')}</ListItemText>
          </MenuItem>
        )}

        {canRestorePage && (
          <MenuItem onClick={() => { handleClose(); onRestore(page); }}>
            <ListItemIcon><UnarchiveIcon fontSize="small" /></ListItemIcon>
            <ListItemText>{t('bulk.restore')}</ListItemText>
          </MenuItem>
        )}

        {isAdmin && <Divider />}

        {isAdmin && (
          <MenuItem onClick={() => { handleClose(); onDelete(page); }}>
            <ListItemIcon><DeleteIcon fontSize="small" color="error" /></ListItemIcon>
            <ListItemText sx={{ color: 'error.main' }}>{t('common.actions.delete')}</ListItemText>
          </MenuItem>
        )}
      </Menu>
    </>
  );
}
