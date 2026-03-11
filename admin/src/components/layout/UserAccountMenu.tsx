import { useState } from 'react';
import { useNavigate } from 'react-router';
import IconButton from '@mui/material/IconButton';
import Divider from '@mui/material/Divider';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import WebIcon from '@mui/icons-material/Web';
import LanguageIcon from '@mui/icons-material/Language';
import LogoutIcon from '@mui/icons-material/Logout';
import PersonIcon from '@mui/icons-material/Person';
import IntegrationInstructionsIcon from '@mui/icons-material/IntegrationInstructions';
import { Avatar, Menu, MenuItem, Tooltip } from '@mui/material';
import Box from '@mui/material/Box';
import { useTranslation } from 'react-i18next';

interface UserAccountMenuProps {
  isAdmin: boolean;
  userFullName: string | null;
  userImageUrl: string | null;
  onLogout: () => void;
}

export default function UserAccountMenu({ isAdmin, userFullName, userImageUrl, onLogout }: UserAccountMenuProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [anchorElUser, setAnchorElUser] = useState<null | HTMLElement>(null);

  return (
    <Box sx={{ flexGrow: 0, ml: 1.5 }}>
      <Tooltip title={t('layout.toolbar.account')}>
        <IconButton
          onClick={(e) => setAnchorElUser(e.currentTarget)}
          aria-haspopup="true"
          aria-expanded={Boolean(anchorElUser)}
          data-testid="layout.btn.user-menu"
          sx={{ p: 0 }}
        >
          <Avatar alt={userFullName || 'User'} src={userImageUrl || undefined} sx={{ width: 32, height: 32 }} />
        </IconButton>
      </Tooltip>
      <Menu
        sx={{ mt: '45px', '& .MuiMenuItem-root': { gap: 1.5 } }}
        id="menu-appbar"
        anchorEl={anchorElUser}
        anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
        keepMounted
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        open={Boolean(anchorElUser)}
        onClose={() => setAnchorElUser(null)}
      >
        <MenuItem onClick={() => { setAnchorElUser(null); navigate('/profile'); }}>
          <ListItemIcon><PersonIcon fontSize="small" /></ListItemIcon>
          <ListItemText>{t('layout.toolbar.profile')}</ListItemText>
        </MenuItem>
        <Divider />
        <MenuItem onClick={() => { setAnchorElUser(null); navigate('/sites'); }}>
          <ListItemIcon><WebIcon fontSize="small" /></ListItemIcon>
          <ListItemText>{t('layout.accountMenu.sites')}</ListItemText>
        </MenuItem>
        {isAdmin && (
          <MenuItem onClick={() => { setAnchorElUser(null); navigate('/locales'); }}>
            <ListItemIcon><LanguageIcon fontSize="small" /></ListItemIcon>
            <ListItemText>{t('layout.accountMenu.locales')}</ListItemText>
          </MenuItem>
        )}
        <MenuItem onClick={() => { setAnchorElUser(null); navigate('/api-docs'); }}>
          <ListItemIcon><IntegrationInstructionsIcon fontSize="small" /></ListItemIcon>
          <ListItemText>{t('layout.accountMenu.apiDocs')}</ListItemText>
        </MenuItem>
        <Divider />
        <MenuItem onClick={onLogout}>
          <ListItemIcon><LogoutIcon fontSize="small" /></ListItemIcon>
          <ListItemText>{t('layout.sidebar.logout')}</ListItemText>
        </MenuItem>
      </Menu>
    </Box>
  );
}
