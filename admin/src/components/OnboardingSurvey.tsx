import { useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardActionArea,
  Checkbox,
  Divider,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import PersonIcon from '@mui/icons-material/Person';
import GroupIcon from '@mui/icons-material/Group';
import BusinessIcon from '@mui/icons-material/Business';
import ArticleIcon from '@mui/icons-material/Article';
import PhotoLibraryIcon from '@mui/icons-material/PhotoLibrary';
import CampaignIcon from '@mui/icons-material/Campaign';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import ApartmentIcon from '@mui/icons-material/Apartment';
import { useTranslation } from 'react-i18next';
import { SUPPORTED_LANGUAGES } from '@/i18n';
import { useUserPreferences } from '@/store/UserPreferencesContext';
import { useThemeMode } from '@/theme/ThemeContext';
import type { UserType, ContentIntent } from '@/types/api';

interface OnboardingSurveyProps {
  onComplete: (userType: UserType, intents: ContentIntent[]) => void;
  onSkip: () => void;
  loading?: boolean;
}

const USER_TYPE_OPTIONS: { key: UserType; icon: React.ReactNode }[] = [
  { key: 'solo', icon: <PersonIcon sx={{ fontSize: 32 }} /> },
  { key: 'team', icon: <GroupIcon sx={{ fontSize: 32 }} /> },
  { key: 'agency', icon: <BusinessIcon sx={{ fontSize: 32 }} /> },
];

const INTENT_OPTIONS: { key: ContentIntent; icon: React.ReactNode }[] = [
  { key: 'blog', icon: <ArticleIcon /> },
  { key: 'portfolio', icon: <PhotoLibraryIcon /> },
  { key: 'marketing', icon: <CampaignIcon /> },
  { key: 'docs', icon: <MenuBookIcon /> },
  { key: 'company', icon: <ApartmentIcon /> },
];

export default function OnboardingSurvey({ onComplete, onSkip, loading }: OnboardingSurveyProps) {
  const { t } = useTranslation();
  const { preferences, updatePreferences } = useUserPreferences();
  const { themeId, options: themeOptions } = useThemeMode();

  const [step, setStep] = useState(0);
  const [userType, setUserType] = useState<UserType | null>(null);
  const [intents, setIntents] = useState<ContentIntent[]>([]);

  const toggleIntent = (intent: ContentIntent) => {
    setIntents((prev) =>
      prev.includes(intent)
        ? prev.filter((i) => i !== intent)
        : [...prev, intent],
    );
  };

  const handleNext = () => {
    if (step === 2) {
      if (userType) {
        onComplete(userType, intents);
      }
      return;
    }
    setStep((s) => s + 1);
  };

  const handleBack = () => {
    setStep((s) => s - 1);
  };

  const canProceed = step === 0 || (step === 1 && userType !== null) || step === 2;

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
      {/* Step 0: Welcome */}
      {step === 0 && (
        <>
          <RocketLaunchIcon sx={{ fontSize: 64, color: 'primary.main', mb: 2 }} />

          <Typography variant="h3" component="h1" fontWeight="bold" gutterBottom>
            {t('onboarding.welcome')}
          </Typography>

          <Typography
            variant="h6"
            color="text.secondary"
            sx={{ maxWidth: 560, mb: 2 }}
          >
            {t('onboarding.survey.subtitle')}
          </Typography>

          <Typography
            variant="body1"
            color="text.secondary"
            sx={{ maxWidth: 520, mb: 4 }}
          >
            {t('onboarding.survey.description')}
          </Typography>

          {/* Language & Theme preferences */}
          <Card variant="outlined" sx={{ width: '100%', maxWidth: 480, mb: 4 }}>
            <Box sx={{ p: 2.5 }}>
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
            </Box>
          </Card>

          <Stack direction="row" spacing={2}>
            <Button
              variant="outlined"
              size="large"
              onClick={onSkip}
              disabled={loading}
            >
              {t('onboarding.survey.skip')}
            </Button>
            <Button
              variant="contained"
              size="large"
              onClick={handleNext}
              disabled={loading}
              sx={{ px: 5, py: 1.5 }}
            >
              {t('onboarding.survey.getStarted')}
            </Button>
          </Stack>
        </>
      )}

      {/* Step 1: Who are you? */}
      {step === 1 && (
        <>
          <Typography variant="h4" component="h1" fontWeight="bold" gutterBottom>
            {t('onboarding.survey.userTypeTitle')}
          </Typography>

          <Typography
            variant="body1"
            color="text.secondary"
            sx={{ maxWidth: 520, mb: 4 }}
          >
            {t('onboarding.survey.userTypeDescription')}
          </Typography>

          <Stack spacing={2} sx={{ width: '100%', maxWidth: 480, mb: 4 }}>
            {USER_TYPE_OPTIONS.map(({ key, icon }) => (
              <Card
                key={key}
                variant="outlined"
                sx={{
                  border: 2,
                  borderColor: userType === key ? 'primary.main' : 'divider',
                  bgcolor: userType === key ? 'action.selected' : 'background.paper',
                  transition: 'border-color 0.15s, background-color 0.15s',
                }}
              >
                <CardActionArea
                  onClick={() => setUserType(key)}
                  sx={{
                    p: 2.5,
                    display: 'flex',
                    alignItems: 'flex-start',
                    justifyContent: 'flex-start',
                    gap: 2,
                  }}
                  data-testid={`onboarding.userType.${key}`}
                >
                  <Box sx={{ color: userType === key ? 'primary.main' : 'text.secondary', mt: 0.5 }}>
                    {icon}
                  </Box>
                  <Box sx={{ textAlign: 'left' }}>
                    <Typography variant="body1" fontWeight={600}>
                      {t(`onboarding.survey.userTypes.${key}`)}
                    </Typography>
                    <Typography variant="body2" color="text.secondary">
                      {t(`onboarding.survey.userTypes.${key}Desc`)}
                    </Typography>
                  </Box>
                </CardActionArea>
              </Card>
            ))}
          </Stack>

          <Stack direction="row" spacing={2}>
            <Button onClick={handleBack} disabled={loading}>
              {t('common.actions.back')}
            </Button>
            <Button
              variant="contained"
              onClick={handleNext}
              disabled={!canProceed || loading}
            >
              {t('common.actions.next')}
            </Button>
          </Stack>
        </>
      )}

      {/* Step 2: What are you building? */}
      {step === 2 && (
        <>
          <Typography variant="h4" component="h1" fontWeight="bold" gutterBottom>
            {t('onboarding.survey.intentTitle')}
          </Typography>

          <Typography
            variant="body1"
            color="text.secondary"
            sx={{ maxWidth: 520, mb: 4 }}
          >
            {t('onboarding.survey.intentDescription')}
          </Typography>

          <Stack spacing={1.5} sx={{ width: '100%', maxWidth: 480, mb: 4 }}>
            {INTENT_OPTIONS.map(({ key, icon }) => {
              const checked = intents.includes(key);
              return (
                <Card
                  key={key}
                  variant="outlined"
                  sx={{
                    border: 2,
                    borderColor: checked ? 'primary.main' : 'divider',
                    bgcolor: checked ? 'action.selected' : 'background.paper',
                    transition: 'border-color 0.15s, background-color 0.15s',
                  }}
                >
                  <CardActionArea
                    onClick={() => toggleIntent(key)}
                    sx={{
                      p: 2,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'flex-start',
                      gap: 1.5,
                    }}
                    data-testid={`onboarding.intent.${key}`}
                  >
                    <Checkbox
                      checked={checked}
                      tabIndex={-1}
                      disableRipple
                      size="small"
                    />
                    <Box sx={{ color: checked ? 'primary.main' : 'text.secondary' }}>
                      {icon}
                    </Box>
                    <Box sx={{ textAlign: 'left' }}>
                      <Typography variant="body2" fontWeight={600}>
                        {t(`onboarding.survey.intents.${key}`)}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {t(`onboarding.survey.intents.${key}Desc`)}
                      </Typography>
                    </Box>
                  </CardActionArea>
                </Card>
              );
            })}
          </Stack>

          <Stack direction="row" spacing={2}>
            <Button onClick={handleBack} disabled={loading}>
              {t('common.actions.back')}
            </Button>
            <Button
              variant="contained"
              onClick={handleNext}
              disabled={loading}
            >
              {loading ? t('common.actions.saving') : t('onboarding.survey.finish')}
            </Button>
          </Stack>
        </>
      )}
    </Box>
  );
}
