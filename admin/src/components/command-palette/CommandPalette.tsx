import { useCallback, type ReactNode } from 'react';
import { useNavigate } from 'react-router';
import {
  Dialog,
  InputAdornment,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  ListSubheader,
  TextField,
  Typography,
  Box,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
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
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/store/AuthContext';
import { useCommandPalette, type Command } from './useCommandPalette';

const NAV_ICON_MAP: Record<string, ReactNode> = {
  '/dashboard': <DashboardIcon fontSize="small" />,
  '/blogs': <ArticleIcon fontSize="small" />,
  '/pages': <DescriptionIcon fontSize="small" />,
  '/media': <PermMediaIcon fontSize="small" />,
  '/cv': <WorkIcon fontSize="small" />,
  '/navigation': <MenuBookIcon fontSize="small" />,
  '/taxonomy': <LocalOfferIcon fontSize="small" />,
  '/social-links': <ShareIcon fontSize="small" />,
  '/activity': <HistoryIcon fontSize="small" />,
  '/members': <PeopleIcon fontSize="small" />,
  '/settings': <SettingsIcon fontSize="small" />,
};

const CATEGORY_ORDER = ['navigation', 'action', 'blog', 'page', 'site'] as const;

function groupByCategory(commands: Command[]): Map<string, Command[]> {
  const map = new Map<string, Command[]>();
  for (const cmd of commands) {
    const list = map.get(cmd.category) || [];
    list.push(cmd);
    map.set(cmd.category, list);
  }
  return map;
}

export default function CommandPalette() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { isAdmin, canManageMembers } = useAuth();

  // Build nav commands from static routes
  const navCommands: Command[] = [
    { id: 'nav:dashboard', label: t('layout.sidebar.dashboard'), icon: NAV_ICON_MAP['/dashboard'], category: 'navigation', action: () => navigate('/dashboard') },
    { id: 'nav:blogs', label: t('layout.sidebar.blogs'), icon: NAV_ICON_MAP['/blogs'], category: 'navigation', action: () => navigate('/blogs') },
    { id: 'nav:pages', label: t('layout.sidebar.pages'), icon: NAV_ICON_MAP['/pages'], category: 'navigation', action: () => navigate('/pages') },
    { id: 'nav:media', label: t('layout.sidebar.assets'), icon: NAV_ICON_MAP['/media'], category: 'navigation', action: () => navigate('/media') },
    { id: 'nav:cv', label: t('layout.sidebar.cv'), icon: NAV_ICON_MAP['/cv'], category: 'navigation', action: () => navigate('/cv') },
    { id: 'nav:navigation', label: t('layout.sidebar.navigation'), icon: NAV_ICON_MAP['/navigation'], category: 'navigation', action: () => navigate('/navigation') },
    { id: 'nav:taxonomy', label: t('layout.sidebar.taxonomy'), icon: NAV_ICON_MAP['/taxonomy'], category: 'navigation', action: () => navigate('/taxonomy') },
    { id: 'nav:social', label: t('layout.sidebar.socialLinks'), icon: NAV_ICON_MAP['/social-links'], category: 'navigation', action: () => navigate('/social-links') },
    ...(isAdmin ? [{ id: 'nav:activity', label: t('layout.sidebar.activity'), icon: NAV_ICON_MAP['/activity'], category: 'navigation' as const, action: () => navigate('/activity') }] : []),
    ...(canManageMembers || isAdmin ? [{ id: 'nav:members', label: t('layout.sidebar.members'), icon: NAV_ICON_MAP['/members'], category: 'navigation' as const, action: () => navigate('/members') }] : []),
    ...(isAdmin ? [{ id: 'nav:settings', label: t('layout.sidebar.settings'), icon: NAV_ICON_MAP['/settings'], category: 'navigation' as const, action: () => navigate('/settings') }] : []),
  ];

  const {
    open,
    setOpen,
    query,
    setQuery,
    selectedIndex,
    setSelectedIndex,
    commands,
    execute,
  } = useCommandPalette(navCommands);

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(Math.min(selectedIndex + 1, commands.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(Math.max(selectedIndex - 1, 0));
    } else if (e.key === 'Enter' && commands[selectedIndex]) {
      e.preventDefault();
      execute(commands[selectedIndex]);
    }
  }, [selectedIndex, commands, setSelectedIndex, execute]);

  const grouped = groupByCategory(commands);

  const categoryLabel = (cat: string) => {
    switch (cat) {
      case 'navigation': return t('commandPalette.categories.navigation');
      case 'action': return t('commandPalette.categories.actions');
      case 'blog': return t('commandPalette.categories.blogs');
      case 'page': return t('commandPalette.categories.pages');
      case 'site': return t('commandPalette.categories.sites');
      default: return cat;
    }
  };

  // Build flat index for keyboard navigation
  let flatIndex = 0;

  return (
    <Dialog
      open={open}
      onClose={() => setOpen(false)}
      maxWidth="sm"
      fullWidth
      PaperProps={{
        sx: { position: 'fixed', top: '20%', m: 0, maxHeight: '60vh' },
      }}
    >
      <TextField
        autoFocus
        fullWidth
        placeholder={t('commandPalette.placeholder')}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        onKeyDown={handleKeyDown}
        InputProps={{
          startAdornment: (
            <InputAdornment position="start">
              <SearchIcon />
            </InputAdornment>
          ),
        }}
        sx={{
          '& .MuiOutlinedInput-root': {
            '& fieldset': { border: 'none' },
          },
          borderBottom: 1,
          borderColor: 'divider',
        }}
      />

      {commands.length === 0 ? (
        <Box sx={{ p: 3, textAlign: 'center' }}>
          <Typography variant="body2" color="text.secondary">
            {t('commandPalette.noResults')}
          </Typography>
        </Box>
      ) : (
        <List sx={{ overflow: 'auto', py: 0 }}>
          {CATEGORY_ORDER.map((cat) => {
            const group = grouped.get(cat);
            if (!group || group.length === 0) return null;
            return (
              <Box key={cat}>
                <ListSubheader
                  sx={{
                    lineHeight: '32px',
                    fontSize: '0.7rem',
                    fontWeight: 700,
                    textTransform: 'uppercase',
                    letterSpacing: '0.08em',
                  }}
                >
                  {categoryLabel(cat)}
                </ListSubheader>
                {group.map((cmd) => {
                  const idx = flatIndex++;
                  return (
                    <ListItem key={cmd.id} disablePadding>
                      <ListItemButton
                        selected={idx === selectedIndex}
                        onClick={() => execute(cmd)}
                        onMouseEnter={() => setSelectedIndex(idx)}
                        sx={{ py: 0.75 }}
                      >
                        {cmd.icon && <ListItemIcon sx={{ minWidth: 36 }}>{cmd.icon}</ListItemIcon>}
                        <ListItemText
                          primary={cmd.label}
                          primaryTypographyProps={{ fontSize: '0.875rem' }}
                        />
                      </ListItemButton>
                    </ListItem>
                  );
                })}
              </Box>
            );
          })}
        </List>
      )}
    </Dialog>
  );
}
