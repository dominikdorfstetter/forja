import { useRef, useState } from 'react';
import {
  Box,
  Paper,
  Tabs,
  Tab,
} from '@mui/material';
import TuneIcon from '@mui/icons-material/Tune';
import StorageIcon from '@mui/icons-material/Storage';
import SettingsIcon from '@mui/icons-material/Settings';
import LanguageIcon from '@mui/icons-material/Language';
import GavelIcon from '@mui/icons-material/Gavel';
import KeyIcon from '@mui/icons-material/Key';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import HubIcon from '@mui/icons-material/Hub';
import { useTranslation } from 'react-i18next';
import { useSearchParams } from 'react-router';
import PageHeader from '@/components/shared/PageHeader';
import { useSiteContext } from '@/store/SiteContext';
import { useAuth } from '@/store/AuthContext';
import { useSiteContextData } from '@/hooks/useSiteContextData';
import LegalPage from '@/pages/Legal';
import ApiKeysPage from '@/pages/ApiKeys';
import AiSettingsPage from '@/pages/ai-settings/AiSettingsPage';
import FederationSettingsPage from '@/pages/federation/FederationSettings';
import SiteSettingsTab from './settings/SiteSettingsTab';
import ModulesTab from './settings/ModulesTab';
import SystemInfoTab from './settings/SystemInfoTab';
import PreferencesTab from './settings/PreferencesTab';

interface TabDef {
  key: string;
  icon: React.ReactElement;
  label: string;
  content: React.ReactNode;
}

export default function SettingsPage() {
  const { t } = useTranslation();
  const { isAdmin, isMaster } = useAuth();
  const { selectedSiteId } = useSiteContext();
  const { modules } = useSiteContextData();
  const [searchParams] = useSearchParams();
  const highlightField = searchParams.get('highlight') ?? undefined;
  const [tabIndex, setTabIndex] = useState(0);

  // Build tabs dynamically based on permissions
  const tabs: TabDef[] = [];

  // 1. Preferences — always visible (all users)
  tabs.push({
    key: 'preferences',
    icon: <LanguageIcon />,
    label: t('settings.tabs.preferences'),
    content: <PreferencesTab />,
  });

  // 2. Site Settings — admin + site selected
  if (isAdmin && selectedSiteId) {
    tabs.push({
      key: 'siteSettings',
      icon: <TuneIcon />,
      label: t('settings.tabs.siteSettings'),
      content: <SiteSettingsTab highlightField={highlightField} />,
    });
  }

  // 3. Modules — admin + site selected
  if (isAdmin && selectedSiteId) {
    tabs.push({
      key: 'modules',
      icon: <SettingsIcon />,
      label: t('settings.tabs.modules'),
      content: <ModulesTab />,
    });
  }

  // 4. AI Settings — admin + site selected + ai module enabled
  if (isAdmin && selectedSiteId && modules.ai) {
    tabs.push({
      key: 'ai',
      icon: <AutoAwesomeIcon />,
      label: t('settings.tabs.ai'),
      content: <AiSettingsPage embedded />,
    });
  }

  // 5. Federation Settings — sysadmin only (signature algo, key management, moderation mode)
  if (isMaster && selectedSiteId && modules.federation) {
    tabs.push({
      key: 'federation',
      icon: <HubIcon />,
      label: t('settings.tabs.federation'),
      content: <FederationSettingsPage embedded />,
    });
  }

  // 6. System Info — master only
  if (isMaster) {
    tabs.push({
      key: 'systemInfo',
      icon: <StorageIcon />,
      label: t('settings.tabs.systemInfo'),
      content: <SystemInfoTab />,
    });
  }

  // 6. Legal — admin + site selected + module enabled
  if (isAdmin && selectedSiteId && modules.legal) {
    tabs.push({
      key: 'legal',
      icon: <GavelIcon />,
      label: t('settings.tabs.legal'),
      content: <LegalPage embedded />,
    });
  }

  // 7. API Keys — admin only
  if (isAdmin) {
    tabs.push({
      key: 'apiKeys',
      icon: <KeyIcon />,
      label: t('settings.tabs.apiKeys'),
      content: <ApiKeysPage embedded />,
    });
  }

  // Auto-switch to siteSettings tab when highlight param is set
  const prevHighlightRef = useRef<string | undefined>(undefined);
  if (highlightField && highlightField !== prevHighlightRef.current) {
    const idx = tabs.findIndex((t) => t.key === 'siteSettings');
    if (idx >= 0) setTabIndex(idx);
  }
  prevHighlightRef.current = highlightField;

  // Clamp tabIndex if tab list shrinks (e.g. site deselected)
  const safeTabIndex = Math.min(tabIndex, tabs.length - 1);

  return (
    <Box>
      <PageHeader title={t('settings.title')} subtitle={t('settings.subtitle')} />

      <Paper sx={{ mb: 3 }}>
        <Tabs
          value={safeTabIndex}
          onChange={(_, v) => setTabIndex(v)}
          variant="scrollable"
          scrollButtons="auto"
          aria-label="Settings sections"
        >
          {tabs.map((tab) => (
            <Tab key={tab.key} icon={tab.icon} iconPosition="start" label={tab.label} />
          ))}
        </Tabs>
      </Paper>

      {tabs[safeTabIndex]?.content}
    </Box>
  );
}
