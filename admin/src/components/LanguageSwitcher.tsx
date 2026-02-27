import { useState } from 'react';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import ListItemText from '@mui/material/ListItemText';
import Tooltip from '@mui/material/Tooltip';
import TranslateIcon from '@mui/icons-material/Translate';
import CheckIcon from '@mui/icons-material/Check';
import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES } from '@/i18n';

export default function LanguageSwitcher() {
  const { i18n, t } = useTranslation();
  const [anchorEl, setAnchorEl] = useState<null | HTMLElement>(null);

  const currentLang = i18n.language?.split('-')[0] || 'en';

  const handleLanguageChange = (code: string) => {
    i18n.changeLanguage(code);
    setAnchorEl(null);
  };

  return (
    <>
      <Tooltip title={t('layout.toolbar.language')}>
        <IconButton color="inherit" aria-label={t('layout.toolbar.language')} onClick={(e) => setAnchorEl(e.currentTarget)}>
          <TranslateIcon />
        </IconButton>
      </Tooltip>
      <Menu
        aria-label="Language selection"
        anchorEl={anchorEl}
        open={Boolean(anchorEl)}
        onClose={() => setAnchorEl(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
      >
        {SUPPORTED_LANGUAGES.map((lang) => (
          <MenuItem
            key={lang.code}
            selected={currentLang === lang.code}
            onClick={() => handleLanguageChange(lang.code)}
          >
            <ListItemText>{lang.nativeName}</ListItemText>
            {currentLang === lang.code && (
              <CheckIcon fontSize="small" sx={{ ml: 1, color: 'primary.main' }} />
            )}
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}
