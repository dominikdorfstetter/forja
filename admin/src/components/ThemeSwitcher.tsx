import { useState } from 'react';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Tooltip from '@mui/material/Tooltip';
import PaletteIcon from '@mui/icons-material/Palette';
import LightModeIcon from '@mui/icons-material/LightMode';
import DarkModeIcon from '@mui/icons-material/DarkMode';
import SettingsBrightnessIcon from '@mui/icons-material/SettingsBrightness';
import CheckIcon from '@mui/icons-material/Check';
import { useThemeMode, type ThemeOption } from '@/theme';
import { useTranslation } from 'react-i18next';

function optionIcon(option: ThemeOption) {
  if (option.mode === 'system') return <SettingsBrightnessIcon fontSize="small" />;
  if (option.mode === 'light') return <LightModeIcon fontSize="small" />;
  return <DarkModeIcon fontSize="small" />;
}

export default function ThemeSwitcher() {
  const { themeId, setThemeId, options } = useThemeMode();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);
  const { t } = useTranslation();

  return (
    <>
      <Tooltip title={t('layout.toolbar.theme')}>
        <IconButton color="inherit" aria-label={t('layout.toolbar.theme')} onClick={(e) => setAnchorEl(e.currentTarget)}>
          <PaletteIcon />
        </IconButton>
      </Tooltip>
      <Menu
        aria-label={t('layout.toolbar.theme')}
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        {options.map((opt) => (
          <MenuItem
            key={opt.id}
            selected={themeId === opt.id}
            onClick={() => {
              setThemeId(opt.id);
              setAnchorEl(null);
            }}
          >
            <ListItemIcon>{optionIcon(opt)}</ListItemIcon>
            <ListItemText>{opt.label}</ListItemText>
            {themeId === opt.id && (
              <CheckIcon fontSize="small" sx={{ ml: 1, color: 'primary.main' }} />
            )}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
