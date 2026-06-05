import { useRef, useState } from 'react';
import { Alert, Box } from '@mui/material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { useTranslation } from 'react-i18next';
import { getSiteSettings, updateSiteSettings } from '@/services/sites';
import LoadingState from '@/components/shared/LoadingState';
import { useSiteContext } from '@/store/SiteContext';
import type { UpdateSiteSettingsRequest } from '@/types/api';
import {
  SettingsCard,
  ToggleField,
  Icon,
} from '@/components/design-system';
import { useFormSaveBar } from '@/hooks/useFormSaveBar';

type ModuleDef = {
  readonly key:
    | 'module_blog_enabled'
    | 'module_pages_enabled'
    | 'module_portfolio_enabled'
    | 'module_legal_enabled'
    | 'module_documents_enabled'
    | 'analytics_enabled'
    | 'module_ai_enabled'
    | 'module_forms_enabled'
    | 'module_collections_enabled';
  readonly labelKey: string;
  readonly descKey: string;
  /** Material Symbols Rounded ligature. */
  readonly icon: string;
};

const MODULE_DEFS: readonly ModuleDef[] = [
  { key: 'module_blog_enabled', labelKey: 'settings.modules.blog', descKey: 'settings.modules.blogDesc', icon: 'article' },
  { key: 'module_pages_enabled', labelKey: 'settings.modules.pages', descKey: 'settings.modules.pagesDesc', icon: 'description' },
  { key: 'module_portfolio_enabled', labelKey: 'settings.modules.portfolio', descKey: 'settings.modules.portfolioDesc', icon: 'collections_bookmark' },
  { key: 'module_legal_enabled', labelKey: 'settings.modules.legal', descKey: 'settings.modules.legalDesc', icon: 'gavel' },
  { key: 'module_documents_enabled', labelKey: 'settings.modules.documents', descKey: 'settings.modules.documentsDesc', icon: 'folder' },
  { key: 'module_forms_enabled', labelKey: 'settings.modules.forms', descKey: 'settings.modules.formsDesc', icon: 'dynamic_form' },
  { key: 'module_collections_enabled', labelKey: 'settings.modules.collections', descKey: 'settings.modules.collectionsDesc', icon: 'category' },
  { key: 'analytics_enabled', labelKey: 'settings.featureToggles.analytics', descKey: 'settings.featureToggles.analyticsDescription', icon: 'analytics' },
  { key: 'module_ai_enabled', labelKey: 'settings.modules.ai', descKey: 'settings.modules.aiDesc', icon: 'auto_awesome' },
];

type ModuleKey = ModuleDef['key'];

export default function ModulesTab() {
  const { t } = useTranslation();
  const { selectedSiteId } = useSiteContext();
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();

  const { data: settings, isLoading } = useQuery({
    queryKey: ['site-settings', selectedSiteId],
    queryFn: () => getSiteSettings(selectedSiteId),
    enabled: !!selectedSiteId,
  });

  const [modules, setModules] = useState<Record<ModuleKey, boolean>>({
    module_blog_enabled: true,
    module_pages_enabled: true,
    module_portfolio_enabled: false,
    module_legal_enabled: false,
    module_documents_enabled: false,
    module_forms_enabled: false,
    module_collections_enabled: false,
    analytics_enabled: false,
    module_ai_enabled: false,
  });
  const prevSettingsRef = useRef<typeof settings>(undefined);
  if (settings && settings !== prevSettingsRef.current) {
    prevSettingsRef.current = settings;
    setModules({
      module_blog_enabled: settings.module_blog_enabled,
      module_pages_enabled: settings.module_pages_enabled,
      module_portfolio_enabled: settings.module_portfolio_enabled,
      module_legal_enabled: settings.module_legal_enabled,
      module_documents_enabled: settings.module_documents_enabled,
      module_forms_enabled: settings.module_forms_enabled,
      module_collections_enabled: settings.module_collections_enabled,
      analytics_enabled: settings.analytics_enabled,
      module_ai_enabled: settings.module_ai_enabled,
    });
  }

  const mutation = useMutation({
    mutationFn: (data: UpdateSiteSettingsRequest) =>
      updateSiteSettings(selectedSiteId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['site-settings', selectedSiteId] });
      queryClient.invalidateQueries({ queryKey: ['siteContext', selectedSiteId] });
      enqueueSnackbar(t('settings.messages.saved'), { variant: 'success' });
      // No `setDirty(false)` needed: the query invalidation triggers a
      // re-seed of `modules` from the new `settings`, which makes the
      // derived `dirty` flag flip to false on its own.
    },
    onError: () => {
      enqueueSnackbar(t('settings.messages.saveFailed'), { variant: 'error' });
    },
  });

  const handleToggle = (key: ModuleKey, next: boolean) => {
    setModules((prev) => ({ ...prev, [key]: next }));
  };

  const handleSave = () => {
    mutation.mutate(modules);
  };

  const discardChanges = () => {
    if (settings) {
      setModules({
        module_blog_enabled: settings.module_blog_enabled,
        module_pages_enabled: settings.module_pages_enabled,
        module_portfolio_enabled: settings.module_portfolio_enabled,
        module_legal_enabled: settings.module_legal_enabled,
        module_documents_enabled: settings.module_documents_enabled,
        module_forms_enabled: settings.module_forms_enabled,
        module_collections_enabled: settings.module_collections_enabled,
        analytics_enabled: settings.analytics_enabled,
        module_ai_enabled: settings.module_ai_enabled,
      });
    }
  };

  // Derive dirty from current vs. last-loaded server snapshot. Avoids a
  // parallel useState that can drift out of sync from the data, and keeps
  // the react-doctor "rerender-state-only-in-handlers" lint clean.
  const dirty =
    !!settings &&
    (Object.keys(modules) as ModuleKey[]).some((k) => modules[k] !== settings[k]);

  useFormSaveBar({
    id: 'site-settings.modules',
    isDirty: dirty,
    saving: mutation.isPending,
    onSave: handleSave,
    onDiscard: discardChanges,
    saveTestId: 'settings.modules.btn.save',
    discardTestId: 'settings.modules.btn.discard',
  });

  if (!selectedSiteId) {
    return <Alert severity="info">{t('settings.selectSiteAlert')}</Alert>;
  }

  if (isLoading) {
    return <LoadingState label={t('settings.loadingSiteSettings')} />;
  }

  const enabledCount = MODULE_DEFS.filter((m) => modules[m.key]).length;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <Box
        sx={{
          fontSize: 12,
          color: 'var(--on-surface-variant)',
          fontFamily: 'var(--font-mono)',
          fontVariantNumeric: 'tabular-nums',
        }}
      >
        {t('siteSettings.modules.enabledCount', '{{enabled}} of {{total}} enabled', {
          enabled: enabledCount,
          total: MODULE_DEFS.length,
        })}
      </Box>

      <SettingsCard>
        {MODULE_DEFS.map((mod) => (
          <ToggleField
            key={mod.key}
            label={
              <>
                <Icon name={mod.icon} size={18} color="var(--primary)" />
                <span>{t(mod.labelKey)}</span>
              </>
            }
            sublabel={t(mod.descKey)}
            checked={modules[mod.key]}
            onChange={(next) => handleToggle(mod.key, next)}
            data-testid={`settings.modules.${mod.key}`}
          />
        ))}
      </SettingsCard>

    </Box>
  );
}
