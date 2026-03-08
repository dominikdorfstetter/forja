import { useState, useCallback, useEffect } from 'react';
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Chip,
  Grid,
  LinearProgress,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Paper,
  Skeleton,
  Stack,
  Typography,
} from '@mui/material';
import WebIcon from '@mui/icons-material/Web';
import ArticleIcon from '@mui/icons-material/Article';
import ImageIcon from '@mui/icons-material/Image';
import KeyIcon from '@mui/icons-material/Key';
import DescriptionIcon from '@mui/icons-material/Description';
import BoltIcon from '@mui/icons-material/Bolt';
import DnsIcon from '@mui/icons-material/Dns';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import apiService from '@/services/api';
import { useErrorSnackbar } from '@/hooks/useErrorSnackbar';
import { useAuth } from '@/store/AuthContext';
import { useSiteContext } from '@/store/SiteContext';
import { useDashboardData } from '@/hooks/useDashboardData';
import Onboarding from '@/components/Onboarding';
import SetupChecklist from '@/components/SetupChecklist';
import SiteFormDialog from '@/components/sites/SiteFormDialog';
import ContentStatusChart from '@/components/dashboard/ContentStatusChart';
import AttentionPanel from '@/components/dashboard/AttentionPanel';
import RecentActivityPanel from '@/components/dashboard/RecentActivityPanel';
import QuickPostDialog from '@/components/blogs/QuickPostDialog';
import TeamWorkflowPrompt from '@/components/TeamWorkflowPrompt';
import AnalyticsWidget from '@/components/dashboard/AnalyticsWidget';
import type { CreateSiteRequest, ContentStatus } from '@/types/api';


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

const STATUS_COLORS: Record<ContentStatus, string> = {
  Draft: '#ed6c02',
  InReview: '#9c27b0',
  Scheduled: '#0288d1',
  Published: '#2e7d32',
  Archived: '#757575',
};

function StatCard({
  icon,
  label,
  value,
  loading,
  onClick,
  statusBreakdown,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  loading?: boolean;
  onClick?: () => void;
  statusBreakdown?: Record<ContentStatus, number>;
}) {
  const total = statusBreakdown
    ? Object.values(statusBreakdown).reduce((s, n) => s + n, 0)
    : 0;

  return (
    <Card
      sx={{
        height: '100%',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'box-shadow 0.2s',
        '&:hover': onClick ? { boxShadow: 6 } : undefined,
      }}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e: React.KeyboardEvent) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick(); } } : undefined}
    >
      <CardContent>
        <Box sx={{ display: 'flex', alignItems: 'center', mb: 1 }}>
          {icon}
          <Typography variant="body2" color="text.secondary" sx={{ ml: 1 }}>
            {label}
          </Typography>
        </Box>
        {loading ? (
          <Skeleton variant="text" width={60} height={48} />
        ) : (
          <Typography variant="h3" fontWeight="bold">
            {value}
          </Typography>
        )}
        {/* Mini status bar */}
        {statusBreakdown && total > 0 && !loading && (
          <Box
            sx={{
              display: 'flex',
              height: 4,
              borderRadius: 2,
              overflow: 'hidden',
              mt: 1.5,
            }}
          >
            {(Object.entries(statusBreakdown) as [ContentStatus, number][])
              .filter(([, count]) => count > 0)
              .map(([status, count]) => (
                <Box
                  key={status}
                  sx={{
                    width: `${(count / total) * 100}%`,
                    bgcolor: STATUS_COLORS[status],
                  }}
                />
              ))}
          </Box>
        )}
      </CardContent>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

export default function DashboardHome() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showError, showSuccess } = useErrorSnackbar();
  const { permission, isMaster, isAdmin, canWrite, isSystemAdmin, currentSiteRole, isOwner, refreshAuth } = useAuth();
  const { selectedSiteId, selectedSite, sites, isLoading: sitesLoading2 } = useSiteContext();
  const { setSelectedSiteId } = useSiteContext();

  const [siteFormOpen, setSiteFormOpen] = useState(false);
  const [quickPostOpen, setQuickPostOpen] = useState(false);

  const hasSite = !!selectedSiteId;
  const hasNoSites = !sitesLoading2 && (!sites || sites.length === 0);

  const dashboard = useDashboardData();

  const createSiteMutation = useMutation({
    mutationFn: (data: CreateSiteRequest) => apiService.createSite(data),
    onSuccess: async (newSite) => {
      await refreshAuth();
      queryClient.invalidateQueries({ queryKey: ['sites'] });
      setSelectedSiteId(newSite.id);
      setSiteFormOpen(false);
      showSuccess(t('sites.messages.created'));
    },
    onError: (error) => {
      showError(error);
    },
  });

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
      if ((e as CustomEvent).detail === 'quick-post') setQuickPostOpen(true);
    };
    window.addEventListener('command-palette:action', handler);
    return () => window.removeEventListener('command-palette:action', handler);
  }, []);

  // ---------- Setup checklist ----------

  const checklistKey = `forja_checklist_dismissed_${selectedSiteId}`;
  const [checklistDismissed, setChecklistDismissed] = useState(
    () => !!selectedSiteId && localStorage.getItem(`forja_checklist_dismissed_${selectedSiteId}`) === '1',
  );

  useEffect(() => {
    setChecklistDismissed(
      !!selectedSiteId && localStorage.getItem(checklistKey) === '1',
    );
  }, [selectedSiteId, checklistKey]);

  const dismissChecklist = useCallback(() => {
    if (selectedSiteId) {
      localStorage.setItem(checklistKey, '1');
    }
    setChecklistDismissed(true);
  }, [checklistKey, selectedSiteId]);

  const hasLocales = (dashboard.siteLocales ?? []).length > 0;
  const hasNavigation = (dashboard.navMenus ?? []).length > 0;
  const showChecklist = hasSite && !checklistDismissed;

  // ---------- Render ----------

  if (hasNoSites) {
    return (
      <>
        <Onboarding onCreateSite={() => setSiteFormOpen(true)} />
        <SiteFormDialog
          open={siteFormOpen}
          onSubmit={(data) => createSiteMutation.mutate(data)}
          onClose={() => setSiteFormOpen(false)}
          loading={createSiteMutation.isPending}
        />
      </>
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
            onClick={() => setQuickPostOpen(true)}
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
          <span dangerouslySetInnerHTML={{ __html: t('dashboard.readOnlyNotice') }} />
        </Alert>
      )}

      {/* ================================================================ */}
      {/* Stat cards */}
      {/* ================================================================ */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        <Grid size={{ xs: 12, sm: 6, md: isAdmin ? 2.4 : 3 }}>
          <StatCard
            icon={<WebIcon color="primary" />}
            label={t('dashboard.stats.sites')}
            value={dashboard.totalSites}
            loading={dashboard.sitesLoading}
            onClick={() => navigate('/sites')}
          />
        </Grid>

        {hasSite && (
          <Grid size={{ xs: 12, sm: 6, md: isAdmin ? 2.4 : 3 }}>
            <StatCard
              icon={<ArticleIcon color="primary" />}
              label={t('dashboard.stats.blogPosts')}
              value={dashboard.totalBlogs}
              loading={dashboard.blogsLoading}
              onClick={() => navigate('/blogs')}
              statusBreakdown={dashboard.blogStatusCounts}
            />
          </Grid>
        )}

        {hasSite && (
          <Grid size={{ xs: 12, sm: 6, md: isAdmin ? 2.4 : 3 }}>
            <StatCard
              icon={<DescriptionIcon color="primary" />}
              label={t('dashboard.stats.pages')}
              value={dashboard.totalPages}
              loading={dashboard.pagesLoading}
              onClick={() => navigate('/pages')}
              statusBreakdown={dashboard.pageStatusCounts}
            />
          </Grid>
        )}

        {hasSite && (
          <Grid size={{ xs: 12, sm: 6, md: isAdmin ? 2.4 : 3 }}>
            <StatCard
              icon={<ImageIcon color="primary" />}
              label={t('dashboard.stats.mediaFiles')}
              value={dashboard.totalMedia}
              loading={dashboard.mediaLoading}
              onClick={() => navigate('/media')}
            />
          </Grid>
        )}

        {isAdmin && (
          <Grid size={{ xs: 12, sm: 6, md: 2.4 }}>
            <StatCard
              icon={<KeyIcon color="primary" />}
              label={t('dashboard.stats.apiKeys')}
              value={dashboard.totalApiKeys}
              loading={dashboard.apiKeysLoading}
              onClick={() => navigate('/api-keys')}
            />
          </Grid>
        )}
      </Grid>

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
              <Paper sx={{ p: 2.5 }}>
                <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
                  <DnsIcon color="primary" fontSize="small" />
                  <Typography variant="subtitle2" component="h2" fontWeight={600}>
                    {t('dashboard.systemHealth')}
                  </Typography>
                  {dashboard.healthLoading && <LinearProgress sx={{ flex: 1, ml: 2 }} />}
                </Stack>
                <Stack direction="row" spacing={1} flexWrap="wrap" useFlexGap>
                  {isMaster && dashboard.healthData.services.map((svc) => {
                    const icon = svc.status === 'up'
                      ? <CheckCircleIcon />
                      : svc.status === 'disabled'
                        ? <InfoOutlinedIcon />
                        : <ErrorIcon />;
                    const color = svc.status === 'up'
                      ? 'success' as const
                      : svc.status === 'disabled'
                        ? 'default' as const
                        : 'error' as const;
                    const suffix = svc.status === 'disabled'
                      ? ' (disabled)'
                      : svc.latency_ms != null
                        ? ` (${svc.latency_ms}ms)`
                        : '';
                    return (
                      <Chip
                        key={svc.name}
                        icon={icon}
                        label={`${svc.name}${suffix}`}
                        color={color}
                        variant="outlined"
                        size="small"
                      />
                    );
                  })}
                  {isMaster && dashboard.healthData.storage && (() => {
                    const s = dashboard.healthData.storage;
                    const icon = s.status === 'up' ? <CheckCircleIcon /> : <ErrorIcon />;
                    const color = s.status === 'up' ? 'success' as const : 'error' as const;
                    const suffix = s.latency_ms != null ? ` (${s.latency_ms}ms)` : '';
                    return (
                      <Chip
                        key={s.name}
                        icon={icon}
                        label={`${s.name}${suffix}`}
                        color={color}
                        variant="outlined"
                        size="small"
                      />
                    );
                  })()}
                  <Chip
                    icon={dashboard.healthData.status === 'healthy' ? <CheckCircleIcon /> : <ErrorIcon />}
                    label={t('dashboard.overall', { status: dashboard.healthData.status })}
                    color={dashboard.healthData.status === 'healthy' ? 'success' : 'warning'}
                    size="small"
                  />
                  {dashboard.healthData.version && (
                    <Chip
                      label={`v${dashboard.healthData.version}`}
                      size="small"
                      variant="outlined"
                    />
                  )}
                </Stack>
              </Paper>
            )}

            {/* Admin: API Keys overview */}
            {isAdmin && (
              <Paper sx={{ p: 3 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                  <Typography variant="h6" component="h2">{t('dashboard.stats.apiKeys')}</Typography>
                  <Button size="small" onClick={() => navigate('/api-keys')}>
                    {t('common.actions.manage')}
                  </Button>
                </Stack>
                {dashboard.apiKeysLoading ? (
                  <Stack spacing={1}>
                    {[0, 1, 2].map((i) => (
                      <Skeleton key={i} variant="rectangular" height={40} sx={{ borderRadius: 1 }} />
                    ))}
                  </Stack>
                ) : (
                  <List disablePadding>
                    {(dashboard.apiKeysData?.data ?? []).slice(0, 5).map((key) => (
                      <ListItem key={key.id} divider>
                        <ListItemIcon sx={{ minWidth: 36 }}>
                          <KeyIcon fontSize="small" color={key.status === 'Active' ? 'primary' : 'disabled'} />
                        </ListItemIcon>
                        <ListItemText
                          primary={key.name}
                          secondary={
                            <Stack direction="row" spacing={1} alignItems="center" component="span">
                              <Chip
                                label={key.permission}
                                size="small"
                                variant="outlined"
                                sx={{ height: 20, fontSize: '0.7rem' }}
                              />
                              <Typography variant="caption" component="span">
                                {t('dashboard.requests', { count: key.total_requests.toLocaleString() } as Record<string, unknown>)}
                              </Typography>
                            </Stack>
                          }
                        />
                      </ListItem>
                    ))}
                  </List>
                )}
              </Paper>
            )}
          </Stack>
        </Grid>
      </Grid>

      <QuickPostDialog open={quickPostOpen} onClose={() => setQuickPostOpen(false)} />
    </Box>
  );
}
