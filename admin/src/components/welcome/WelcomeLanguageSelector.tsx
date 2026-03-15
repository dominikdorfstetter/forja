import { useTranslation } from 'react-i18next';
import { Box, MenuItem, Select } from '@mui/material';
import { SUPPORTED_LANGUAGES } from '@/i18n';

interface WelcomeLanguageSelectorProps {
  mounted: boolean;
}

export default function WelcomeLanguageSelector({ mounted }: WelcomeLanguageSelectorProps) {
  const { i18n } = useTranslation();

  return (
    <Box
      sx={{
        position: 'absolute',
        top: 20,
        right: 24,
        zIndex: 10,
        opacity: mounted ? 1 : 0,
        transition: 'opacity 0.6s ease 0.8s',
      }}
    >
      <Select
        value={i18n.language?.substring(0, 2) || 'en'}
        onChange={(e) => i18n.changeLanguage(e.target.value)}
        variant="standard"
        disableUnderline
        sx={{
          color: 'rgba(255,255,255,0.7)',
          fontSize: '0.85rem',
          '& .MuiSelect-icon': { color: 'rgba(255,255,255,0.5)' },
          '&:hover': { color: 'white' },
        }}
        MenuProps={{
          PaperProps: {
            sx: {
              bgcolor: '#1a2744',
              color: 'white',
              border: '1px solid rgba(255,255,255,0.1)',
            },
          },
        }}
      >
        {SUPPORTED_LANGUAGES.map((lang) => (
          <MenuItem key={lang.code} value={lang.code}>
            {lang.nativeName}
          </MenuItem>
        ))}
      </Select>
    </Box>
  );
}
