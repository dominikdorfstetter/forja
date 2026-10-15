import { Alert, Box } from '@mui/material';
import { Trans } from 'react-i18next';
import { useAuth } from '@/store/AuthContext';
import { useSiteContext } from '@/store/SiteContext';
import { useDashboardData } from '@/hooks/useDashboardData';
import { useSiteContextData } from '@/hooks/useSiteContextData';
import SetupChecklist from '@/components/SetupChecklist';
import QuickPostDialog from '@/components/blogs/QuickPostDialog';
import TeamWorkflowPrompt from '@/components/TeamWorkflowPrompt';
import DashboardWelcomeFlow from './dashboard-home/DashboardWelcomeFlow';
import DashboardWorkbench from './dashboard-home/DashboardWorkbench';
import { hasEntries, hasNoSites } from './dashboard-home/dashboardHomeUtils';
import { useDashboardChecklist } from './dashboard-home/useDashboardChecklist';
import { useQuickPostShortcut } from './dashboard-home/useQuickPostShortcut';

export default function DashboardHome() {
  const { isGuest, canWrite } = useAuth();
  const { selectedSiteId, selectedSite, sites, isLoading: sitesLoading } = useSiteContext();
  const [quickPostOpen, setQuickPostOpen] = useQuickPostShortcut();
  const checklist = useDashboardChecklist(selectedSiteId);
  const dashboard = useDashboardData();
  const { context: siteContext } = useSiteContextData();

  if (hasNoSites(sitesLoading, sites)) {
    return <DashboardWelcomeFlow />;
  }

  const hasSite = !!selectedSiteId;
  const showChecklist = hasSite && !checklist.dismissed && !isGuest;

  return (
    <Box data-testid="dashboard.page">
      {hasSite && (
        <DashboardWorkbench
          siteName={selectedSite?.name ?? null}
          dashboard={dashboard}
          canWrite={canWrite}
          onQuickPost={() => setQuickPostOpen(true)}
        />
      )}

      {/* Setup checklist — first-time-user onboarding (relocation to Site
          Launcher is tracked as a follow-up). */}
      {showChecklist && (
        <SetupChecklist
          hasLocales={hasEntries(dashboard.siteLocales)}
          hasPages={dashboard.totalPages > 0}
          hasBlogs={dashboard.totalBlogs > 0}
          hasNavigation={hasEntries(dashboard.navMenus)}
          hasPublished={dashboard.hasPublished}
          hasSampleContent={dashboard.hasSampleContent}
          isTeam={siteContext.member_count >= 2}
          completedSteps={checklist.completedSteps}
          onDismiss={checklist.dismiss}
          onCompleteStep={checklist.completeStep}
          onDeleteSamples={checklist.deleteSamples}
        />
      )}

      {/* Team workflow prompt — one-time nudge for collaborative sites */}
      {hasSite && <TeamWorkflowPrompt />}

      {/* Read-only notice — viewers don't have action affordances on the feed */}
      {!canWrite && (
        <Alert severity="info" sx={{ mb: 3 }}>
          <Trans i18nKey="dashboard.readOnlyNotice" components={{ strong: <strong /> }} />
        </Alert>
      )}

      <QuickPostDialog
        open={quickPostOpen}
        onClose={() => setQuickPostOpen(false)}
      />
    </Box>
  );
}
