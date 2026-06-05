import { useState } from 'react';
import { IconButton, Menu, MenuItem, ListItemIcon, ListItemText, Divider } from '@mui/material';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import { useTranslation } from 'react-i18next';
import type { CvEntryResponse } from '@/types/api';

interface CvEntryActionsMenuProps {
  entry: CvEntryResponse;
  canWrite: boolean;
  isAdmin: boolean;
  onEdit: (entry: CvEntryResponse) => void;
  onDelete: (entry: CvEntryResponse) => void;
}

export default function CvEntryActionsMenu({
  entry,
  canWrite,
  isAdmin,
  onEdit,
  onDelete,
}: CvEntryActionsMenuProps) {
  const { t } = useTranslation();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const handleClose = () => setAnchorEl(null);

  return (
    <>
      <IconButton size="small" aria-label={t('common.table.actions')} aria-haspopup="menu" aria-expanded={!!anchorEl} data-testid="cv-entry-actions.btn.menu" onClick={(e) => setAnchorEl(e.currentTarget)}>
        <MoreVertIcon />
      </IconButton>
      <Menu anchorEl={anchorEl} open={!!anchorEl} onClose={handleClose}>
        {canWrite && (
          <MenuItem onClick={() => { handleClose(); onEdit(entry); }}>
            <ListItemIcon><EditIcon fontSize="small" /></ListItemIcon>
            <ListItemText>{t('common.actions.edit')}</ListItemText>
          </MenuItem>
        )}

        {isAdmin && <Divider />}

        {isAdmin && (
          <MenuItem onClick={() => { handleClose(); onDelete(entry); }}>
            <ListItemIcon><DeleteIcon fontSize="small" color="error" /></ListItemIcon>
            <ListItemText sx={{ color: 'error.main' }}>{t('common.actions.delete')}</ListItemText>
          </MenuItem>
        )}
      </Menu>
    </>
  );
}
