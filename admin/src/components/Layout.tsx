import { useState } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router';
import { styled, useTheme, type Theme, type CSSObject } from '@mui/material/styles';
import Box from '@mui/material/Box';
import MuiDrawer from '@mui/material/Drawer';
import MuiAppBar, { AppBarProps as MuiAppBarProps } from '@mui/material/AppBar';
import Toolbar from '@mui/material/Toolbar';
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
import WebIcon from '@mui/icons-material/Web';
import ArticleIcon from '@mui/icons-material/Article';
import DescriptionIcon from '@mui/icons-material/Description';
import PermMediaIcon from '@mui/icons-material/PermMedia';
import WorkIcon from '@mui/icons-material/Work';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import ShareIcon from '@mui/icons-material/Share';
import HistoryIcon from '@mui/icons-material/History';
import PeopleIcon from '@mui/icons-material/People';
import PersonAddIcon from '@mui/icons-material/PersonAdd';
import RateReviewIcon from '@mui/icons-material/RateReview';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import LanguageIcon from '@mui/icons-material/Language';
import SettingsIcon from '@mui/icons-material/Settings';
import WebhookIcon from '@mui/icons-material/Webhook';
import AltRouteIcon from '@mui/icons-material/AltRoute';
import IntegrationInstructionsIcon from '@mui/icons-material/IntegrationInstructions';
import EditNoteIcon from '@mui/icons-material/EditNote';
import LogoutIcon from '@mui/icons-material/Logout';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import PersonIcon from '@mui/icons-material/Person';
import { Avatar, Chip, ListSubheader, Menu, MenuItem, TextField, Tooltip, Fade } from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import { useTranslation } from 'react-i18next';
import { useSiteContext } from '@/store/SiteContext';
import { useAuth } from '@/store/AuthContext';
import { useNavigationGuardContext } from '@/store/NavigationGuardContext';
import { CommandPalette } from '@/components/command-palette';
import NotificationBell from '@/components/notifications/NotificationBell';
import ErrorBoundary from '@/components/shared/ErrorBoundary';
import { useSiteContextData } from '@/hooks/useSiteContextData';

const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
const modifierKey = isMac ? '⌘' : 'Ctrl+';
const shortcutLabel = `${modifierKey}K`;

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
  const [anchorElUser, setAnchorElUser] = useState<null | HTMLElement>(null);
  const { selectedSiteId, setSelectedSiteId, sites } = useSiteContext();
  const { isAdmin, canManageMembers, siteId: authSiteId, logout, userFullName, userImageUrl } = useAuth();
  const { guardedNavigate } = useNavigationGuardContext();
  const { modules, context } = useSiteContextData();
  const isSolo = context.member_count <= 1;
  const isTeamWithWorkflow = !isSolo && context.features.editorial_workflow;

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
    {
      label: t('layout.sidebar.site'),
      items: [
        { text: t('layout.sidebar.socialLinks'), icon: <ShareIcon />, path: '/social-links' },
        { text: t('layout.sidebar.redirects'), icon: <AltRouteIcon />, path: '/redirects' },
        ...(isAdmin ? [{ text: t('layout.sidebar.webhooks'), icon: <WebhookIcon />, path: '/webhooks' }] : []),
        ...(isAdmin ? [{ text: t('layout.sidebar.activity'), icon: <HistoryIcon />, path: '/activity' }] : []),
        ...(isSolo && (canManageMembers || isAdmin)
          ? [{ text: t('layout.sidebar.invite'), icon: <PersonAddIcon />, path: '/members' }]
          : (canManageMembers || isAdmin)
            ? [{ text: t('layout.sidebar.members'), icon: <PeopleIcon />, path: '/members' }]
            : []),
        ...(isTeamWithWorkflow ? [{ text: t('layout.sidebar.reviews'), icon: <RateReviewIcon />, path: '/my-drafts' }] : []),
        ...(modules.ai && isAdmin ? [{ text: t('layout.sidebar.aiSettings'), icon: <AutoAwesomeIcon />, path: '/ai-settings' }] : []),
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
        <Toolbar>
          <Tooltip title={authSiteId ? t('common.lockedByScope') : ''} arrow>
            <TextField
              select
              size="small"
              value={selectedSiteId}
              onChange={(e) => setSelectedSiteId(e.target.value)}
              disabled={!!authSiteId}
              data-testid="layout.btn.site-selector"
              inputProps={{ 'aria-label': t('layout.toolbar.siteSelector') }}
              sx={{
                mx: 3,
                minWidth: 180,
                '& .MuiOutlinedInput-root': {
                  color: 'inherit',
                  '& fieldset': { borderColor: 'rgba(255,255,255,0.3)' },
                  '&:hover fieldset': { borderColor: 'rgba(255,255,255,0.5)' },
                  '&.Mui-focused fieldset': { borderColor: 'rgba(255,255,255,1)' },
                  '&.Mui-disabled': {
                    color: 'rgba(255,255,255,0.7)',
                    '& fieldset': { borderColor: 'rgba(255,255,255,0.2)' },
                  },
                },
                '& .MuiSvgIcon-root': { color: 'inherit' },
                '& .MuiSelect-select': { py: 0.75 },
              }}
              SelectProps={{
                displayEmpty: true,
                renderValue: (value: unknown) => {
                  if (!value) return <em style={{ opacity: 0.7 }}>{t('common.selectSite')}</em> as React.ReactNode;
                  const site = sites?.find((s) => s.id === value);
                  return (site?.name || String(value)) as React.ReactNode;
                },
              }}
            >
            <MenuItem value="">
              <em>{t('common.noSiteOption')}</em>
            </MenuItem>
            {sites?.map((s) => (
              <MenuItem key={s.id} value={s.id}>{s.name}</MenuItem>
            ))}
            </TextField>
          </Tooltip>

          <Box sx={{ flexGrow: 1 }} />

          <Tooltip title={shortcutLabel}>
            <IconButton
              color="inherit"
              aria-label={t('commandPalette.open')}
              data-testid="layout.btn.search"
              onClick={() => {
                window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: isMac, ctrlKey: !isMac }));
              }}
            >
              <SearchIcon />
              <Chip
                label={shortcutLabel}
                size="small"
                sx={{
                  ml: 0.5,
                  height: 20,
                  fontSize: '0.65rem',
                  bgcolor: 'rgba(255,255,255,0.15)',
                  color: 'inherit',
                }}
              />
            </IconButton>
          </Tooltip>

          <Box sx={{ flexGrow: 1 }} />

          <NotificationBell />

          <Box sx={{ flexGrow: 0, ml: 1.5 }}>
            <Tooltip title={t('layout.toolbar.account')}>
              <IconButton
                onClick={(e) => setAnchorElUser(e.currentTarget)}
                aria-haspopup="true"
                aria-expanded={Boolean(anchorElUser)}
                data-testid="layout.btn.user-menu"
                sx={{ p: 0 }}
              >
                <Avatar alt={userFullName || 'User'} src={userImageUrl || undefined} sx={{ width: 32, height: 32 }} />
              </IconButton>
            </Tooltip>
            <Menu
              sx={{ mt: '45px', '& .MuiMenuItem-root': { gap: 1.5 } }}
              id="menu-appbar"
              anchorEl={anchorElUser}
              anchorOrigin={{ vertical: 'top', horizontal: 'right' }}
              keepMounted
              transformOrigin={{ vertical: 'top', horizontal: 'right' }}
              open={Boolean(anchorElUser)}
              onClose={() => setAnchorElUser(null)}
            >
              <MenuItem onClick={() => { setAnchorElUser(null); navigate('/profile'); }}>
                <ListItemIcon><PersonIcon fontSize="small" /></ListItemIcon>
                <ListItemText>{t('layout.toolbar.profile')}</ListItemText>
              </MenuItem>
              <Divider />
              <MenuItem onClick={() => { setAnchorElUser(null); navigate('/sites'); }}>
                <ListItemIcon><WebIcon fontSize="small" /></ListItemIcon>
                <ListItemText>{t('layout.accountMenu.sites')}</ListItemText>
              </MenuItem>
              {isAdmin && (
                <MenuItem onClick={() => { setAnchorElUser(null); navigate('/locales'); }}>
                  <ListItemIcon><LanguageIcon fontSize="small" /></ListItemIcon>
                  <ListItemText>{t('layout.accountMenu.locales')}</ListItemText>
                </MenuItem>
              )}
              <MenuItem onClick={() => { setAnchorElUser(null); navigate('/api-docs'); }}>
                <ListItemIcon><IntegrationInstructionsIcon fontSize="small" /></ListItemIcon>
                <ListItemText>{t('layout.accountMenu.apiDocs')}</ListItemText>
              </MenuItem>
              <Divider />
              <MenuItem onClick={handleLogout}>
                <ListItemIcon><LogoutIcon fontSize="small" /></ListItemIcon>
                <ListItemText>{t('layout.sidebar.logout')}</ListItemText>
              </MenuItem>
            </Menu>
          </Box>
        </Toolbar>
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
        {menuSections.map((section, idx) => (
          <List
            key={idx}
            subheader={
              section.label ? (
                <ListSubheader
                  sx={{
                    lineHeight: '36px',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                    opacity: open ? 1 : 0,
                    transition: theme.transitions.create('opacity', {
                      duration: theme.transitions.duration.shorter,
                    }),
                    whiteSpace: 'nowrap',
                    ...(open ? {} : { px: 0, height: 12 }),
                  }}
                >
                  {open ? section.label : ''}
                </ListSubheader>
              ) : undefined
            }
          >
            {!open && section.label && <Divider sx={{ mx: 1, my: 0.5 }} />}
            {section.items.map((item) => {
              const isActive = location.pathname === item.path || location.pathname.startsWith(item.path + '/');
              return (
                <ListItem key={item.path} disablePadding sx={{ display: 'block' }}>
                  <Tooltip title={open ? '' : item.text} placement="right" arrow>
                    <ListItemButton
                      selected={isActive}
                      aria-current={isActive ? 'page' : undefined}
                      data-testid={`layout.nav.${item.path.replace(/^\//, '')}`}
                      onClick={() => guardedNavigate(item.path)}
                      sx={{
                        minHeight: 44,
                        px: 2.5,
                        justifyContent: open ? 'initial' : 'center',
                        borderRadius: open ? '0 24px 24px 0' : '50%',
                        mx: open ? 0 : 1,
                        my: 0.25,
                        ...(isActive && {
                          bgcolor: 'primary.main',
                          color: 'primary.contrastText',
                          '&:hover': { bgcolor: 'primary.dark' },
                          '& .MuiListItemIcon-root': { color: 'primary.contrastText' },
                        }),
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
                        {item.icon}
                      </ListItemIcon>
                      <ListItemText
                        primary={item.text}
                        primaryTypographyProps={{ fontSize: '0.875rem', fontWeight: isActive ? 600 : 400 }}
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
              );
            })}
          </List>
        ))}
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
    </Box>
  );
}
