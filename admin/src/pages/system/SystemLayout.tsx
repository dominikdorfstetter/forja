import { useMemo } from 'react';
import { Outlet, useLocation, useNavigate } from 'react-router';
import { Box, Tabs, Tab, Alert } from '@mui/material';
import DashboardIcon from '@mui/icons-material/Dashboard';
import WebIcon from '@mui/icons-material/Web';
import PeopleIcon from '@mui/icons-material/People';
import LanguageIcon from '@mui/icons-material/Language';
import { useTranslation } from 'react-i18next';
import PageHeader from '@/components/shared/PageHeader';
import { pageTabsSx } from '@/components/shared/listPageV2';
import { useAuth } from '@/store/AuthContext';

const BASE_PATH = '/system';

export default function SystemLayout() {
  const { t } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const { isMaster } = useAuth();

  const tabs = useMemo(() => [
    { path: '', label: t('system.nav.dashboard'), icon: <DashboardIcon /> },
    { path: '/sites', label: t('system.nav.sites'), icon: <WebIcon /> },
    { path: '/users', label: t('system.nav.users'), icon: <PeopleIcon /> },
    { path: '/languages', label: t('system.nav.languages'), icon: <LanguageIcon /> },
  ], [t]);

  if (!isMaster) {
    return (
      <Box>
        <PageHeader
          icon="admin_panel_settings"
          title={t('system.title')}
          subtitle={t('system.subtitle')}
          breadcrumbs={[{ label: t('system.title') }]}
        />
        <Alert severity="error" data-testid="system.access-denied">
          {t('system.accessDenied')}
        </Alert>
      </Box>
    );
  }

  const currentTab = tabs.findIndex((tab) => {
    const fullPath = BASE_PATH + tab.path;
    return location.pathname === fullPath;
  });
  const safeTab = currentTab >= 0 ? currentTab : 0;
  const activeTabLabel = tabs[safeTab].label;

  return (
    <Box data-testid="system.page">
      <PageHeader
        icon="admin_panel_settings"
        title={t('system.title')}
        subtitle={t('system.subtitle')}
        breadcrumbs={[{ label: t('system.title') }, { label: activeTabLabel }]}
      />

      <Tabs
        value={safeTab}
        onChange={(_, idx) => navigate(BASE_PATH + tabs[idx].path)}
        variant="scrollable"
        scrollButtons="auto"
        aria-label="System administration sections"
        sx={pageTabsSx}
      >
        {tabs.map((tab) => (
          <Tab
            key={tab.path || 'dashboard'}
            icon={tab.icon}
            iconPosition="start"
            label={tab.label}
            data-testid={`system.tab.${tab.path.replace('/', '') || 'dashboard'}`}
          />
        ))}
      </Tabs>

      <Outlet />
    </Box>
  );
}
