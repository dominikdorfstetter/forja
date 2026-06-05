import { ButtonBase, Toolbar } from '@mui/material';
import Box from '@mui/material/Box';
import SearchIcon from '@mui/icons-material/Search';
import { useTranslation } from 'react-i18next';
import NotificationBell from '@/components/notifications/NotificationBell';
import HelpMenu from '@/components/help/HelpMenu';
import UserAccountMenu from '@/components/layout/UserAccountMenu';

const isMac = typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform);
const modifierKey = isMac ? '\u2318' : 'Ctrl+';
const shortcutLabel = `${modifierKey}K`;

interface TopBarProps {
  onLogout: () => void;
  onLeaveSite?: () => void;
}

export default function TopBar({
  onLogout,
  onLeaveSite,
}: TopBarProps) {
  const { t } = useTranslation();

  return (
    <Toolbar sx={{ gap: 2 }}>
      <Box sx={{ flex: 1, display: 'flex', justifyContent: 'center' }}>
        <ButtonBase
          focusRipple
          aria-label={t('commandPalette.open')}
          data-testid="layout.btn.search"
          data-tour="command-palette"
          onClick={() => {
            window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', metaKey: isMac, ctrlKey: !isMac }));
          }}
          sx={{
            width: '100%',
            maxWidth: 520,
            height: 40,
            pl: 2,
            pr: 1,
            display: 'flex',
            alignItems: 'center',
            gap: 1.25,
            borderRadius: '999px',
            bgcolor: 'var(--surface-container-high)',
            border: '1px solid var(--outline-variant)',
            color: 'var(--on-surface-variant)',
            transition: 'background-color 120ms, border-color 120ms',
            '&:hover': {
              bgcolor: 'var(--surface-container-highest)',
              borderColor: 'var(--outline)',
            },
          }}
        >
          <SearchIcon sx={{ fontSize: 20 }} />
          <Box
            component="span"
            sx={{
              flex: 1,
              textAlign: 'left',
              fontSize: 14,
              fontVariationSettings: '"wght" 500, "opsz" 14',
            }}
          >
            {t('commandPalette.triggerPlaceholder')}
          </Box>
          <Box
            component="span"
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              px: 0.9,
              height: 22,
              borderRadius: '999px',
              bgcolor: 'var(--surface-container-highest)',
              color: 'var(--on-surface-variant)',
              fontFamily: 'var(--font-mono, ui-monospace, monospace)',
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: 0.3,
              border: '1px solid var(--outline-variant)',
            }}
          >
            {shortcutLabel}
          </Box>
        </ButtonBase>
      </Box>

      <NotificationBell />
      <HelpMenu />
      <UserAccountMenu
        onLogout={onLogout}
        onLeaveSite={onLeaveSite}
      />
    </Toolbar>
  );
}
