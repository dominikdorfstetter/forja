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
import PeopleIcon from '@mui/icons-material/People';
import DescriptionIcon from '@mui/icons-material/Description';
import DnsIcon from '@mui/icons-material/Dns';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import EditNoteIcon from '@mui/icons-material/EditNote';
import AddIcon from '@mui/icons-material/Add';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import apiService from '@/services/api';
import { resolveError } from '@/utils/errorResolver';
import { useAuth } from '@/store/AuthContext';
import { useSiteContext } from '@/store/SiteContext';
import Onboarding from '@/components/Onboarding';
import SetupChecklist from '@/components/SetupChecklist';
import SiteFormDialog from '@/components/sites/SiteFormDialog';
import type { CreateSiteRequest } from '@/types/api';


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

function StatCard({
  icon,
  label,
  value,
  loading,
  onClick,
}: {
  icon: React.ReactNode;
  label: string;
  value: number | string;
  loading?: boolean;
  onClick?: () => void;
}) {
  return (
    <Card
      sx={{
        height: '100%',
        cursor: onClick ? 'pointer' : 'default',
        transition: 'box-shadow 0.2s',
        '&:hover': onClick ? { boxShadow: 6 } : undefined,
      }}
      onClick={onClick}
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
  const { enqueueSnackbar } = useSnackbar();
  const { permission, isMaster, isAdmin, canWrite, isSystemAdmin, currentSiteRole, isOwner, refreshAuth } = useAuth();
  const { selectedSiteId, selectedSite, sites, isLoading: sitesLoading2 } = useSiteContext();
  const { setSelectedSiteId } = useSiteContext();

  const [siteFormOpen, setSiteFormOpen] = useState(false);

  const hasSite = !!selectedSiteId;
  const hasNoSites = !sitesLoading2 && (!sites || sites.length === 0);

  const createSiteMutation = useMutation({
    mutationFn: (data: CreateSiteRequest) => apiService.createSite(data),
    onSuccess: async (newSite) => {
      await refreshAuth();
      queryClient.invalidateQueries({ queryKey: ['sites'] });
      setSelectedSiteId(newSite.id);
      setSiteFormOpen(false);
      enqueueSnackbar(t('sites.messages.created'), { variant: 'success' });
    },
    onError: (error) => {
      const { detail, title } = resolveError(error);
      enqueueSnackbar(detail || title, { variant: 'error' });
    },
  });

  // Derive effective permission level (combines API key permission + site role)
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

  // ---------- Queries shared across roles ----------

  const { data: sitesData, isLoading: sitesLoading } = useQuery({
    queryKey: ['sites'],
    queryFn: () => apiService.getSites(),
  });

  const { data: blogsData, isLoading: blogsLoading } = useQuery({
    queryKey: ['blogs', selectedSiteId],
    queryFn: () => apiService.getBlogs(selectedSiteId, { page: 1, per_page: 5 }),
    enabled: hasSite,
  });

  const { data: pagesData, isLoading: pagesLoading } = useQuery({
    queryKey: ['pages', selectedSiteId],
    queryFn: () => apiService.getPages(selectedSiteId, { page: 1, per_page: 100 }),
    enabled: hasSite,
  });

  const { data: mediaData, isLoading: mediaLoading } = useQuery({
    queryKey: ['media', selectedSiteId],
    queryFn: () => apiService.getMedia(selectedSiteId, { page: 1, per_page: 1 }),
    enabled: hasSite,
  });

  // ---------- Admin+ queries ----------

  const { data: apiKeysData, isLoading: apiKeysLoading } = useQuery({
    queryKey: ['apiKeys', selectedSiteId],
    queryFn: () => apiService.getApiKeys({
      site_id: isMaster ? undefined : selectedSiteId || undefined,
    }),
    enabled: isAdmin && (isMaster || !!selectedSiteId),
  });

  const { data: healthData, isLoading: healthLoading } = useQuery({
    queryKey: ['health'],
    queryFn: () => apiService.getHealth(),
    refetchInterval: 30_000,
  });

  // ---------- Setup checklist queries ----------

  const { data: siteLocales } = useQuery({
    queryKey: ['siteLocales', selectedSiteId],
    queryFn: () => apiService.getSiteLocales(selectedSiteId!),
    enabled: hasSite,
  });

  const { data: navMenus } = useQuery({
    queryKey: ['navigationMenus', selectedSiteId],
    queryFn: () => apiService.getNavigationMenus(selectedSiteId!),
    enabled: hasSite,
  });

  const checklistKey = `openyapper_checklist_dismissed_${selectedSiteId}`;
  const [checklistDismissed, setChecklistDismissed] = useState(
    () => !!selectedSiteId && localStorage.getItem(`openyapper_checklist_dismissed_${selectedSiteId}`) === '1',
  );

  // Sync dismissed state when switching sites
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

  // ---------- Derived data ----------

  const totalBlogs = blogsData?.meta?.total_items ?? 0;
  const totalPages = pagesData?.meta?.total_items ?? 0;
  const totalMedia = mediaData?.meta?.total_items ?? 0;
  const recentBlogs = blogsData?.data ?? [];

  const draftBlogs = recentBlogs.filter((b) => b.status === 'Draft');
  const draftPages = (pagesData?.data ?? []).filter((p) => p.status === 'Draft');
  const publishedBlogs = recentBlogs.filter((b) => b.status === 'Published');

  const hasLocales = (siteLocales ?? []).length > 0;
  const hasNavigation = (navMenus ?? []).length > 0;
  const showChecklist = hasSite && !checklistDismissed;

  // ---------- Render ----------

  // Show onboarding for new users with no sites
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
    <Box>
      {/* Header */}
      <Stack direction="row" alignItems="center" spacing={2} sx={{ mb: 1 }}>
        <Typography variant="h4" component="h1" fontWeight="bold">
          {t('dashboard.title')}
        </Typography>
        {meta && (
          <Chip label={t(meta.labelKey)} color={meta.color} size="small" variant="outlined" />
        )}
      </Stack>

      <Typography variant="subtitle1" color="text.secondary" sx={{ mb: 3 }}>
        {selectedSite
          ? t('dashboard.managing', { name: selectedSite.name })
          : t('dashboard.selectSitePrompt')}
      </Typography>

      {/* Setup checklist for new sites */}
      {showChecklist && (
        <SetupChecklist
          hasLocales={hasLocales}
          hasPages={totalPages > 0}
          hasBlogs={totalBlogs > 0}
          hasNavigation={hasNavigation}
          onDismiss={dismissChecklist}
        />
      )}

      {/* Read-only notice (only for actual read-only users, not system admins) */}
      {effectivePermission === 'Read' && (
        <Alert severity="info" sx={{ mb: 3 }}>
          <span dangerouslySetInnerHTML={{ __html: t('dashboard.readOnlyNotice') }} />
        </Alert>
      )}

      {/* ================================================================ */}
      {/* System health — simple for site owners, detailed for sysadmins */}
      {/* ================================================================ */}
      {healthData && (
        <Paper sx={{ p: 2.5, mb: 3 }}>
          <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 1.5 }}>
            <DnsIcon color="primary" fontSize="small" />
            <Typography variant="subtitle2" component="h2" fontWeight={600}>
              {t('dashboard.systemHealth')}
            </Typography>
            {healthLoading && <LinearProgress sx={{ flex: 1, ml: 2 }} />}
          </Stack>
          <Stack direction="row" spacing={3} flexWrap="wrap">
            {/* System admins see per-service details */}
            {isMaster && healthData.services.map((svc) => {
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
            {isMaster && healthData.storage && (() => {
              const s = healthData.storage;
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
            {/* Everyone sees overall status */}
            <Chip
              icon={healthData.status === 'healthy' ? <CheckCircleIcon /> : <ErrorIcon />}
              label={t('dashboard.overall', { status: healthData.status })}
              color={healthData.status === 'healthy' ? 'success' : 'warning'}
              size="small"
            />
          </Stack>
        </Paper>
      )}

      {/* ================================================================ */}
      {/* Stat cards — tailored by role */}
      {/* ================================================================ */}
      <Grid container spacing={3} sx={{ mb: 3 }}>
        {/* All roles: Sites */}
        <Grid size={{ xs: 12, sm: 6, md: 3 }}>
          <StatCard
            icon={<WebIcon color="primary" />}
            label={t('dashboard.stats.sites')}
            value={sitesData?.length ?? 0}
            loading={sitesLoading}
            onClick={() => navigate('/sites')}
          />
        </Grid>

        {/* All roles with site selected: Blogs */}
        {hasSite && (
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <StatCard
              icon={<ArticleIcon color="primary" />}
              label={t('dashboard.stats.blogPosts')}
              value={totalBlogs}
              loading={blogsLoading}
              onClick={() => navigate('/blogs')}
            />
          </Grid>
        )}

        {/* All roles with site selected: Pages */}
        {hasSite && (
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <StatCard
              icon={<DescriptionIcon color="primary" />}
              label={t('dashboard.stats.pages')}
              value={totalPages}
              loading={pagesLoading}
              onClick={() => navigate('/pages')}
            />
          </Grid>
        )}

        {/* All roles with site selected: Media */}
        {hasSite && (
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <StatCard
              icon={<ImageIcon color="primary" />}
              label={t('dashboard.stats.mediaFiles')}
              value={totalMedia}
              loading={mediaLoading}
              onClick={() => navigate('/media')}
            />
          </Grid>
        )}

        {/* Admin+: API Keys */}
        {isAdmin && (
          <Grid size={{ xs: 12, sm: 6, md: 3 }}>
            <StatCard
              icon={<KeyIcon color="primary" />}
              label={t('dashboard.stats.apiKeys')}
              value={apiKeysData?.meta?.total_items ?? apiKeysData?.data?.length ?? 0}
              loading={apiKeysLoading}
              onClick={() => navigate('/api-keys')}
            />
          </Grid>
        )}
      </Grid>

      {/* ================================================================ */}
      {/* Bottom panels */}
      {/* ================================================================ */}
      <Grid container spacing={3}>
        {/* ---- Left column: Recent / Draft blogs ---- */}
        {hasSite && (
          <Grid size={{ xs: 12, md: canWrite ? 6 : 12 }}>
            <Paper sx={{ p: 3, height: '100%' }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                <Typography variant="h6" component="h2">
                  {canWrite ? t('dashboard.recentPosts') : t('dashboard.publishedPosts')}
                </Typography>
                {canWrite && (
                  <Button
                    size="small"
                    startIcon={<AddIcon />}
                    onClick={() => navigate('/blogs')}
                  >
                    {t('dashboard.newPost')}
                  </Button>
                )}
              </Stack>

              {blogsLoading ? (
                <Stack spacing={1}>
                  {[0, 1, 2].map((i) => (
                    <Skeleton key={i} variant="rectangular" height={48} sx={{ borderRadius: 1 }} />
                  ))}
                </Stack>
              ) : recentBlogs.length === 0 ? (
                <Typography color="text.secondary" sx={{ py: 4, textAlign: 'center' }}>
                  {canWrite ? t('dashboard.noPostsCreate') : t('dashboard.noPosts')}
                </Typography>
              ) : (
                <List disablePadding>
                  {(canWrite ? recentBlogs : publishedBlogs).map((blog) => (
                    <ListItem
                      key={blog.id}
                      divider
                      sx={{ cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}
                      onClick={() => navigate(`/blogs/${blog.id}`)}
                    >
                      <ListItemIcon sx={{ minWidth: 36 }}>
                        {blog.status === 'Draft' ? (
                          <EditNoteIcon color="warning" fontSize="small" />
                        ) : (
                          <VisibilityIcon color="success" fontSize="small" />
                        )}
                      </ListItemIcon>
                      <ListItemText
                        primary={blog.slug || t('common.labels.untitled')}
                        secondary={
                          <Stack direction="row" spacing={1} alignItems="center" component="span">
                            <Chip
                              label={blog.status}
                              size="small"
                              color={blog.status === 'Published' ? 'success' : blog.status === 'Draft' ? 'warning' : 'default'}
                              variant="outlined"
                              sx={{ height: 20, fontSize: '0.7rem' }}
                            />
                            <Typography variant="caption" color="text.secondary" component="span">
                              {blog.author} &middot; {blog.published_date}
                            </Typography>
                          </Stack>
                        }
                      />
                    </ListItem>
                  ))}
                </List>
              )}
            </Paper>
          </Grid>
        )}

        {/* ---- Right column: role-specific panels ---- */}
        {canWrite && hasSite && (
          <Grid size={{ xs: 12, md: 6 }}>
            <Stack spacing={3}>
              {/* Drafts needing attention (Write+) */}
              <Paper sx={{ p: 3 }}>
                <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                  <Typography variant="h6" component="h2">
                    {t('dashboard.drafts')}
                  </Typography>
                  <Button size="small" onClick={() => navigate('/my-drafts')}>
                    {t('dashboard.viewAllDrafts')}
                  </Button>
                </Stack>
                {blogsLoading ? (
                  <Skeleton variant="rectangular" height={60} sx={{ borderRadius: 1 }} />
                ) : draftBlogs.length === 0 && draftPages.length === 0 ? (
                  <Alert severity="success" variant="outlined">
                    {t('dashboard.noDrafts')}
                  </Alert>
                ) : (
                  <List disablePadding>
                    {draftBlogs.map((blog) => (
                      <ListItem
                        key={blog.id}
                        divider
                        sx={{ cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}
                        onClick={() => navigate(`/blogs/${blog.id}`)}
                      >
                        <ListItemIcon sx={{ minWidth: 36 }}>
                          <EditNoteIcon color="warning" fontSize="small" />
                        </ListItemIcon>
                        <ListItemText
                          primary={blog.slug || t('common.labels.untitled')}
                          secondary={t('dashboard.byAuthor', { author: blog.author })}
                        />
                        <Chip label={t('layout.sidebar.blogs')} size="small" variant="outlined" sx={{ height: 20, fontSize: '0.65rem' }} />
                      </ListItem>
                    ))}
                    {draftPages.map((pg) => (
                      <ListItem
                        key={pg.id}
                        divider
                        sx={{ cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}
                        onClick={() => navigate(`/pages/${pg.id}`)}
                      >
                        <ListItemIcon sx={{ minWidth: 36 }}>
                          <DescriptionIcon color="warning" fontSize="small" />
                        </ListItemIcon>
                        <ListItemText
                          primary={pg.route || t('common.labels.untitled')}
                          secondary={pg.page_type}
                        />
                        <Chip label={t('layout.sidebar.pages')} size="small" variant="outlined" sx={{ height: 20, fontSize: '0.65rem' }} />
                      </ListItem>
                    ))}
                  </List>
                )}
              </Paper>

              {/* Quick actions (Write+) */}
              <Paper sx={{ p: 3 }}>
                <Typography variant="h6" component="h2" sx={{ mb: 2 }}>
                  {t('dashboard.quickActions')}
                </Typography>
                <Stack direction="row" spacing={1.5} flexWrap="wrap" useFlexGap>
                  <Button variant="outlined" startIcon={<ArticleIcon />} onClick={() => navigate('/blogs')}>
                    {t('layout.sidebar.blogs')}
                  </Button>
                  <Button variant="outlined" startIcon={<DescriptionIcon />} onClick={() => navigate('/pages')}>
                    {t('layout.sidebar.pages')}
                  </Button>
                  <Button variant="outlined" startIcon={<ImageIcon />} onClick={() => navigate('/media')}>
                    {t('layout.sidebar.media')}
                  </Button>
                  {isAdmin && (
                    <Button variant="outlined" startIcon={<PeopleIcon />} onClick={() => navigate('/members')}>
                      {t('layout.sidebar.members')}
                    </Button>
                  )}
                  {isMaster && (
                    <Button variant="outlined" startIcon={<KeyIcon />} onClick={() => navigate('/api-keys')}>
                      {t('layout.sidebar.apiKeys')}
                    </Button>
                  )}
                </Stack>
              </Paper>
            </Stack>
          </Grid>
        )}

        {/* Admin+: API Keys overview */}
        {isAdmin && (
          <Grid size={{ xs: 12, md: 6 }}>
            <Paper sx={{ p: 3 }}>
              <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}>
                <Typography variant="h6" component="h2">{t('dashboard.stats.apiKeys')}</Typography>
                <Button size="small" onClick={() => navigate('/api-keys')}>
                  {t('common.actions.manage')}
                </Button>
              </Stack>
              {apiKeysLoading ? (
                <Stack spacing={1}>
                  {[0, 1, 2].map((i) => (
                    <Skeleton key={i} variant="rectangular" height={40} sx={{ borderRadius: 1 }} />
                  ))}
                </Stack>
              ) : (
                <List disablePadding>
                  {(apiKeysData?.data ?? []).slice(0, 5).map((key) => (
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
          </Grid>
        )}

        {/* Your Sites — all roles */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper sx={{ p: 3 }}>
            <Typography variant="h6" component="h2" sx={{ mb: 1 }}>
              {t('dashboard.yourSites')}
            </Typography>
            {sitesLoading ? (
              <Stack spacing={1}>
                {[0, 1].map((i) => (
                  <Skeleton key={i} variant="rectangular" height={48} sx={{ borderRadius: 1 }} />
                ))}
              </Stack>
            ) : (
              <List disablePadding>
                {(sites ?? sitesData ?? []).map((site) => (
                  <ListItem
                    key={site.id}
                    divider
                    sx={{ cursor: 'pointer', '&:hover': { bgcolor: 'action.hover' } }}
                    onClick={() => navigate(`/sites/${site.id}`)}
                  >
                    <ListItemIcon sx={{ minWidth: 36 }}>
                      <WebIcon color={site.is_active ? 'primary' : 'disabled'} fontSize="small" />
                    </ListItemIcon>
                    <ListItemText
                      primary={site.name}
                      secondary={site.description || site.slug}
                    />
                    <Chip
                      label={site.is_active ? t('common.status.active') : t('common.status.inactive')}
                      size="small"
                      color={site.is_active ? 'success' : 'default'}
                      variant="outlined"
                      sx={{ height: 20, fontSize: '0.7rem' }}
                    />
                  </ListItem>
                ))}
                {(!sites || sites.length === 0) && (!sitesData || sitesData.length === 0) && (
                  <ListItem>
                    <ListItemText primary={t('dashboard.noSites')} secondary={t('dashboard.noSitesCreate')} />
                  </ListItem>
                )}
              </List>
            )}
          </Paper>
        </Grid>
      </Grid>
    </Box>
  );
}
