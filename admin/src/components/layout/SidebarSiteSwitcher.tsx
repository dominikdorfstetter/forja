import { Avatar, ButtonBase, IconButton, Tooltip, Typography } from '@mui/material';
import { ForjaBrandMark } from '@/components/design-system';
import { type Theme } from '@mui/material/styles';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import SwapHorizIcon from '@mui/icons-material/SwapHoriz';
import { useTranslation } from 'react-i18next';
import type { Site, SiteRole } from '@/types/api';

const stripProtocol = (url: string) => url.replace(/^https?:\/\//, '').replace(/\/$/, '');

const siteInitial = (name: string) => {
  const trimmed = name.trim();
  if (!trimmed) return '?';
  return trimmed[0]?.toUpperCase() ?? '?';
};

export interface SidebarSiteSwitcherProps {
  site: Site | undefined;
  fallbackName: string;
  currentRole: SiteRole | null;
  isSiteScoped: boolean;
  open: boolean;
  theme: Theme;
  onToggleDrawer: () => void;
  onSwitchSite: () => void;
  onOpenDetails?: () => void;
}

/**
 * Sidebar site identity block. Open state shows a compact identity strip —
 * site avatar, name, domain, and a primary-tinted switch action alongside
 * the collapse chevron. Role information belongs to the user footer, not
 * here. Collapsed state shows a tokenised F tile that doubles as the open
 * toggle.
 */
export function SidebarSiteSwitcher({
  site,
  fallbackName,
  currentRole,
  isSiteScoped,
  open,
  theme,
  onToggleDrawer,
  onSwitchSite,
  onOpenDetails,
}: SidebarSiteSwitcherProps) {
  const { t } = useTranslation();
  const siteName = site?.name ?? fallbackName;
  const domain = site?.base_url ? stripProtocol(site.base_url) : site?.slug;

  if (!open) {
    return (
      <Tooltip
        title={`${siteName}${currentRole ? ` — ${t(`members.roles.${currentRole}`)}` : ''}`}
        placement="right"
        arrow
      >
        <IconButton
          aria-label={t('layout.toolbar.toggleDrawer')}
          data-testid="layout.btn.toggle-sidebar"
          onClick={onToggleDrawer}
          sx={{ borderRadius: 1, px: 1 }}
        >
          <ForjaBrandMark size={28} />
        </IconButton>
      </Tooltip>
    );
  }

  return (
    <>
      <Avatar
        variant="rounded"
        src={site?.logo_url ?? undefined}
        alt={siteName}
        sx={{
          width: 36,
          height: 36,
          mr: 1.25,
          bgcolor: 'var(--primary-container)',
          color: 'var(--on-primary-container)',
          fontSize: 14,
          fontWeight: 700,
          fontVariationSettings: '"wght" 700, "opsz" 14',
          borderRadius: '10px',
        }}
      >
        {siteInitial(siteName)}
      </Avatar>
      <Tooltip
        title={onOpenDetails ? t('layout.toolbar.openSiteDetails', 'Open site details') : ''}
        placement="bottom"
        arrow
        disableHoverListener={!onOpenDetails}
      >
        <ButtonBase
          focusRipple={!!onOpenDetails}
          disabled={!onOpenDetails}
          onClick={onOpenDetails}
          data-testid="layout.btn.site-details"
          sx={{
            minWidth: 0,
            flex: 1,
            display: 'block',
            textAlign: 'left',
            px: 0.75,
            py: 0.5,
            mx: -0.75,
            borderRadius: '10px',
            transition: 'background-color 120ms',
            '&:hover': onOpenDetails
              ? { bgcolor: 'var(--surface-container-high)' }
              : undefined,
            '&:focus-visible': onOpenDetails
              ? { outline: '2px solid var(--primary)', outlineOffset: 1 }
              : undefined,
          }}
        >
          <Typography
            variant="subtitle1"
            component="div"
            noWrap
            data-testid="layout.site-name"
            data-tour="site-switch"
            sx={{
              fontWeight: 700,
              fontVariationSettings: '"wght" 700, "opsz" 18',
              letterSpacing: -0.2,
              lineHeight: 1.2,
              color: 'var(--on-surface)',
            }}
          >
            {siteName}
          </Typography>
          {domain && (
            <Typography
              component="div"
              noWrap
              data-testid="layout.site-meta"
              sx={{
                mt: 0.25,
                fontSize: 11,
                color: 'var(--on-surface-variant)',
                fontVariationSettings: '"wght" 500, "opsz" 11',
                letterSpacing: 0.2,
              }}
            >
              {domain}
            </Typography>
          )}
        </ButtonBase>
      </Tooltip>
      {!isSiteScoped && (
        <Tooltip title={t('layout.toolbar.switchSite')} placement="bottom" arrow>
          <IconButton
            aria-label={t('layout.toolbar.switchSite')}
            data-testid="layout.btn.switch-site"
            onClick={onSwitchSite}
            size="small"
            sx={{
              color: 'var(--primary)',
              width: 32,
              height: 32,
              '&:hover': {
                bgcolor: 'color-mix(in srgb, var(--primary) 14%, transparent)',
              },
            }}
          >
            <SwapHorizIcon sx={{ fontSize: 20 }} />
          </IconButton>
        </Tooltip>
      )}
      <IconButton
        aria-label={t('layout.toolbar.toggleDrawer')}
        data-testid="layout.btn.toggle-sidebar"
        onClick={onToggleDrawer}
        size="small"
        sx={{ color: 'var(--on-surface-variant)', width: 32, height: 32 }}
      >
        {theme.direction === 'rtl'
          ? <ChevronRightIcon sx={{ fontSize: 20 }} />
          : <ChevronLeftIcon sx={{ fontSize: 20 }} />}
      </IconButton>
    </>
  );
}
