import { useState } from 'react';
import { IconButton, Menu, MenuItem, ListItemIcon, ListItemText } from '@mui/material';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import BlockIcon from '@mui/icons-material/Block';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CancelIcon from '@mui/icons-material/Cancel';
import DeleteIcon from '@mui/icons-material/Delete';
import BarChartIcon from '@mui/icons-material/BarChart';
import type { ApiKeyListItem } from '@/types/api';
import { useTranslation } from 'react-i18next';

interface ApiKeyActionsMenuProps {
  apiKey: ApiKeyListItem;
  onBlock: (key: ApiKeyListItem) => void;
  onUnblock: (key: ApiKeyListItem) => void;
  onRevoke: (key: ApiKeyListItem) => void;
  onDelete: (key: ApiKeyListItem) => void;
  onViewUsage: (key: ApiKeyListItem) => void;
}

export default function ApiKeyActionsMenu({
  apiKey,
  onBlock,
  onUnblock,
  onRevoke,
  onDelete,
  onViewUsage,
}: ApiKeyActionsMenuProps) {
  const { t } = useTranslation();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const handleClose = () => setAnchorEl(null);

  return (
    <>
      <IconButton size="small" aria-label={t('common.table.actions')} onClick={(e) => setAnchorEl(e.currentTarget)}>
        <MoreVertIcon />
      </IconButton>
      <Menu anchorEl={anchorEl} open={!!anchorEl} onClose={handleClose}>
        <MenuItem onClick={() => { handleClose(); onViewUsage(apiKey); }}>
          <ListItemIcon><BarChartIcon fontSize="small" /></ListItemIcon>
          <ListItemText>{t('apiKeys.actionsMenu.viewUsage')}</ListItemText>
        </MenuItem>

        {apiKey.status === 'Active' && (
          <MenuItem onClick={() => { handleClose(); onBlock(apiKey); }}>
            <ListItemIcon><BlockIcon fontSize="small" /></ListItemIcon>
            <ListItemText>{t('apiKeys.actionsMenu.block')}</ListItemText>
          </MenuItem>
        )}

        {apiKey.status === 'Blocked' && (
          <MenuItem onClick={() => { handleClose(); onUnblock(apiKey); }}>
            <ListItemIcon><CheckCircleIcon fontSize="small" /></ListItemIcon>
            <ListItemText>{t('apiKeys.actionsMenu.unblock')}</ListItemText>
          </MenuItem>
        )}

        {apiKey.status !== 'Revoked' && (
          <MenuItem onClick={() => { handleClose(); onRevoke(apiKey); }}>
            <ListItemIcon><CancelIcon fontSize="small" color="warning" /></ListItemIcon>
            <ListItemText>{t('apiKeys.actionsMenu.revoke')}</ListItemText>
          </MenuItem>
        )}

        <MenuItem onClick={() => { handleClose(); onDelete(apiKey); }}>
          <ListItemIcon><DeleteIcon fontSize="small" color="error" /></ListItemIcon>
          <ListItemText sx={{ color: 'error.main' }}>{t('apiKeys.actionsMenu.delete')}</ListItemText>
        </MenuItem>
      </Menu>
    </>
  );
}
