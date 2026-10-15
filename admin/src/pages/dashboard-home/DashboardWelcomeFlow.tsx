import { useReducer } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { completeOnboarding, getOnboarding } from '@/services/auth';
import { useErrorSnackbar } from '@/hooks/useErrorSnackbar';
import { computeWizardDefaults } from '@/utils/onboardingDefaults';
import type { UserType, ContentIntent } from '@/types/api';
import DashboardWelcome from '@/pages/DashboardWelcome';
import { queryKeys } from '@/lib/queryKeys';

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

type WizardDefaults = ReturnType<typeof computeWizardDefaults>;

interface WelcomeWizardState {
  wizardOpen: boolean;
  wizardDismissed: boolean;
  wizardDefaults: WizardDefaults | undefined;
}

type WelcomeWizardAction =
  | { type: 'SET_WIZARD_OPEN'; payload: boolean }
  | { type: 'CLOSE_WIZARD' }
  | { type: 'OPEN_WIZARD_WITH_DEFAULTS'; payload: WizardDefaults };

const initialWizardState: WelcomeWizardState = {
  wizardOpen: false,
  wizardDismissed: false,
  wizardDefaults: undefined,
};

function welcomeWizardReducer(state: WelcomeWizardState, action: WelcomeWizardAction): WelcomeWizardState {
  switch (action.type) {
    case 'SET_WIZARD_OPEN':
      return { ...state, wizardOpen: action.payload };
    case 'CLOSE_WIZARD':
      return { ...state, wizardOpen: false, wizardDismissed: true };
    case 'OPEN_WIZARD_WITH_DEFAULTS':
      return { ...state, wizardDefaults: action.payload, wizardOpen: true };
    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Welcome flow (user has no sites yet)
// ---------------------------------------------------------------------------

/**
 * First-run flow for a user without sites: onboarding survey, then the
 * site-creation wizard pre-filled from the survey answers.
 */
export default function DashboardWelcomeFlow() {
  const queryClient = useQueryClient();
  const { showError } = useErrorSnackbar();
  const [wizard, wizardDispatch] = useReducer(welcomeWizardReducer, initialWizardState);

  const { data: onboarding, isLoading: onboardingLoading } = useQuery({
    queryKey: queryKeys.onboarding(),
    queryFn: () => getOnboarding(),
  });

  const completeOnboardingMutation = useMutation({
    mutationFn: ({ userType, intents }: { userType: UserType; intents: ContentIntent[] }) =>
      completeOnboarding({ user_type: userType, intents }),
    onSuccess: (_, { userType, intents }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.onboarding() });
      wizardDispatch({ type: 'OPEN_WIZARD_WITH_DEFAULTS', payload: computeWizardDefaults(userType, intents) });
    },
    onError: showError,
  });

  const showSurvey = !onboardingLoading && !onboarding?.completed && !wizard.wizardOpen;

  return (
    <DashboardWelcome
      showSurvey={showSurvey}
      onSurveyComplete={(userType, intents) => completeOnboardingMutation.mutate({ userType, intents })}
      onSurveySkip={() => completeOnboardingMutation.mutate({ userType: 'solo', intents: ['blog'] })}
      surveyLoading={completeOnboardingMutation.isPending}
      wizardOpen={wizard.wizardOpen}
      wizardDismissed={wizard.wizardDismissed}
      onboardingCompleted={onboarding?.completed === true}
      onOpenWizard={() => wizardDispatch({ type: 'SET_WIZARD_OPEN', payload: true })}
      onCloseWizard={() => wizardDispatch({ type: 'CLOSE_WIZARD' })}
      wizardDefaults={wizard.wizardDefaults}
    />
  );
}
