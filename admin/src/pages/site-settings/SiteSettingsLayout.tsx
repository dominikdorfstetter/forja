import { useMemo } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router';
import { Box, Alert } from '@mui/material';
import { useTranslation } from 'react-i18next';
import PageHeader from '@/components/shared/PageHeader';
import { useSiteContext } from '@/store/SiteContext';
import { useAuth } from '@/store/AuthContext';
import { useSiteContextData } from '@/hooks/useSiteContextData';
import {
  SettingsSidebar,
  type SettingsNavGroup,
} from '@/pages/site-settings/SettingsSidebar';

const BASE_PATH = '/site-settings';

export default function SiteSettingsLayout() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { selectedSiteId } = useSiteContext();
  const { isAdmin, isOwner } = useAuth();
  const { modules } = useSiteContextData();

  const groups = useMemo<SettingsNavGroup[]>(() => {
    const configuration: SettingsNavGroup = {
      label: t('siteSettings.groups.configuration', 'Configuration'),
      items: [
        { path: '', label: t('siteSettings.nav.overview'), icon: 'tune' },
        { path: '/favicon', label: t('siteSettings.nav.branding', 'Branding'), icon: 'palette' },
        { path: '/content', label: t('siteSettings.nav.content'), icon: 'article' },
        { path: '/modules', label: t('siteSettings.nav.modules'), icon: 'widgets' },
      ],
    };
    const discovery: SettingsNavGroup = {
      label: t('siteSettings.groups.discovery', 'Discovery'),
      items: [
        { path: '/seo', label: t('siteSettings.nav.seo'), icon: 'travel_explore' },
      ],
    };
    const integration: SettingsNavGroup = {
      label: t('siteSettings.groups.integration', 'Integration'),
      items: [
        { path: '/code-injection', label: t('siteSettings.nav.codeInjection'), icon: 'code' },
        ...(isAdmin
          ? [
              {
                path: '/api-keys',
                label: t('siteSettings.nav.apiKeys', 'API keys'),
                icon: 'vpn_key',
              },
              {
                path: '/webhooks',
                label: t('siteSettings.nav.webhooks', 'Webhooks'),
                icon: 'webhook',
              },
            ]
          : []),
        ...(modules.ai
          ? [{ path: '/ai', label: t('siteSettings.nav.ai'), icon: 'auto_awesome' }]
          : []),
        ...(modules.forms
          ? [
              {
                path: '/forms',
                label: t('siteSettings.nav.forms', 'Forms'),
                icon: 'dynamic_form',
              },
            ]
          : []),
      ],
    };
    const access: SettingsNavGroup | null = isAdmin
      ? {
          label: t('siteSettings.groups.access', 'Access'),
          items: [
            {
              path: '/members',
              label: t('siteSettings.nav.members', 'Members'),
              icon: 'group',
            },
          ],
        }
      : null;
    const danger: SettingsNavGroup | null = isOwner
      ? {
          label: t('siteSettings.groups.danger', 'Danger'),
          danger: true,
          items: [
            {
              path: '/danger',
              label: t('siteSettings.nav.dangerZone', 'Danger zone'),
              icon: 'warning',
              danger: true,
            },
          ],
        }
      : null;

    return [configuration, discovery, integration, ...(access ? [access] : []), ...(danger ? [danger] : [])];
  }, [t, modules.ai, modules.forms, isAdmin, isOwner]);

  const currentPath = location.pathname.startsWith(BASE_PATH)
    ? location.pathname.slice(BASE_PATH.length)
    : '';

  const handleNavigate = (path: string) => {
    navigate(BASE_PATH + path);
  };

  // Resolve the active sidebar item's label so the breadcrumb reflects the
  // current setting (e.g. "Seite / Einstellungen / Module").
  const activeItem = groups.flatMap((g) => g.items).find((item) => item.path === currentPath);
  const baseBreadcrumbs = [
    { label: t('layout.sidebar.site', 'Site') },
    { label: t('layout.sidebar.settings') },
  ];
  const breadcrumbs = activeItem
    ? [...baseBreadcrumbs, { label: activeItem.label }]
    : baseBreadcrumbs;

  if (!selectedSiteId) {
    return (
      <Box>
        <PageHeader
          icon="tune"
          title={t('siteSettings.title')}
          subtitle={t('siteSettings.subtitle')}
          breadcrumbs={[{ label: t('layout.sidebar.site', 'Site') }, { label: t('layout.sidebar.siteSettings') }]}
        />
        <Alert severity="info">{t('settings.selectSiteAlert')}</Alert>
      </Box>
    );
  }

  return (
    <Box data-testid="site-settings.page">
      <PageHeader
        icon="tune"
        title={t('siteSettings.title')}
        subtitle={t('siteSettings.subtitle')}
        breadcrumbs={breadcrumbs}
      />

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '280px 1fr' },
          gap: 3,
          alignItems: 'flex-start',
        }}
      >
        <SettingsSidebar
          groups={groups}
          currentPath={currentPath}
          onNavigate={handleNavigate}
        />

        <Box component="main" sx={{ minWidth: 0 }}>
          <Outlet />
        </Box>
      </Box>
    </Box>
  );
}
