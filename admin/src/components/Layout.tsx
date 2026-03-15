import { useState, useEffect } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router';
import { styled, useTheme, type Theme, type CSSObject } from '@mui/material/styles';
import Box from '@mui/material/Box';
import MuiDrawer from '@mui/material/Drawer';
import MuiAppBar, { AppBarProps as MuiAppBarProps } from '@mui/material/AppBar';
import List from '@mui/material/List';
import Typography from '@mui/material/Typography';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import DashboardIcon from '@mui/icons-material/Dashboard';
import ArticleIcon from '@mui/icons-material/Article';
import DescriptionIcon from '@mui/icons-material/Description';
import PermMediaIcon from '@mui/icons-material/PermMedia';
import WorkIcon from '@mui/icons-material/Work';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import ShareIcon from '@mui/icons-material/Share';
import BarChartIcon from '@mui/icons-material/BarChart';
import HistoryIcon from '@mui/icons-material/History';
import PeopleIcon from '@mui/icons-material/People';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import RateReviewIcon from '@mui/icons-material/RateReview';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import SettingsIcon from '@mui/icons-material/Settings';
import WebhookIcon from '@mui/icons-material/Webhook';
import AltRouteIcon from '@mui/icons-material/AltRoute';
import EditNoteIcon from '@mui/icons-material/EditNote';
import HubIcon from '@mui/icons-material/Hub';
import LogoutIcon from '@mui/icons-material/Logout';
import { Tooltip, Fade } from '@mui/material';
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
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [open, setOpen] = useState(true);
  const { selectedSiteId, setSelectedSiteId, sites } = useSiteContext();
  const { isAdmin, canManageMembers, siteId: authSiteId, logout, userFullName, userImageUrl } = useAuth();
  const { guardedNavigate } = useNavigationGuardContext();
  const { modules, context } = useSiteContextData();
  const { state: helpState, tourActive, completeTour, startTour, isLoading: helpLoading } = useHelpState();
  const isSolo = context.member_count <= 1;
  const isTeamWithWorkflow = !isSolo && context.features.editorial_workflow;

  // Auto-launch tour on first visit to dashboard
  useEffect(() => {
    if (
      location.pathname === '/dashboard' &&
      !helpState.tour_completed &&
      !tourActive &&
      !helpLoading
    ) {
      const timer = setTimeout(startTour, 500);
      return () => clearTimeout(timer);
    }
  }, [location.pathname, helpState.tour_completed, tourActive, helpLoading, startTour]);

  // Sidebar: site-workspace items only
  const allMenuSections = [
    {
      items: [
        { text: t('layout.sidebar.dashboard'), icon: <DashboardIcon />, path: '/dashboard' },
        { text: t('layout.sidebar.myDrafts'), icon: <EditNoteIcon />, path: '/my-drafts' },
      ],
    },
    {
      label: t('layout.sidebar.content'),
      items: [
        ...(modules.blog ? [{ text: t('layout.sidebar.blogs'), icon: <ArticleIcon />, path: '/blogs' }] : []),
        ...(modules.pages ? [{ text: t('layout.sidebar.pages'), icon: <DescriptionIcon />, path: '/pages' }] : []),
        { text: t('layout.sidebar.assets'), icon: <PermMediaIcon />, path: '/media' },
        ...(modules.cv ? [{ text: t('layout.sidebar.cv'), icon: <WorkIcon />, path: '/cv' }] : []),
      ],
    },
    {
      label: t('layout.sidebar.structure'),
      items: [
        { text: t('layout.sidebar.navigation'), icon: <MenuBookIcon />, path: '/navigation' },
        { text: t('layout.sidebar.taxonomy'), icon: <LocalOfferIcon />, path: '/taxonomy' },
      ],
    },
    ...(modules.federation ? [{
      label: t('layout.sidebar.federation'),
      items: [
        { text: t('layout.sidebar.federation'), icon: <HubIcon />, path: '/federation' },
      ],
    }] : []),
    {
      label: t('layout.sidebar.site'),
      items: [
        { text: t('layout.sidebar.socialLinks'), icon: <ShareIcon />, path: '/social-links' },
        { text: t('layout.sidebar.redirects'), icon: <AltRouteIcon />, path: '/redirects' },
        ...(isAdmin ? [{ text: t('layout.sidebar.webhooks'), icon: <WebhookIcon />, path: '/webhooks' }] : []),
        ...(isAdmin ? [{ text: t('layout.sidebar.activity'), icon: <HistoryIcon />, path: '/activity' }] : []),
        ...(context.features.analytics ? [{ text: t('layout.sidebar.analytics'), icon: <BarChartIcon />, path: '/analytics' }] : []),
        ...(isSolo && (canManageMembers || isAdmin)
          ? [{ text: t('layout.sidebar.invite'), icon: <PersonAddIcon />, path: '/members' }]
          : (canManageMembers || isAdmin)
            ? [{ text: t('layout.sidebar.members'), icon: <PeopleIcon />, path: '/members' }]
            : []),
        ...(isTeamWithWorkflow ? [{ text: t('layout.sidebar.reviews'), icon: <RateReviewIcon />, path: '/my-drafts' }] : []),
        { text: t('layout.sidebar.settings'), icon: <SettingsIcon />, path: '/settings' },
      ],
    },
  ];

  // Filter out sections with no items
  const menuSections = allMenuSections.filter((s) => s.items.length > 0);

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
      <AppBar position="fixed" open={open} elevation={0} sx={{ borderBottom: '1px solid', borderColor: 'divider' }}>
        <TopBar
          selectedSiteId={selectedSiteId}
          onSiteChange={setSelectedSiteId}
          siteDisabled={!!authSiteId}
          sites={sites}
          isAdmin={isAdmin}
          userFullName={userFullName}
          userImageUrl={userImageUrl}
          onLogout={handleLogout}
        />
      </AppBar>

      <Drawer variant="permanent" open={open} PaperProps={{ component: 'nav' as const, 'aria-label': 'Main navigation' }}>
        <DrawerHeader sx={{ justifyContent: open ? 'space-between' : 'center', px: open ? 2 : 0 }}>
          {open ? (
            <>
              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                <Box
                  component="img"
                  src={`${import.meta.env.BASE_URL}icons/forja-icon.svg`}
                  alt=""
                  sx={{ width: 28, height: 28 }}
                />
                <Typography variant="h6" component="div" fontWeight={700} noWrap>
                  {t('common.appName')}
                </Typography>
              </Box>
              <IconButton
                aria-label={t('layout.toolbar.toggleDrawer')}
                data-testid="layout.btn.toggle-sidebar"
                onClick={() => setOpen(false)}
                size="small"
              >
                {theme.direction === 'rtl' ? <ChevronRightIcon /> : <ChevronLeftIcon />}
              </IconButton>
            </>
          ) : (
            <Tooltip title={t('common.appName')} placement="right" arrow>
              <IconButton
                aria-label={t('layout.toolbar.toggleDrawer')}
                data-testid="layout.btn.toggle-sidebar"
                onClick={() => setOpen(true)}
                sx={{ borderRadius: 1, px: 1 }}
              >
                <Box
                  component="img"
                  src={`${import.meta.env.BASE_URL}icons/forja-icon.svg`}
                  alt=""
                  sx={{ width: 28, height: 28 }}
                />
              </IconButton>
            </Tooltip>
          )}
        </DrawerHeader>
        <Divider />
        <SidebarNav
          sections={menuSections}
          currentPath={location.pathname}
          open={open}
          theme={theme}
          onNavigate={guardedNavigate}
        />
        <Box sx={{ flexGrow: 1 }} />
        <Divider />
        <List>
          <ListItem disablePadding sx={{ display: 'block' }}>
            <Tooltip title={open ? '' : t('layout.sidebar.logout')} placement="right" arrow>
              <ListItemButton
                onClick={handleLogout}
                data-testid="layout.btn.logout"
                sx={{
                  minHeight: 44,
                  px: 2.5,
                  justifyContent: open ? 'initial' : 'center',
                  mx: open ? 0 : 1,
                  my: 0.25,
                  borderRadius: open ? '0 24px 24px 0' : '50%',
                }}
              >
                <ListItemIcon
                  sx={{
                    minWidth: 0,
                    mr: open ? 2.5 : 'auto',
                    justifyContent: 'center',
                    transition: theme.transitions.create('margin', {
                      duration: theme.transitions.duration.shorter,
                    }),
                  }}
                >
                  <LogoutIcon />
                </ListItemIcon>
                <ListItemText
                  primary={t('layout.sidebar.logout')}
                  primaryTypographyProps={{ fontSize: '0.875rem' }}
                  sx={{
                    opacity: open ? 1 : 0,
                    transition: theme.transitions.create('opacity', {
                      duration: theme.transitions.duration.shorter,
                    }),
                  }}
                />
              </ListItemButton>
            </Tooltip>
          </ListItem>
        </List>
      </Drawer>

      <Box
        id="main-content"
        component="main"
        role="main"
        sx={{
          flexGrow: 1,
          p: 3,
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
        <ErrorBoundary key={location.pathname}>
          <Fade in key={location.pathname} timeout={300}>
            <Box>
              <Outlet />
            </Box>
          </Fade>
        </ErrorBoundary>
      </Box>
      <CommandPalette />
      <QuickTour active={tourActive} onComplete={completeTour} />
    </Box>
  );
}
