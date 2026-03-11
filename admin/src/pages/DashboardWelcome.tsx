import { Box, Button, Typography } from '@mui/material';
import RocketLaunchIcon from '@mui/icons-material/RocketLaunch';
import { useTranslation } from 'react-i18next';
import OnboardingSurvey from '@/components/OnboardingSurvey';
import SiteCreationWizard from '@/components/sites/SiteCreationWizard';
import type { UserType, ContentIntent } from '@/types/api';
import type { computeWizardDefaults } from '@/utils/onboardingDefaults';

interface DashboardWelcomeProps {
  showSurvey: boolean;
  onSurveyComplete: (userType: UserType, intents: ContentIntent[]) => void;
  onSurveySkip: () => void;
  surveyLoading: boolean;
  wizardOpen: boolean;
  wizardDismissed: boolean;
  onboardingCompleted: boolean;
  onOpenWizard: () => void;
  onCloseWizard: () => void;
  wizardDefaults: ReturnType<typeof computeWizardDefaults> | undefined;
}

export default function DashboardWelcome({
  showSurvey,
  onSurveyComplete,
  onSurveySkip,
  surveyLoading,
  wizardOpen,
  wizardDismissed,
  onboardingCompleted,
  onOpenWizard,
  onCloseWizard,
  wizardDefaults,
}: DashboardWelcomeProps) {
  const { t } = useTranslation();

  if (showSurvey) {
    return (
      <OnboardingSurvey
        onComplete={onSurveyComplete}
        onSkip={onSurveySkip}
        loading={surveyLoading}
      />
    );
  }

  return (
    <>
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
        <Typography variant="h4" component="h1" fontWeight="bold" gutterBottom>
          {t('onboarding.welcome')}
        </Typography>
        <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 520, mb: 4 }}>
          {t('onboarding.description')}
        </Typography>
        <Button
          variant="contained"
          size="large"
          onClick={onOpenWizard}
          sx={{ px: 5, py: 1.5 }}
        >
          {t('onboarding.createSite')}
        </Button>
      </Box>
      <SiteCreationWizard
        open={wizardOpen || (onboardingCompleted && !wizardDismissed)}
        onClose={onCloseWizard}
        defaultModules={wizardDefaults?.modules}
        defaultWorkflowMode={wizardDefaults?.workflowMode}
      />
    </>
  );
}
