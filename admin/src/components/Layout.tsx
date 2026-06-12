import { useCallback, useState, useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router';
import { styled, useTheme, type Theme, type CSSObject } from '@mui/material/styles';
import Box from '@mui/material/Box';
import MuiDrawer from '@mui/material/Drawer';
import MuiAppBar, { AppBarProps as MuiAppBarProps } from '@mui/material/AppBar';
import Typography from '@mui/material/Typography';
import Badge from '@mui/material/Badge';
import Divider from '@mui/material/Divider';
import MuiButton from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import WarningIcon from '@mui/icons-material/Warning';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { getSiteSettings, getTrashCount, leaveSite, updateSiteSettings } from '@/services/sites';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import DashboardIcon from '@mui/icons-material/Dashboard';
import ArticleIcon from '@mui/icons-material/Article';
import DescriptionIcon from '@mui/icons-material/Description';
import GavelIcon from '@mui/icons-material/Gavel';
import PermMediaIcon from '@mui/icons-material/PermMedia';
import WorkIcon from '@mui/icons-material/Work';
import FolderIcon from '@mui/icons-material/Folder';
import DynamicFormIcon from '@mui/icons-material/DynamicForm';
import CategoryIcon from '@mui/icons-material/Category';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import ShareIcon from '@mui/icons-material/Share';
import BarChartIcon from '@mui/icons-material/BarChart';
import HistoryIcon from '@mui/icons-material/History';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import TuneIcon from '@mui/icons-material/Tune';
import AltRouteIcon from '@mui/icons-material/AltRoute';
import EditNoteIcon from '@mui/icons-material/EditNote';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import { Fade } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { useSiteContext } from '@/store/SiteContext';
import { useAuth } from '@/store/AuthContext';
import { useNavigationGuardContext } from '@/store/NavigationGuardContext';
import { CommandPalette } from '@/components/command-palette';
import QuickTour from '@/components/help/QuickTour';
import ErrorBoundary from '@/components/shared/ErrorBoundary';
import { useSiteContextData } from '@/hooks/useSiteContextData';
import { useHelpState } from '@/store/HelpStateContext';
import SidebarNav from '@/components/layout/SidebarNav';
import TopBar from '@/components/layout/TopBar';
import { SidebarSiteSwitcher } from '@/components/layout/SidebarSiteSwitcher';
import SidebarUserFooter from '@/components/layout/SidebarUserFooter';
import { buildWorkspaceSections, buildAdminSections } from '@/components/layout/navConfig';
import GlobalSaveBar from '@/components/layout/GlobalSaveBar';
import { queryKeys } from '@/lib/queryKeys';

const drawerWidth = 240;
const collapsedWidth = 64;

const openedMixin = (theme: Theme): CSSObject => ({
  width: drawerWidth,
  transition: theme.transitions.create('width', {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.enteringScreen,
  }),
  overflowX: 'hidden',
});

const closedMixin = (theme: Theme): CSSObject => ({
  transition: theme.transitions.create('width', {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen,
  }),
  overflowX: 'hidden',
  width: collapsedWidth,
});

interface AppBarProps extends MuiAppBarProps {
  open?: boolean;
}

const AppBar = styled(MuiAppBar, {
  shouldForwardProp: (prop) => prop !== 'open',
})<AppBarProps>(({ theme, open }) => ({
  zIndex: theme.zIndex.drawer + 1,
  width: `calc(100% - ${collapsedWidth}px)`,
  marginLeft: collapsedWidth,
  transition: theme.transitions.create(['width', 'margin'], {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.leavingScreen,
  }),
  ...(open && {
    marginLeft: drawerWidth,
    width: `calc(100% - ${drawerWidth}px)`,
    transition: theme.transitions.create(['width', 'margin'], {
      easing: theme.transitions.easing.sharp,
      duration: theme.transitions.duration.enteringScreen,
    }),
  }),
}));

const Drawer = styled(MuiDrawer, {
  shouldForwardProp: (prop) => prop !== 'open',
})(({ theme, open }) => ({
  width: drawerWidth,
  flexShrink: 0,
  whiteSpace: 'nowrap',
  boxSizing: 'border-box',
  ...(open && {
    ...openedMixin(theme),
    '& .MuiDrawer-paper': openedMixin(theme),
  }),
  ...(!open && {
    ...closedMixin(theme),
    '& .MuiDrawer-paper': closedMixin(theme),
  }),
}));

const DrawerHeader = styled('div')(({ theme }) => ({
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: theme.spacing(0, 1),
  ...theme.mixins.toolbar,
}));

const AppBarSpacer = styled('div')(({ theme }) => ({
  ...theme.mixins.toolbar,
}));

export default function Layout() {
  const theme = useTheme();
  const location = useLocation();
  const pathname = location.pathname;
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [open, setOpen] = useState(true);
  const { selectedSiteId, selectedSite, sites, isLoading: sitesLoading } = useSiteContext();
  const { isAdmin, isOwner, isGuest, canWrite, siteId: authSiteId, logout, userFullName, userImageUrl, currentSiteRole } = useAuth();
  const { guardedNavigate } = useNavigationGuardContext();
  const { modules, context } = useSiteContextData();
  const { data: trashCount } = useQuery({
    queryKey: queryKeys.trashCount(selectedSiteId),
    queryFn: () => getTrashCount(selectedSiteId),
    enabled: !!selectedSiteId && isAdmin,
    refetchInterval: 60_000,
  });
  const { data: siteSettings } = useQuery({
    queryKey: queryKeys.siteSettings(selectedSiteId),
    queryFn: () => getSiteSettings(selectedSiteId),
    enabled: !!selectedSiteId,
  });
  const { state: helpState, tourActive, completeTour, startTour, isLoading: helpLoading } = useHelpState();
  const isSiteScoped = !!authSiteId;
  const queryClient = useQueryClient();
  const [leaveDialogOpen, setLeaveDialogOpen] = useState(false);
  const leaveSiteMutation = useMutation({
    mutationFn: () => leaveSite(selectedSiteId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.members(selectedSiteId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.sites() });
      setLeaveDialogOpen(false);
      navigate('/sites');
    },
  });

  const handleTurnOffMaintenance = useCallback(async () => {
    await updateSiteSettings(selectedSiteId, { maintenance_mode: false });
    queryClient.invalidateQueries({ queryKey: queryKeys.siteSettings(selectedSiteId) });
  }, [selectedSiteId, queryClient]);

  // Redirect to launcher if no site is selected (and not site-scoped)
  useEffect(() => {
    if (!isSiteScoped && !sitesLoading && sites && !selectedSiteId) {
      navigate('/sites', { replace: true });
    }
  }, [isSiteScoped, sitesLoading, sites, selectedSiteId, navigate]);

  // Auto-launch tour on first visit to dashboard
  useEffect(() => {
    if (
      pathname === '/' &&
      !helpState.tour_completed &&
      !tourActive &&
      !helpLoading &&
      !isGuest
    ) {
      const timer = setTimeout(startTour, 500);
      return () => clearTimeout(timer);
    }
  }, [pathname, helpState.tour_completed, tourActive, helpLoading, startTour, isGuest]);

  const trashBadge = (
    <Badge
      badgeContent={trashCount?.count ?? 0}
      color="error"
      max={99}
      aria-label={t('layout.sidebar.trash') + ` (${trashCount?.count ?? 0})`}
    >
      <DeleteOutlineIcon />
    </Badge>
  );

  const workspaceSections = buildWorkspaceSections({
    t,
    modules,
    features: context.features,
    isAdmin,
    trashBadge,
    dashboardIcon: <DashboardIcon />,
    contentIcons: {
      blog: <ArticleIcon />,
      pages: <DescriptionIcon />,
      legal: <GavelIcon />,
      portfolio: <WorkIcon />,
      documents: <FolderIcon />,
      forms: <DynamicFormIcon />,
      collections: <CategoryIcon />,
      assets: <PermMediaIcon />,
    },
    personalIcons: {
      myDrafts: <EditNoteIcon />,
      trash: <DeleteOutlineIcon />,
    },
    structureIcons: {
      navigation: <MenuBookIcon />,
      taxonomy: <LocalOfferIcon />,
      socialLinks: <ShareIcon />,
      redirects: <AltRouteIcon />,
    },
    analyticsIcon: <BarChartIcon />,
  });

  const adminSections = buildAdminSections({
    t,
    isAdmin,
    icons: {
      siteSettings: <TuneIcon />,
      activity: <HistoryIcon />,
    },
  });

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <Box sx={{ display: 'flex' }}>
      <Box
        component="a"
        href="#main-content"
        sx={{
          position: 'absolute',
          left: '-9999px',
          zIndex: 9999,
          padding: '1rem',
          background: 'background.paper',
          color: 'text.primary',
          '&:focus': {
            left: '50%',
            transform: 'translateX(-50%)',
            top: 0,
          },
        }}
      >
        {t('common.skipToMain')}
      </Box>
      <AppBar
        position="fixed"
        open={open}
        elevation={0}
        sx={{
          bgcolor: 'var(--surface)',
          color: 'var(--on-surface)',
          borderBottom: '1px solid var(--outline-variant)',
          backgroundImage: 'none',
        }}
      >
        <TopBar
          onLogout={handleLogout}
          onLeaveSite={() => setLeaveDialogOpen(true)}
        />
      </AppBar>
      <Drawer variant="permanent" open={open} slotProps={{ paper: { component: 'nav' as const, 'aria-label': 'Main navigation' } }}>
        <DrawerHeader sx={{ justifyContent: open ? 'space-between' : 'center', px: open ? 2 : 0 }}>
          <SidebarSiteSwitcher
            site={selectedSite}
            fallbackName={t('common.appName')}
            currentRole={currentSiteRole}
            isSiteScoped={isSiteScoped}
            open={open}
            theme={theme}
            onToggleDrawer={() => setOpen(!open)}
            onSwitchSite={() => guardedNavigate('/sites')}
            onOpenDetails={
              selectedSite ? () => guardedNavigate('/site-detail') : undefined
            }
          />
        </DrawerHeader>
        <Divider />
        <SidebarNav
          sections={workspaceSections}
          adminSections={adminSections}
          currentPath={pathname}
          open={open}
          theme={theme}
          onNavigate={guardedNavigate}
        />
        <Box sx={{ flexGrow: 1 }} />
        <Divider />
        <SidebarUserFooter
          userFullName={userFullName}
          userImageUrl={userImageUrl}
          currentRole={currentSiteRole}
          isGuest={isGuest}
          open={open}
          onLogout={handleLogout}
        />
      </Drawer>
      <Box
        id="main-content"
        component="main"
        role="main"
        sx={{
          flexGrow: 1,
          minHeight: '100vh',
          transition: theme.transitions.create(['width', 'margin'], {
            easing: theme.transitions.easing.sharp,
            duration: open
              ? theme.transitions.duration.enteringScreen
              : theme.transitions.duration.leavingScreen,
          }),
        }}
      >
        <AppBarSpacer />

        {/* Page chrome: single consistent container so every route has the
            same max-width, horizontal centring, and padding. Pages should
            NOT add their own maxWidth or outer padding — render content
            directly (typically starting with a SectionHead/PageHeader).
            Demo-mode banners live inside the site-settings Overview page
            so they flow with content instead of pushing the page down. */}
        <Box
          sx={{
            maxWidth: 1400,
            mx: 'auto',
            px: { xs: 2, md: 4 },
            py: 3,
          }}
        >
          {siteSettings?.maintenance_mode && (
            <Paper
              elevation={0}
              sx={{
                p: 1.5,
                mb: 2,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                bgcolor: 'warning.main',
                color: 'warning.contrastText',
                borderRadius: 3,
              }}
              data-testid="maintenance-mode-banner"
            >
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <WarningIcon fontSize="small" />
                <Typography variant="body2" sx={{ fontWeight: 600 }}>
                  {t('settings.featureToggles.maintenanceModeActive', 'Maintenance mode is active — your site is not accessible to visitors.')}
                </Typography>
              </Box>
              {(isAdmin || isOwner) && (
                <MuiButton
                  size="small"
                  variant="contained"
                  color="inherit"
                  sx={{ color: 'warning.main', bgcolor: 'warning.contrastText', whiteSpace: 'nowrap' }}
                  onClick={handleTurnOffMaintenance}
                  data-testid="maintenance-mode-turn-off"
                >
                  {t('settings.featureToggles.turnOffMaintenance', 'Turn Off')}
                </MuiButton>
              )}
            </Paper>
          )}
          <ErrorBoundary key={pathname}>
            <Fade
              in
              key={pathname}
              timeout={320}
              easing={{ enter: 'cubic-bezier(0.05, 0.7, 0.1, 1)', exit: 'cubic-bezier(0.3, 0, 0.8, 0.15)' }}
            >
              <Box
                sx={(!canWrite) ? {
                // Disable all form inputs for read-only users
                '& .MuiInputBase-root': { pointerEvents: 'none' },
                '& .MuiInputBase-input': { color: 'text.secondary' },
                '& .MuiSwitch-root, & .MuiCheckbox-root, & .MuiRadio-root, & .MuiRating-root': {
                  pointerEvents: 'none',
                  opacity: 0.6,
                },
                '& [contenteditable], & .tiptap.ProseMirror': {
                  pointerEvents: 'none',
                  opacity: 0.7,
                },
                // Disable toggle buttons (featured, comments, etc.)
                '& .MuiToggleButton-root': {
                  pointerEvents: 'none',
                  opacity: 0.6,
                },
                // Hide write-action buttons by data-testid convention
                '& [data-testid*="btn.create"], & [data-testid*="btn.add"], & [data-testid*="btn.delete"], & [data-testid*="btn.save"], & [data-testid*="btn.submit"]': {
                  display: 'none',
                },
              } : undefined}
            >
                <Outlet />
              </Box>
            </Fade>
          </ErrorBoundary>
          <GlobalSaveBar />
        </Box>
      </Box>
      <CommandPalette />
      <QuickTour active={tourActive} onComplete={completeTour} />
      <ConfirmDialog
        open={leaveDialogOpen}
        title={t('members.leaveConfirm.title', { siteName: selectedSite?.name })}
        message={t('members.leaveConfirm.message')}
        confirmLabel={t('members.leaveConfirm.confirm')}
        confirmColor="error"
        onConfirm={() => leaveSiteMutation.mutate()}
        onCancel={() => setLeaveDialogOpen(false)}
        loading={leaveSiteMutation.isPending}
      />
    </Box>
  );
}
