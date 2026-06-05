import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Menu, MenuItem, ListItemIcon, ListItemText, Divider, Typography } from '@mui/material';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import SchoolIcon from '@mui/icons-material/School';
import KeyboardIcon from '@mui/icons-material/Keyboard';
import FeedbackIcon from '@mui/icons-material/Feedback';
import IntegrationInstructionsIcon from '@mui/icons-material/IntegrationInstructions';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/store/AuthContext';
import { useHelpState } from '@/store/HelpStateContext';
import { M3IconButton } from '@/components/design-system';
import { m3MenuPaperSx } from '@/components/layout/m3MenuSx';
import KeyboardShortcutsDialog from './KeyboardShortcutsDialog';

import { version as APP_VERSION } from '../../../package.json';

const DOCS_URL = 'https://forja-docs.dorfstetter.at';
const FEEDBACK_URL = 'https://github.com/dominikdorfstetter/forja/issues';

export default function HelpMenu() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isGuest } = useAuth();
  const { startTour } = useHelpState();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);

  const handleOpen = (event: React.MouseEvent<HTMLElement>) => {
    setAnchorEl(event.currentTarget);
  };

  const handleClose = () => {
    setAnchorEl(null);
  };

  const handleTour = () => {
    handleClose();
    startTour();
  };

  const handleShortcuts = () => {
    handleClose();
    setShortcutsOpen(true);
  };

  return (
    <>
      <M3IconButton
        name="help"
        size={40}
        tooltip={t('help.menu.title')}
        onClick={handleOpen}
        data-tour="help-menu"
      />

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleClose}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
        slotProps={{ paper: { sx: { ...m3MenuPaperSx, minWidth: 220 } } }}
      >
        <MenuItem
          component="a"
          href={DOCS_URL}
          target="_blank"
          rel="noopener noreferrer"
          onClick={handleClose}
        >
          <ListItemIcon><MenuBookIcon fontSize="small" /></ListItemIcon>
          <ListItemText>{t('help.menu.documentation')}</ListItemText>
        </MenuItem>

        {!isGuest && (
          <MenuItem onClick={handleTour}>
            <ListItemIcon><SchoolIcon fontSize="small" /></ListItemIcon>
            <ListItemText>{t('help.menu.quickTour')}</ListItemText>
          </MenuItem>
        )}

        <MenuItem onClick={handleShortcuts}>
          <ListItemIcon><KeyboardIcon fontSize="small" /></ListItemIcon>
          <ListItemText>{t('help.menu.keyboardShortcuts')}</ListItemText>
        </MenuItem>

        <MenuItem
          onClick={() => {
            handleClose();
            navigate('/api-docs');
          }}
        >
          <ListItemIcon><IntegrationInstructionsIcon fontSize="small" /></ListItemIcon>
          <ListItemText>{t('layout.accountMenu.apiDocs')}</ListItemText>
        </MenuItem>

        <MenuItem
          component="a"
          href={FEEDBACK_URL}
          target="_blank"
          rel="noopener noreferrer"
          onClick={handleClose}
        >
          <ListItemIcon><FeedbackIcon fontSize="small" /></ListItemIcon>
          <ListItemText>{t('help.menu.feedback')}</ListItemText>
        </MenuItem>

        <Divider component="li" />

        <MenuItem
          disabled
          sx={{ opacity: 1, '&.Mui-disabled': { opacity: 1 }, pointerEvents: 'none' }}
        >
          <Typography
            component="span"
            sx={{ fontSize: 11, color: 'var(--on-surface-variant)', letterSpacing: 0.3 }}
          >
            {t('help.menu.version', { version: APP_VERSION })}
          </Typography>
        </MenuItem>
      </Menu>

      <KeyboardShortcutsDialog
        open={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
      />
    </>
  );
}
