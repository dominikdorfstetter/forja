import { useReducer, useCallback, useEffect, useState } from 'react';
import { Alert, Box } from '@mui/material';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Trans, useTranslation } from 'react-i18next';
import { completeOnboarding, getOnboarding } from '@/services/auth';
import { deleteSampleContent } from '@/services/blogs';
import { completeOnboardingStep, getOnboardingProgress } from '@/services/sites';
import { useErrorSnackbar } from '@/hooks/useErrorSnackbar';
import { useAuth } from '@/store/AuthContext';
import { useSiteContext } from '@/store/SiteContext';
import { useDashboardData } from '@/hooks/useDashboardData';
import { useSiteContextData } from '@/hooks/useSiteContextData';
import SetupChecklist from '@/components/SetupChecklist';
import QuickPostDialog from '@/components/blogs/QuickPostDialog';
import TeamWorkflowPrompt from '@/components/TeamWorkflowPrompt';
import { computeWizardDefaults } from '@/utils/onboardingDefaults';
import type { UserType, ContentIntent } from '@/types/api';
import DashboardWelcome from '@/pages/DashboardWelcome';
import { M3Button } from '@/components/design-system';
import {
  WorkbenchHeader,
  FocusCards,
  WorkbenchFeed,
  HealthStrip,
  AnalyticsStrip,
  type WorkbenchFilter,
} from '@/components/dashboard/workbench';
import { queryKeys } from '@/lib/queryKeys';

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

interface DashboardUIState {
  wizardOpen: boolean;
  wizardDismissed: boolean;
  quickPostOpen: boolean;
  wizardDefaults: ReturnType<typeof computeWizardDefaults> | undefined;
  checklistDismissed: boolean;
}

type DashboardUIAction =
  | { type: 'SET_WIZARD_OPEN'; payload: boolean }
  | { type: 'SET_WIZARD_DISMISSED'; payload: boolean }
  | { type: 'SET_QUICK_POST_OPEN'; payload: boolean }
  | { type: 'SET_WIZARD_DEFAULTS'; payload: ReturnType<typeof computeWizardDefaults> | undefined }
  | { type: 'SET_CHECKLIST_DISMISSED'; payload: boolean }
  | { type: 'OPEN_WIZARD_WITH_DEFAULTS'; payload: ReturnType<typeof computeWizardDefaults> };

function dashboardReducer(state: DashboardUIState, action: DashboardUIAction): DashboardUIState {
  switch (action.type) {
    case 'SET_WIZARD_OPEN':
      return { ...state, wizardOpen: action.payload };
    case 'SET_WIZARD_DISMISSED':
      return { ...state, wizardDismissed: action.payload };
    case 'SET_QUICK_POST_OPEN':
      return { ...state, quickPostOpen: action.payload };
    case 'SET_WIZARD_DEFAULTS':
      return { ...state, wizardDefaults: action.payload };
    case 'SET_CHECKLIST_DISMISSED':
      return { ...state, checklistDismissed: action.payload };
    case 'OPEN_WIZARD_WITH_DEFAULTS':
      return { ...state, wizardDefaults: action.payload, wizardOpen: true };
    default:
      return state;
  }
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export default function DashboardHome() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { showError } = useErrorSnackbar();
  const { isGuest, canWrite } = useAuth();
  const { selectedSiteId, selectedSite, sites, isLoading: sitesLoading } = useSiteContext();

  const initialUIState: DashboardUIState = {
    wizardOpen: false,
    wizardDismissed: false,
    quickPostOpen: false,
    wizardDefaults: undefined,
    checklistDismissed:
      !!selectedSiteId && localStorage.getItem(`forja_checklist_dismissed_${selectedSiteId}`) === '1',
  };

  const [ui, uiDispatch] = useReducer(dashboardReducer, initialUIState);
  const [workbenchFilter, setWorkbenchFilter] = useState<WorkbenchFilter>('attention');

  const hasSite = !!selectedSiteId;
  const hasNoSites = !sitesLoading && (!sites || sites.length === 0);
  const isViewerOnly = !canWrite;

  const dashboard = useDashboardData();
  const { context: siteContext } = useSiteContextData();

  // Onboarding progress (per-site checklist state from backend)
  const { data: onboardingProgress } = useQuery({
    queryKey: queryKeys.onboardingProgress(selectedSiteId),
    queryFn: () => getOnboardingProgress(selectedSiteId),
    enabled: hasSite,
  });

  const completeStepMutation = useMutation({
    mutationFn: (stepKey: string) =>
      completeOnboardingStep(selectedSiteId, { step_key: stepKey }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.onboardingProgress(selectedSiteId) });
    },
    onError: showError,
  });

  const deleteSamplesMutation = useMutation({
    mutationFn: () => deleteSampleContent(selectedSiteId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.dashboardBlogs(selectedSiteId) });
    },
    onError: showError,
  });

  // Fetch onboarding state (only when user has no sites)
  const { data: onboarding, isLoading: onboardingLoading } = useQuery({
    queryKey: queryKeys.onboarding(),
    queryFn: () => getOnboarding(),
    enabled: hasNoSites,
  });

  const completeOnboardingMutation = useMutation({
    mutationFn: ({ userType, intents }: { userType: UserType; intents: ContentIntent[] }) =>
      completeOnboarding({ user_type: userType, intents }),
    onSuccess: (_, { userType, intents }) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.onboarding() });
      const defaults = computeWizardDefaults(userType, intents);
      uiDispatch({ type: 'OPEN_WIZARD_WITH_DEFAULTS', payload: defaults });
    },
    onError: showError,
  });

  const handleSurveyComplete = (userType: UserType, intents: ContentIntent[]) => {
    completeOnboardingMutation.mutate({ userType, intents });
  };

  const handleSurveySkip = () => {
    completeOnboardingMutation.mutate({ userType: 'solo', intents: ['blog'] });
  };

  // Command palette listener for quick-post
  useEffect(() => {
    const handler = (e: Event) => {
      if ((e as CustomEvent).detail === 'quick-post') {
        uiDispatch({ type: 'SET_QUICK_POST_OPEN', payload: true });
      }
    };
    window.addEventListener('command-palette:action', handler);
    return () => window.removeEventListener('command-palette:action', handler);
  }, []);

  // ---------- Setup checklist ----------

  const checklistKey = `forja_checklist_dismissed_${selectedSiteId}`;

  useEffect(() => {
    uiDispatch({
      type: 'SET_CHECKLIST_DISMISSED',
      payload: !!selectedSiteId && localStorage.getItem(checklistKey) === '1',
    });
  }, [selectedSiteId, checklistKey]);

  const dismissChecklist = useCallback(() => {
    if (selectedSiteId) {
      localStorage.setItem(checklistKey, '1');
    }
    uiDispatch({ type: 'SET_CHECKLIST_DISMISSED', payload: true });
  }, [checklistKey, selectedSiteId]);

  const hasLocales = (dashboard.siteLocales ?? []).length > 0;
  const hasNavigation = (dashboard.navMenus ?? []).length > 0;
  const showChecklist = hasSite && !ui.checklistDismissed && !isGuest;

  // ---------- Render ----------

  if (hasNoSites) {
    const showSurvey = !onboardingLoading && !onboarding?.completed && !ui.wizardOpen;

    return (
      <DashboardWelcome
        showSurvey={showSurvey}
        onSurveyComplete={handleSurveyComplete}
        onSurveySkip={handleSurveySkip}
        surveyLoading={completeOnboardingMutation.isPending}
        wizardOpen={ui.wizardOpen}
        wizardDismissed={ui.wizardDismissed}
        onboardingCompleted={onboarding?.completed === true}
        onOpenWizard={() => uiDispatch({ type: 'SET_WIZARD_OPEN', payload: true })}
        onCloseWizard={() => {
          uiDispatch({ type: 'SET_WIZARD_OPEN', payload: false });
          uiDispatch({ type: 'SET_WIZARD_DISMISSED', payload: true });
        }}
        wizardDefaults={ui.wizardDefaults}
      />
    );
  }

  const workbenchActions = hasSite && canWrite ? (
    <M3Button
      size="md"
      icon="bolt"
      onClick={() => uiDispatch({ type: 'SET_QUICK_POST_OPEN', payload: true })}
      data-testid="dashboard.btn.quick-post"
    >
      {t('quickPost.dashboardButton')}
    </M3Button>
  ) : undefined;

  return (
    <Box data-testid="dashboard.page">
      {hasSite && (
        <>
          <WorkbenchHeader siteName={selectedSite?.name ?? null} actions={workbenchActions} />

          <FocusCards
            needsReviewCount={
              dashboard.blogStatusCounts.InReview + dashboard.pageStatusCounts.InReview
            }
            draftsCount={dashboard.blogStatusCounts.Draft + dashboard.pageStatusCounts.Draft}
            scheduledCount={
              dashboard.blogStatusCounts.Scheduled + dashboard.pageStatusCounts.Scheduled
            }
            activeFilter={
              workbenchFilter === 'attention'
                ? null
                : (workbenchFilter as 'review' | 'drafts' | 'scheduled')
            }
            onFilterChange={(k) => setWorkbenchFilter(k)}
          />

          <WorkbenchFeed
            inReviewBlogs={dashboard.inReviewBlogs}
            inReviewPages={dashboard.inReviewPages}
            draftBlogs={dashboard.draftBlogs}
            draftPages={dashboard.draftPages}
            blogStatusCounts={dashboard.blogStatusCounts}
            pageStatusCounts={dashboard.pageStatusCounts}
            filter={workbenchFilter}
            onFilterChange={setWorkbenchFilter}
            loading={dashboard.blogsLoading || dashboard.pagesLoading}
          />

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
              gap: 1.75,
              mt: 2.5,
              mb: 3,
            }}
          >
            <HealthStrip healthData={dashboard.healthData} loading={dashboard.healthLoading} />
            <AnalyticsStrip />
          </Box>
        </>
      )}

      {/* Setup checklist — first-time-user onboarding (relocation to Site
          Launcher is tracked as a follow-up). */}
      {showChecklist && (
        <SetupChecklist
          hasLocales={hasLocales}
          hasPages={dashboard.totalPages > 0}
          hasBlogs={dashboard.totalBlogs > 0}
          hasNavigation={hasNavigation}
          hasPublished={dashboard.hasPublished}
          hasSampleContent={dashboard.hasSampleContent}
          isTeam={siteContext.member_count >= 2}
          completedSteps={onboardingProgress?.completed_steps?.map((s) => s.step_key) ?? []}
          onDismiss={dismissChecklist}
          onCompleteStep={(stepKey) => completeStepMutation.mutate(stepKey)}
          onDeleteSamples={() => deleteSamplesMutation.mutate()}
        />
      )}

      {/* Team workflow prompt — one-time nudge for collaborative sites */}
      {hasSite && <TeamWorkflowPrompt />}

      {/* Read-only notice — viewers don't have action affordances on the feed */}
      {isViewerOnly && (
        <Alert severity="info" sx={{ mb: 3 }}>
          <Trans i18nKey="dashboard.readOnlyNotice" components={{ strong: <strong /> }} />
        </Alert>
      )}

      <QuickPostDialog
        open={ui.quickPostOpen}
        onClose={() => uiDispatch({ type: 'SET_QUICK_POST_OPEN', payload: false })}
      />
    </Box>
  );
}
