import {
  Box,
  Button,
  Card,
  CardContent,
  Stack,
  Typography,
} from '@mui/material';
import WebIcon from '@mui/icons-material/Web';
import TranslateIcon from '@mui/icons-material/Translate';
import ApiIcon from '@mui/icons-material/Api';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import { useTranslation } from 'react-i18next';

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
