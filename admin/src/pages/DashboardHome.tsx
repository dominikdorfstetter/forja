import { useReducer, useCallback, useEffect } from 'react';
import {
  Alert,
  Box,
  Button,
  Chip,
  Grid,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import BoltIcon from '@mui/icons-material/Bolt';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Trans, useTranslation } from 'react-i18next';
import apiService from '@/services/api';
import { useErrorSnackbar } from '@/hooks/useErrorSnackbar';
import { useAuth } from '@/store/AuthContext';
import { useSiteContext } from '@/store/SiteContext';
import { useDashboardData } from '@/hooks/useDashboardData';
import SetupChecklist from '@/components/SetupChecklist';
import ContentStatusChart from '@/components/dashboard/ContentStatusChart';
import AttentionPanel from '@/components/dashboard/AttentionPanel';
import RecentActivityPanel from '@/components/dashboard/RecentActivityPanel';
import QuickPostDialog from '@/components/blogs/QuickPostDialog';
import TeamWorkflowPrompt from '@/components/TeamWorkflowPrompt';
import AnalyticsWidget from '@/components/dashboard/AnalyticsWidget';
import SystemHealthPanel from '@/components/dashboard/SystemHealthPanel';
import ApiKeysPanel from '@/components/dashboard/ApiKeysPanel';
import { computeWizardDefaults } from '@/utils/onboardingDefaults';
import type { UserType, ContentIntent } from '@/types/api';
import DashboardStatCards from '@/pages/DashboardStatCards';
import DashboardWelcome from '@/pages/DashboardWelcome';


// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const PERMISSION_META: Record<string, { labelKey: string; color: 'default' | 'info' | 'warning' | 'success' | 'error' }> = {
  Master: { labelKey: 'dashboard.permissions.master', color: 'error' },
  Owner: { labelKey: 'dashboard.permissions.owner', color: 'error' },
  Admin: { labelKey: 'dashboard.permissions.admin', color: 'warning' },
  Write: { labelKey: 'dashboard.permissions.write', color: 'info' },
  Read: { labelKey: 'dashboard.permissions.readOnly', color: 'default' },
};

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
  const { permission, isMaster, isAdmin, canWrite, isSystemAdmin, currentSiteRole, isOwner } = useAuth();
  const { selectedSiteId, selectedSite, sites, isLoading: sitesLoading2 } = useSiteContext();

  const initialUIState: DashboardUIState = {
    wizardOpen: false,
    wizardDismissed: false,
    quickPostOpen: false,
    wizardDefaults: undefined,
    checklistDismissed: !!selectedSiteId && localStorage.getItem(`forja_checklist_dismissed_${selectedSiteId}`) === '1',
  };

  const [ui, uiDispatch] = useReducer(dashboardReducer, initialUIState);

  const hasSite = !!selectedSiteId;
  const hasNoSites = !sitesLoading2 && (!sites || sites.length === 0);

  const dashboard = useDashboardData();

  // Fetch onboarding state (only when user has no sites)
  const { data: onboarding, isLoading: onboardingLoading } = useQuery({
    queryKey: ['onboarding'],
    queryFn: () => apiService.getOnboarding(),
    enabled: hasNoSites,
  });

  const completeOnboardingMutation = useMutation({
    mutationFn: ({ userType, intents }: { userType: UserType; intents: ContentIntent[] }) =>
      apiService.completeOnboarding({ user_type: userType, intents }),
    onSuccess: (_, { userType, intents }) => {
      queryClient.invalidateQueries({ queryKey: ['onboarding'] });
      const defaults = computeWizardDefaults(userType, intents);
      uiDispatch({ type: 'OPEN_WIZARD_WITH_DEFAULTS', payload: defaults });
    },
    onError: showError,
  });

  const handleSurveyComplete = (userType: UserType, intents: ContentIntent[]) => {
    completeOnboardingMutation.mutate({ userType, intents });
  };

  const handleSurveySkip = () => {
    // Skip defaults to solo + blog
    completeOnboardingMutation.mutate({ userType: 'solo', intents: ['blog'] });
  };

  // Derive effective permission level
  const effectivePermission: string | null = isSystemAdmin
    ? 'Master'
    : isMaster
      ? 'Master'
      : isOwner
        ? 'Owner'
        : isAdmin
          ? 'Admin'
          : canWrite
            ? 'Write'
            : currentSiteRole
              ? currentSiteRole.charAt(0).toUpperCase() + currentSiteRole.slice(1)
              : permission;
  const meta = effectivePermission ? PERMISSION_META[effectivePermission] : null;

  // Command palette listener for quick-post
  useEffect(() => {
    const handler = (e: Event) => {
      if ((e as CustomEvent).detail === 'quick-post') uiDispatch({ type: 'SET_QUICK_POST_OPEN', payload: true });
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
  const showChecklist = hasSite && !ui.checklistDismissed;

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
        onCloseWizard={() => { uiDispatch({ type: 'SET_WIZARD_OPEN', payload: false }); uiDispatch({ type: 'SET_WIZARD_DISMISSED', payload: true }); }}
        wizardDefaults={ui.wizardDefaults}
      />
    );
  }

  return (
    <Box data-testid="dashboard.page">
      {/* Header */}
      <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 1 }}>
        <Typography variant="h4" component="h1" fontWeight="bold">
          {t('dashboard.title')}
        </Typography>
        {meta && (
          <Chip label={t(meta.labelKey)} color={meta.color} size="small" variant="outlined" />
        )}
      </Stack>

      <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 3 }}>
        <Typography variant="subtitle1" color="text.secondary">
          {selectedSite
            ? t('dashboard.managing', { name: selectedSite.name })
            : t('dashboard.selectSitePrompt')}
        </Typography>
        {hasSite && canWrite && (
          <Button
            variant="contained"
            startIcon={<BoltIcon />}
            onClick={() => uiDispatch({ type: 'SET_QUICK_POST_OPEN', payload: true })}
            size="small"
          >
            {t('quickPost.dashboardButton')}
          </Button>
        )}
      </Stack>

      {/* Setup checklist */}
      {showChecklist && (
        <SetupChecklist
          hasLocales={hasLocales}
          hasPages={dashboard.totalPages > 0}
          hasBlogs={dashboard.totalBlogs > 0}
          hasNavigation={hasNavigation}
          onDismiss={dismissChecklist}
        />
      )}

      {/* Team workflow prompt */}
      {hasSite && <TeamWorkflowPrompt />}

      {/* Read-only notice */}
      {effectivePermission === 'Read' && (
        <Alert severity="info" sx={{ mb: 3 }}>
          <Trans i18nKey="dashboard.readOnlyNotice" components={{ strong: <strong /> }} />
        </Alert>
      )}

      {/* Stat cards */}
      <DashboardStatCards
        hasSite={hasSite}
        isAdmin={isAdmin}
        totalSites={dashboard.totalSites}
        sitesLoading={dashboard.sitesLoading}
        totalBlogs={dashboard.totalBlogs}
        blogsLoading={dashboard.blogsLoading}
        blogStatusCounts={dashboard.blogStatusCounts}
        totalPages={dashboard.totalPages}
        pagesLoading={dashboard.pagesLoading}
        pageStatusCounts={dashboard.pageStatusCounts}
        totalMedia={dashboard.totalMedia}
        mediaLoading={dashboard.mediaLoading}
        totalApiKeys={dashboard.totalApiKeys}
        apiKeysLoading={dashboard.apiKeysLoading}
      />

      {/* ================================================================ */}
      {/* Content Overview + Attention Panel */}
      {/* ================================================================ */}
      {hasSite && (
        <Grid container spacing={3} sx={{ mb: 3 }}>
          <Grid size={{ xs: 12, md: 7 }}>
            <Paper sx={{ p: 3, height: '100%' }}>
              <AttentionPanel
                inReviewBlogs={dashboard.inReviewBlogs}
                inReviewPages={dashboard.inReviewPages}
                draftBlogs={dashboard.draftBlogs}
                draftPages={dashboard.draftPages}
                publishedBlogs={dashboard.publishedBlogs}
                loading={dashboard.blogsLoading || dashboard.pagesLoading}
              />
            </Paper>
          </Grid>

          <Grid size={{ xs: 12, md: 5 }}>
            <Paper sx={{ p: 3, height: '100%', display: 'flex', flexDirection: 'column' }}>
              <Typography variant="h6" component="h2" sx={{ mb: 1 }}>
                {t('dashboard.contentOverview')}
              </Typography>
              <ContentStatusChart
                statusCounts={dashboard.statusCounts}
                loading={dashboard.blogsLoading || dashboard.pagesLoading}
              />
            </Paper>
          </Grid>
        </Grid>
      )}

      {/* ================================================================ */}
      {/* Recent Activity + System & Admin */}
      {/* ================================================================ */}
      <Grid container spacing={3}>
        {hasSite && (
          <Grid size={{ xs: 12, md: 7 }}>
            <Paper sx={{ p: 3, height: '100%' }}>
              <RecentActivityPanel
                blogs={dashboard.recentBlogs}
                pages={dashboard.allPages}
                loading={dashboard.blogsLoading || dashboard.pagesLoading}
              />
            </Paper>
          </Grid>
        )}

        <Grid size={{ xs: 12, md: hasSite ? 5 : 12 }}>
          <Stack spacing={3}>
            {/* Analytics — self-hides when feature is disabled */}
            <AnalyticsWidget />

            {/* System Health */}
            {dashboard.healthData && (
              <SystemHealthPanel
                healthData={dashboard.healthData}
                healthLoading={dashboard.healthLoading}
                isMaster={isMaster}
              />
            )}

            {/* Admin: API Keys overview */}
            {isAdmin && (
              <ApiKeysPanel
                loading={dashboard.apiKeysLoading}
                apiKeys={dashboard.apiKeysData?.data ?? []}
              />
            )}
          </Stack>
        </Grid>
      </Grid>

      <QuickPostDialog open={ui.quickPostOpen} onClose={() => uiDispatch({ type: 'SET_QUICK_POST_OPEN', payload: false })} />
    </Box>
  );
}
