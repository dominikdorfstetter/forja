import { useTranslation } from 'react-i18next';
import { useClerk } from '@clerk/clerk-react';
import { Link, MenuItem, Select, Stack } from '@mui/material';
import { SUPPORTED_LANGUAGES } from '@/i18n';

interface WelcomeLanguageSelectorProps {
  mounted: boolean;
}

export default function WelcomeLanguageSelector({ mounted }: WelcomeLanguageSelectorProps) {
  const { t, i18n } = useTranslation();
  const clerk = useClerk();

  return (
    <Stack
      direction="row"
      spacing={2} sx={{ position: 'absolute',
        top: 20,
        right: 24,
        zIndex: 10,
        opacity: mounted ? 1 : 0,
        transition: 'opacity 0.6s ease 0.8s',
        alignItems: "center",
      }}
    >
      <Link
        component="button"
        underline="none"
        onClick={() => clerk.redirectToSignIn({ signInFallbackRedirectUrl: '/dashboard' })}
        sx={{
          color: 'rgba(255,255,255,0.7)',
          fontSize: '0.85rem',
          fontWeight: 500,
          cursor: 'pointer',
          '&:hover': { color: 'white' },
        }}
        data-testid="welcome-login-link"
      >
        {t('welcome.login')}
      </Link>
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
          slotProps: {
            paper: {
              sx: {
                bgcolor: '#1a2744',
                color: 'white',
                border: '1px solid rgba(255,255,255,0.1)',
              },
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
    </Stack>
  );
}
