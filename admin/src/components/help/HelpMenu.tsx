import { useState } from 'react';
import { IconButton, Menu, MenuItem, ListItemIcon, ListItemText, Divider, Typography, Tooltip } from '@mui/material';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import SchoolIcon from '@mui/icons-material/School';
import KeyboardIcon from '@mui/icons-material/Keyboard';
import FeedbackIcon from '@mui/icons-material/Feedback';
import { useTranslation } from 'react-i18next';
import { useHelpState } from '@/store/HelpStateContext';
import KeyboardShortcutsDialog from './KeyboardShortcutsDialog';

const DOCS_URL = 'https://forja-cms.github.io/forja';
const FEEDBACK_URL = 'https://github.com/dominikdorfstetter/forja/issues';
const APP_VERSION = '1.0.5';

export default function HelpMenu() {
  const { t } = useTranslation();
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
      <Tooltip title={t('help.menu.title')}>
        <IconButton
          color="inherit"
          aria-label={t('help.menu.title')}
          onClick={handleOpen}
          data-tour="help-menu"
        >
          <HelpOutlineIcon />
        </IconButton>
      </Tooltip>

      <Menu
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={handleClose}
        sx={{ mt: 1, '& .MuiMenuItem-root': { gap: 0.5 } }}
        transformOrigin={{ horizontal: 'right', vertical: 'top' }}
        anchorOrigin={{ horizontal: 'right', vertical: 'bottom' }}
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

        <MenuItem onClick={handleTour}>
          <ListItemIcon><SchoolIcon fontSize="small" /></ListItemIcon>
          <ListItemText>{t('help.menu.quickTour')}</ListItemText>
        </MenuItem>

        <MenuItem onClick={handleShortcuts}>
          <ListItemIcon><KeyboardIcon fontSize="small" /></ListItemIcon>
          <ListItemText>{t('help.menu.keyboardShortcuts')}</ListItemText>
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

        <Divider />

        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ px: 2, py: 0.5, display: 'block' }}
        >
          {t('help.menu.version', { version: APP_VERSION })}
        </Typography>
      </Menu>

      <KeyboardShortcutsDialog
        open={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
      />
    </>
  );
}
