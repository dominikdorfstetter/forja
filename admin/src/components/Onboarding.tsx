import {
  Box,
  Button,
  Card,
  CardContent,
  Divider,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import WebIcon from '@mui/icons-material/Web';
import TranslateIcon from '@mui/icons-material/Translate';
import ApiIcon from '@mui/icons-material/Api';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES } from '@/i18n';
import { useUserPreferences } from '@/store/UserPreferencesContext';
import { useThemeMode } from '@/theme/ThemeContext';

interface OnboardingProps {
  onCreateSite: () => void;
}

const features = [
  { iconKey: 'multiSite', icon: <WebIcon sx={{ fontSize: 36 }} color="primary" /> },
  { iconKey: 'multilingual', icon: <TranslateIcon sx={{ fontSize: 36 }} color="primary" /> },
  { iconKey: 'apiFirst', icon: <ApiIcon sx={{ fontSize: 36 }} color="primary" /> },
] as const;

export default function Onboarding({ onCreateSite }: OnboardingProps) {
  const { t } = useTranslation();
  const { preferences, updatePreferences } = useUserPreferences();
  const { themeId, options: themeOptions } = useThemeMode();

  return (
    <Box
      sx={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 'calc(100vh - 120px)',
        textAlign: 'center',
        px: 2,
      }}
    >
      <RocketLaunchIcon sx={{ fontSize: 64, color: 'primary.main', mb: 2 }} />

      <Typography variant="h3" component="h1" fontWeight="bold" gutterBottom>
        {t('onboarding.welcome')}
      </Typography>

      <Typography
        variant="h6"
        color="text.secondary"
        sx={{ maxWidth: 560, mb: 2 }}
      >
        {t('onboarding.subtitle')}
      </Typography>

      <Typography
        variant="body1"
        color="text.secondary"
        sx={{ maxWidth: 520, mb: 5 }}
      >
        {t('onboarding.description')}
      </Typography>

      <Stack
        direction={{ xs: 'column', sm: 'row' }}
        spacing={3}
        sx={{ mb: 5, width: '100%', maxWidth: 720 }}
      >
        {features.map(({ iconKey, icon }) => (
          <Card
            key={iconKey}
            variant="outlined"
            sx={{ flex: 1, textAlign: 'center' }}
          >
            <CardContent>
              {icon}
              <Typography variant="subtitle1" fontWeight={600} sx={{ mt: 1 }}>
                {t(`onboarding.features.${iconKey}`)}
              </Typography>
              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
                {t(`onboarding.features.${iconKey}Desc`)}
              </Typography>
            </CardContent>
          </Card>
        ))}
      </Stack>

      {/* Language & Theme preferences */}
      <Card variant="outlined" sx={{ width: '100%', maxWidth: 480, mb: 4 }}>
        <CardContent>
          <Typography variant="subtitle1" fontWeight={600} gutterBottom>
            {t('onboarding.preferences.title')}
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {t('onboarding.preferences.description')}
          </Typography>
          <Divider sx={{ mb: 2.5 }} />

          <Stack spacing={2.5}>
            <TextField
              select
              label={t('settings.preferences.language.label')}
              value={preferences.language}
              onChange={(e) => updatePreferences({ language: e.target.value })}
              fullWidth
              size="small"
            >
              {SUPPORTED_LANGUAGES.map((lang) => (
                <MenuItem key={lang.code} value={lang.code}>
                  {lang.nativeName} ({lang.name})
                </MenuItem>
              ))}
            </TextField>

            <TextField
              select
              label={t('settings.preferences.theme.label')}
              value={themeId}
              onChange={(e) => updatePreferences({ theme_id: e.target.value })}
              fullWidth
              size="small"
            >
              {themeOptions.map((opt) => (
                <MenuItem key={opt.id} value={opt.id}>
                  {opt.label} {opt.mode !== 'system' ? `(${opt.mode})` : ''}
                </MenuItem>
              ))}
            </TextField>
          </Stack>
        </CardContent>
      </Card>

      <Button
        variant="contained"
        size="large"
        onClick={onCreateSite}
        sx={{ px: 5, py: 1.5, fontSize: '1rem' }}
      >
        {t('onboarding.createSite')}
      </Button>
    </Box>
  );
}
