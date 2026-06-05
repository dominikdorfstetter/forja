import { useCallback, useId, useMemo, useRef, type ReactNode } from 'react';
import { useNavigate, useLocation } from 'react-router';
import {
  Dialog,
  InputAdornment,
  TextField,
  Box,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import AddIcon from '@mui/icons-material/Add';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import UploadIcon from '@mui/icons-material/Upload';
import DashboardIcon from '@mui/icons-material/Dashboard';
import ArticleIcon from '@mui/icons-material/Article';
import DescriptionIcon from '@mui/icons-material/Description';
import PermMediaIcon from '@mui/icons-material/PermMedia';
import WorkIcon from '@mui/icons-material/Work';
import MenuBookIcon from '@mui/icons-material/MenuBook';
import LocalOfferIcon from '@mui/icons-material/LocalOffer';
import ShareIcon from '@mui/icons-material/Share';
import HistoryIcon from '@mui/icons-material/History';
import PeopleIcon from '@mui/icons-material/People';
import SettingsIcon from '@mui/icons-material/Settings';
import EditNoteIcon from '@mui/icons-material/EditNote';
import BoltIcon from '@mui/icons-material/Bolt';
import ViewQuiltIcon from '@mui/icons-material/ViewQuilt';
import AltRouteIcon from '@mui/icons-material/AltRoute';
import WebhookIcon from '@mui/icons-material/Webhook';
import WebIcon from '@mui/icons-material/Web';
import LanguageIcon from '@mui/icons-material/Language';
import GavelIcon from '@mui/icons-material/Gavel';
import VpnKeyIcon from '@mui/icons-material/VpnKey';
import FolderIcon from '@mui/icons-material/Folder';
import NotificationsIcon from '@mui/icons-material/Notifications';
import BarChartIcon from '@mui/icons-material/BarChart';
import PersonIcon from '@mui/icons-material/Person';
import AdminPanelSettingsIcon from '@mui/icons-material/AdminPanelSettings';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/store/AuthContext';
import { useCommandPalette, type Command } from './useCommandPalette';
import CommandList from './CommandList';

const NAV_ICON_MAP: Record<string, ReactNode> = {
  '/': <DashboardIcon fontSize="small" />,
  '/my-drafts': <EditNoteIcon fontSize="small" />,
  '/blogs': <ArticleIcon fontSize="small" />,
  '/pages': <DescriptionIcon fontSize="small" />,
  '/blogs/templates': <ViewQuiltIcon fontSize="small" />,
  '/media': <PermMediaIcon fontSize="small" />,
  '/cv': <WorkIcon fontSize="small" />,
  '/navigation': <MenuBookIcon fontSize="small" />,
  '/taxonomy': <LocalOfferIcon fontSize="small" />,
  '/social-links': <ShareIcon fontSize="small" />,
  '/redirects': <AltRouteIcon fontSize="small" />,
  '/webhooks': <WebhookIcon fontSize="small" />,
  '/activity': <HistoryIcon fontSize="small" />,
  '/members': <PeopleIcon fontSize="small" />,
  '/site-settings': <SettingsIcon fontSize="small" />,
  '/sites': <WebIcon fontSize="small" />,
  '/locales': <LanguageIcon fontSize="small" />,
  '/legal': <GavelIcon fontSize="small" />,
  '/api-keys': <VpnKeyIcon fontSize="small" />,
  '/documents': <FolderIcon fontSize="small" />,
  '/notifications': <NotificationsIcon fontSize="small" />,
  '/analytics': <BarChartIcon fontSize="small" />,
  '/profile': <PersonIcon fontSize="small" />,
  '/system': <AdminPanelSettingsIcon fontSize="small" />,
};

function dispatchAction(detail: string) {
  window.dispatchEvent(new CustomEvent('command-palette:action', { detail }));
}

export default function CommandPalette() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const location = useLocation();
  const pathname = location.pathname;
  const { isAdmin, canWrite, canManageMembers } = useAuth();

  // Build nav commands from static routes (mirrors sidebar + account menu)
  const navCommands: Command[] = [
    { id: 'nav:dashboard', label: t('layout.sidebar.dashboard'), icon: NAV_ICON_MAP['/'], category: 'navigation', action: () => navigate('/') },
    { id: 'nav:my-drafts', label: t('layout.sidebar.myDrafts'), icon: NAV_ICON_MAP['/my-drafts'], category: 'navigation', action: () => navigate('/my-drafts') },
    { id: 'nav:blogs', label: t('layout.sidebar.blogs'), icon: NAV_ICON_MAP['/blogs'], category: 'navigation', action: () => navigate('/blogs') },
    { id: 'nav:pages', label: t('layout.sidebar.pages'), icon: NAV_ICON_MAP['/pages'], category: 'navigation', action: () => navigate('/pages') },
    ...(isAdmin ? [{ id: 'nav:content-templates', label: t('layout.sidebar.contentTemplates'), icon: NAV_ICON_MAP['/blogs/templates'], category: 'navigation' as const, action: () => navigate('/blogs/templates') }] : []),
    { id: 'nav:media', label: t('layout.sidebar.assets'), icon: NAV_ICON_MAP['/media'], category: 'navigation', action: () => navigate('/media') },
    { id: 'nav:cv', label: t('layout.sidebar.cv'), icon: NAV_ICON_MAP['/cv'], category: 'navigation', action: () => navigate('/cv') },
    { id: 'nav:navigation', label: t('layout.sidebar.navigation'), icon: NAV_ICON_MAP['/navigation'], category: 'navigation', action: () => navigate('/navigation') },
    { id: 'nav:taxonomy', label: t('layout.sidebar.taxonomy'), icon: NAV_ICON_MAP['/taxonomy'], category: 'navigation', action: () => navigate('/taxonomy') },
    { id: 'nav:social', label: t('layout.sidebar.socialLinks'), icon: NAV_ICON_MAP['/social-links'], category: 'navigation', action: () => navigate('/social-links') },
    { id: 'nav:redirects', label: t('layout.sidebar.redirects'), icon: NAV_ICON_MAP['/redirects'], category: 'navigation', action: () => navigate('/redirects') },
    { id: 'nav:sites', label: t('layout.sidebar.sites'), icon: NAV_ICON_MAP['/sites'], category: 'navigation', action: () => navigate('/sites') },
    ...(isAdmin ? [{ id: 'nav:webhooks', label: t('layout.sidebar.webhooks'), icon: NAV_ICON_MAP['/webhooks'], category: 'navigation' as const, action: () => navigate('/webhooks') }] : []),
    ...(isAdmin ? [{ id: 'nav:activity', label: t('layout.sidebar.activity'), icon: NAV_ICON_MAP['/activity'], category: 'navigation' as const, action: () => navigate('/activity') }] : []),
    ...(canManageMembers || isAdmin ? [{ id: 'nav:members', label: t('layout.sidebar.members'), icon: NAV_ICON_MAP['/members'], category: 'navigation' as const, action: () => navigate('/members') }] : []),
    ...(isAdmin ? [{ id: 'nav:locales', label: t('layout.sidebar.locales'), icon: NAV_ICON_MAP['/locales'], category: 'navigation' as const, action: () => navigate('/locales') }] : []),
    ...(isAdmin ? [{ id: 'nav:legal', label: t('layout.sidebar.legal'), icon: NAV_ICON_MAP['/legal'], category: 'navigation' as const, action: () => navigate('/legal') }] : []),
    ...(isAdmin ? [{ id: 'nav:api-keys', label: t('layout.sidebar.apiKeys'), icon: NAV_ICON_MAP['/api-keys'], category: 'navigation' as const, action: () => navigate('/api-keys') }] : []),
    ...(isAdmin ? [{ id: 'nav:site-settings', label: t('siteSettings.title'), icon: NAV_ICON_MAP['/site-settings'], category: 'navigation' as const, action: () => navigate('/site-settings') }] : []),
    { id: 'nav:documents', label: t('layout.sidebar.documents'), icon: NAV_ICON_MAP['/documents'], category: 'navigation', action: () => navigate('/media/documents') },
    { id: 'nav:notifications', label: t('notifications.title'), icon: NAV_ICON_MAP['/notifications'], category: 'navigation', action: () => navigate('/notifications') },
    { id: 'nav:analytics', label: t('layout.sidebar.analytics'), icon: NAV_ICON_MAP['/analytics'], category: 'navigation', action: () => navigate('/analytics') },
    { id: 'nav:profile', label: t('layout.toolbar.profile'), icon: NAV_ICON_MAP['/profile'], category: 'navigation', action: () => navigate('/profile') },
    ...(isAdmin ? [{ id: 'nav:system', label: t('layout.sidebar.administration'), icon: NAV_ICON_MAP['/system'], category: 'navigation' as const, action: () => navigate('/system') }] : []),
  ];

  // Build context-sensitive commands based on current route
  const contextCommands = useMemo<Command[]>(() => {
    const path = pathname;
    const cmds: Command[] = [];

    if (canWrite) {
      cmds.push({ id: 'ctx:quick-post', label: t('quickPost.title'), icon: <BoltIcon fontSize="small" />, category: 'context', action: () => dispatchAction('quick-post') });
    }

    if (path === '/blogs') {
      cmds.push({ id: 'ctx:create-blog', label: t('commandPalette.contextActions.createBlog'), icon: <AddIcon fontSize="small" />, category: 'context', action: () => dispatchAction('create-blog') });
    } else if (/^\/blogs\/.+/.test(path)) {
      cmds.push({ id: 'ctx:back-to-blogs', label: t('commandPalette.contextActions.backToBlogs'), icon: <ArrowBackIcon fontSize="small" />, category: 'context', action: () => navigate('/blogs') });
    }

    if (path === '/pages') {
      cmds.push({ id: 'ctx:create-page', label: t('commandPalette.contextActions.createPage'), icon: <AddIcon fontSize="small" />, category: 'context', action: () => dispatchAction('create-page') });
    } else if (/^\/pages\/.+/.test(path)) {
      cmds.push({ id: 'ctx:back-to-pages', label: t('commandPalette.contextActions.backToPages'), icon: <ArrowBackIcon fontSize="small" />, category: 'context', action: () => navigate('/pages') });
    }

    if (path === '/media') {
      cmds.push({ id: 'ctx:upload-media', label: t('commandPalette.contextActions.uploadMedia'), icon: <UploadIcon fontSize="small" />, category: 'context', action: () => dispatchAction('upload-media') });
    }

    if (path === '/blogs/templates') {
      cmds.push({ id: 'ctx:create-template', label: t('commandPalette.contextActions.createTemplate'), icon: <AddIcon fontSize="small" />, category: 'context', action: () => dispatchAction('create-template') });
    }

    if (path === '/navigation') {
      cmds.push({ id: 'ctx:add-nav-item', label: t('commandPalette.contextActions.addNavItem'), icon: <AddIcon fontSize="small" />, category: 'context', action: () => dispatchAction('add-nav-item') });
    }

    if (path === '/taxonomy') {
      cmds.push(
        { id: 'ctx:create-tag', label: t('commandPalette.contextActions.createTag'), icon: <AddIcon fontSize="small" />, category: 'context', action: () => dispatchAction('create-tag') },
        { id: 'ctx:create-category', label: t('commandPalette.contextActions.createCategory'), icon: <AddIcon fontSize="small" />, category: 'context', action: () => dispatchAction('create-category') },
      );
    }

    if (path === '/social-links') {
      cmds.push({ id: 'ctx:add-social-link', label: t('commandPalette.contextActions.addSocialLink'), icon: <AddIcon fontSize="small" />, category: 'context', action: () => dispatchAction('add-social-link') });
    }

    if (path === '/redirects') {
      cmds.push({ id: 'ctx:create-redirect', label: t('commandPalette.contextActions.createRedirect'), icon: <AddIcon fontSize="small" />, category: 'context', action: () => dispatchAction('create-redirect') });
    }

    if (path === '/webhooks') {
      cmds.push({ id: 'ctx:create-webhook', label: t('commandPalette.contextActions.createWebhook'), icon: <AddIcon fontSize="small" />, category: 'context', action: () => dispatchAction('create-webhook') });
    }

    if (path === '/members') {
      cmds.push({ id: 'ctx:add-member', label: t('commandPalette.contextActions.addMember'), icon: <AddIcon fontSize="small" />, category: 'context', action: () => dispatchAction('add-member') });
    }

    if (path === '/cv') {
      cmds.push(
        { id: 'ctx:add-cv-entry', label: t('commandPalette.contextActions.addCvEntry'), icon: <AddIcon fontSize="small" />, category: 'context', action: () => dispatchAction('add-cv-entry') },
        { id: 'ctx:add-skill', label: t('commandPalette.contextActions.addSkill'), icon: <AddIcon fontSize="small" />, category: 'context', action: () => dispatchAction('add-skill') },
      );
    }

    if (path === '/sites') {
      cmds.push({ id: 'ctx:create-site', label: t('commandPalette.contextActions.createSite'), icon: <AddIcon fontSize="small" />, category: 'context', action: () => dispatchAction('create-site') });
    } else if (/^\/sites\/.+/.test(path)) {
      cmds.push({ id: 'ctx:back-to-sites', label: t('commandPalette.contextActions.backToSites'), icon: <ArrowBackIcon fontSize="small" />, category: 'context', action: () => navigate('/sites') });
    }

    if (path === '/legal') {
      cmds.push({ id: 'ctx:add-legal-doc', label: t('commandPalette.contextActions.addLegalDoc'), icon: <AddIcon fontSize="small" />, category: 'context', action: () => dispatchAction('add-legal-doc') });
    } else if (/^\/legal\/.+/.test(path)) {
      cmds.push({ id: 'ctx:back-to-legal', label: t('commandPalette.contextActions.backToLegal'), icon: <ArrowBackIcon fontSize="small" />, category: 'context', action: () => navigate('/legal') });
    }

    if (path === '/api-keys') {
      cmds.push({ id: 'ctx:create-api-key', label: t('commandPalette.contextActions.createApiKey'), icon: <AddIcon fontSize="small" />, category: 'context', action: () => dispatchAction('create-api-key') });
    }

    return cmds;
  }, [pathname, t, navigate, canWrite]);

  const {
    open,
    setOpen,
    query,
    setQuery,
    selectedIndex,
    setSelectedIndex,
    commands,
    execute,
  } = useCommandPalette(navCommands, contextCommands, pathname);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'Tab') {
      e.preventDefault();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(Math.min(selectedIndex + 1, commands.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(Math.max(selectedIndex - 1, 0));
    } else if (e.key === 'Enter' && commands[selectedIndex]) {
      e.preventDefault();
      execute(commands[selectedIndex]);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setOpen(false);
    }
  }, [selectedIndex, commands, setSelectedIndex, execute, setOpen]);

  const inputRef = useRef<HTMLInputElement>(null);
  const uniqueId = useId();

  const hasResults = commands.length > 0;

  return (
    <Dialog
      open={open}
      onClose={() => setOpen(false)}
      maxWidth="sm"
      fullWidth
      disableAutoFocus
      disableRestoreFocus
      aria-label={t('commandPalette.title')}
      data-testid="command-palette"
      slotProps={{
        transition: {
          onEntered: () => inputRef.current?.focus(),
        },

        paper: {
          sx: { position: 'fixed', top: '20%', m: 0, maxHeight: '60vh' },
        }
      }}>
      <TextField
        inputRef={inputRef}
        fullWidth
        placeholder={t('commandPalette.placeholder')}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        data-testid="command-palette.input"
        sx={{
          '& .MuiOutlinedInput-root': {
            '& fieldset': { border: 'none' },
          },
          borderBottom: 1,
          borderColor: 'divider',
        }}
        slotProps={{
          input: {
            startAdornment: (
              <InputAdornment position="start">
                <SearchIcon />
              </InputAdornment>
            ),
          },

          htmlInput: {
            'aria-label': t('commandPalette.searchLabel'),
            role: 'combobox',
            'aria-expanded': hasResults,
            'aria-controls': hasResults ? 'command-palette-listbox' : undefined,
            'aria-activedescendant': commands[selectedIndex] ? `command-palette-option-${commands[selectedIndex].id}` : undefined,
          }
        }} />
      {/* Live region for screen reader result count announcements */}
      <Box
        aria-live="polite"
        aria-atomic="true"
        sx={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0,0,0,0)' }}
      >
        {query
          ? t('commandPalette.resultCount', { count: commands.length })
          : ''
        }
      </Box>
      <CommandList
        commands={commands}
        selectedIndex={selectedIndex}
        onSelect={setSelectedIndex}
        onExecute={execute}
        uniqueId={uniqueId}
      />
    </Dialog>
  );
}
