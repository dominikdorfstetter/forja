import { useState } from 'react';
import { useNavigate } from 'react-router';
import Divider from '@mui/material/Divider';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import ExitToAppIcon from '@mui/icons-material/ExitToApp';
import LogoutIcon from '@mui/icons-material/Logout';
import TuneIcon from '@mui/icons-material/Tune';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import { Menu, MenuItem } from '@mui/material';
import Box from '@mui/material/Box';
import { M3IconButton } from '@/components/design-system';
import { m3MenuPaperSx } from '@/components/layout/m3MenuSx';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/store/AuthContext';
import { useSiteContext } from '@/store/SiteContext';
import PreferencesDrawer from '@/components/layout/PreferencesDrawer';

interface UserAccountMenuProps {
  onLogout: () => void;
  onLeaveSite?: () => void;
}

export default function UserAccountMenu({ onLogout, onLeaveSite }: UserAccountMenuProps) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isMaster, isOwner, isGuest } = useAuth();
  const { selectedSiteId } = useSiteContext();
  const [anchorElUser, setAnchorElUser] = useState<null | HTMLElement>(null);
  const [prefsOpen, setPrefsOpen] = useState(false);

  return (
    <Box sx={{ flexGrow: 0, ml: 0.5 }}>
      <M3IconButton
        name="more_vert"
        size={40}
        tooltip={t('layout.toolbar.account')}
        aria-haspopup="true"
        aria-expanded={Boolean(anchorElUser)}
        data-testid="layout.btn.user-menu"
        onClick={(e) => setAnchorElUser(e.currentTarget)}
      />
      <Menu
        id="menu-appbar"
        anchorEl={anchorElUser}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        keepMounted
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        open={Boolean(anchorElUser)}
        onClose={() => setAnchorElUser(null)}
        slotProps={{ paper: { sx: { ...m3MenuPaperSx, minWidth: 240 } } }}
      >
        {[
          <MenuItem key="prefs" onClick={() => { setAnchorElUser(null); setPrefsOpen(true); }} data-testid="layout.btn.preferences">
            <ListItemIcon><TuneIcon fontSize="small" /></ListItemIcon>
            <ListItemText>{t('layout.accountMenu.preferences')}</ListItemText>
          </MenuItem>,
          (selectedSiteId && !isOwner && !isGuest && onLeaveSite) ? (
            <MenuItem key="leave-site" onClick={() => { setAnchorElUser(null); onLeaveSite(); }}>
              <ListItemIcon><ExitToAppIcon fontSize="small" color="error" /></ListItemIcon>
              <ListItemText sx={{ color: 'error.main' }}>{t('members.leaveSite')}</ListItemText>
            </MenuItem>
          ) : null,
          isMaster ? <Divider key="d2" component="li" /> : null,
          isMaster ? (
            <MenuItem key="system" onClick={() => { setAnchorElUser(null); navigate('/system'); }} data-testid="layout.btn.system-admin">
              <ListItemIcon><AdminPanelSettingsIcon fontSize="small" /></ListItemIcon>
              <ListItemText>{t('layout.accountMenu.system')}</ListItemText>
            </MenuItem>
          ) : null,
          <Divider key="d3" component="li" />,
          <MenuItem key="logout" onClick={onLogout}>
            <ListItemIcon><LogoutIcon fontSize="small" /></ListItemIcon>
            <ListItemText>{isGuest ? t('layout.sidebar.leaveDemo') : t('layout.sidebar.logout')}</ListItemText>
          </MenuItem>,
        ].filter(Boolean)}
      </Menu>
      <PreferencesDrawer open={prefsOpen} onClose={() => setPrefsOpen(false)} />
    </Box>
  );
}
