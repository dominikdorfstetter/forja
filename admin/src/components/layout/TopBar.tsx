import { Chip, IconButton, MenuItem, TextField, Toolbar, Tooltip } from '@mui/material';
import Box from '@mui/material/Box';
import SearchIcon from '@mui/icons-material/Search';
import { useTranslation } from 'react-i18next';
import NotificationBell from '@/components/notifications/NotificationBell';
import HelpMenu from '@/components/help/HelpMenu';
import UserAccountMenu from '@/components/layout/UserAccountMenu';
import type { Site } from '@/types/api';

const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
const modifierKey = isMac ? '\u2318' : 'Ctrl+';
const shortcutLabel = `${modifierKey}K`;

interface TopBarProps {
  selectedSiteId: string;
  onSiteChange: (siteId: string) => void;
  siteDisabled: boolean;
  sites: Site[] | undefined;
  isAdmin: boolean;
  userFullName: string | null;
  userImageUrl: string | null;
  onLogout: () => void;
}

export default function TopBar({
  selectedSiteId,
  onSiteChange,
  siteDisabled,
  sites,
  isAdmin,
  userFullName,
  userImageUrl,
  onLogout,
}: TopBarProps) {
  const { t } = useTranslation();

  return (
    <Toolbar>
      <Tooltip title={siteDisabled ? t('common.lockedByScope') : ''} arrow>
        <TextField
          select
          size="small"
          value={selectedSiteId}
          onChange={(e) => onSiteChange(e.target.value)}
          disabled={siteDisabled}
          data-testid="layout.btn.site-selector"
          data-tour="site-selector"
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
          data-tour="command-palette"
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
      <HelpMenu />
      <UserAccountMenu
        isAdmin={isAdmin}
        userFullName={userFullName}
        userImageUrl={userImageUrl}
        onLogout={onLogout}
      />
    </Toolbar>
  );
}
