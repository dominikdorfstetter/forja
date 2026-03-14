import { useRef, useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Divider,
  Switch,
  Button,
  Alert,
  Grid,
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import TuneIcon from '@mui/icons-material/Tune';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { useTranslation } from 'react-i18next';
import apiService from '@/services/api';
import LoadingState from '@/components/shared/LoadingState';
import { useSiteContext } from '@/store/SiteContext';
import type { UpdateSiteSettingsRequest } from '@/types/api';

const MODULE_DEFS = [
  { key: 'module_blog_enabled' as const, labelKey: 'settings.modules.blog', descKey: 'settings.modules.blogDesc' },
  { key: 'module_pages_enabled' as const, labelKey: 'settings.modules.pages', descKey: 'settings.modules.pagesDesc' },
  { key: 'module_cv_enabled' as const, labelKey: 'settings.modules.cv', descKey: 'settings.modules.cvDesc' },
  { key: 'module_legal_enabled' as const, labelKey: 'settings.modules.legal', descKey: 'settings.modules.legalDesc' },
  { key: 'module_documents_enabled' as const, labelKey: 'settings.modules.documents', descKey: 'settings.modules.documentsDesc' },
  { key: 'module_ai_enabled' as const, labelKey: 'settings.modules.ai', descKey: 'settings.modules.aiDesc' },
  { key: 'module_federation_enabled' as const, labelKey: 'settings.modules.federation', descKey: 'settings.modules.federationDesc' },
] as const;

type ModuleKey = typeof MODULE_DEFS[number]['key'];

export default function ModulesTab() {
  const { t } = useTranslation();
  const { selectedSiteId } = useSiteContext();
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();

  const { data: settings, isLoading } = useQuery({
    queryKey: ['site-settings', selectedSiteId],
    queryFn: () => apiService.getSiteSettings(selectedSiteId),
    enabled: !!selectedSiteId,
  });

  const [modules, setModules] = useState<Record<ModuleKey, boolean>>({
    module_blog_enabled: true,
    module_pages_enabled: true,
    module_cv_enabled: false,
    module_legal_enabled: false,
    module_documents_enabled: false,
    module_ai_enabled: false,
    module_federation_enabled: false,
  });
  const [dirty, setDirty] = useState(false);

  const prevSettingsRef = useRef<typeof settings>(undefined);
  if (settings && settings !== prevSettingsRef.current) {
    prevSettingsRef.current = settings;
    setModules({
      module_blog_enabled: settings.module_blog_enabled,
      module_pages_enabled: settings.module_pages_enabled,
      module_cv_enabled: settings.module_cv_enabled,
      module_legal_enabled: settings.module_legal_enabled,
      module_documents_enabled: settings.module_documents_enabled,
      module_ai_enabled: settings.module_ai_enabled,
      module_federation_enabled: settings.module_federation_enabled,
    });
    setDirty(false);
  }

  const mutation = useMutation({
    mutationFn: (data: UpdateSiteSettingsRequest) =>
      apiService.updateSiteSettings(selectedSiteId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['site-settings', selectedSiteId] });
      queryClient.invalidateQueries({ queryKey: ['siteContext', selectedSiteId] });
      enqueueSnackbar(t('settings.messages.saved'), { variant: 'success' });
      setDirty(false);
    },
    onError: () => {
      enqueueSnackbar(t('settings.messages.saveFailed'), { variant: 'error' });
    },
  });

  const handleToggle = (key: ModuleKey) => {
    setModules((prev) => ({ ...prev, [key]: !prev[key] }));
    setDirty(true);
  };

  const handleSave = () => {
    mutation.mutate(modules);
  };

  if (!selectedSiteId) {
    return <Alert severity="info">{t('settings.selectSiteAlert')}</Alert>;
  }

  if (isLoading) {
    return <LoadingState label={t('settings.loadingSiteSettings')} />;
  }

  return (
    <Grid container spacing={3}>
      <Grid size={12}>
        <Paper sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <TuneIcon color="primary" fontSize="small" />
            <Typography variant="h6" component="h2">{t('settings.modules.title')}</Typography>
          </Box>
          <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
            {t('settings.modules.description')}
          </Typography>
          <Divider sx={{ mb: 2 }} />

          <Grid container spacing={2}>
            {MODULE_DEFS.map(({ key, labelKey, descKey }) => (
              <Grid key={key} size={{ xs: 12, sm: 6 }}>
                <Paper
                  variant="outlined"
                  sx={{
                    p: 2,
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderColor: modules[key] ? 'primary.main' : undefined,
                  }}
                >
                  <Box>
                    <Typography variant="body1" fontWeight={500}>{t(labelKey)}</Typography>
                    <Typography variant="caption" color="text.secondary">{t(descKey)}</Typography>
                  </Box>
                  <Switch
                    checked={modules[key]}
                    onChange={() => handleToggle(key)}
                    data-testid={`settings.modules.${key}`}
                  />
                </Paper>
              </Grid>
            ))}
          </Grid>
        </Paper>
      </Grid>

      <Grid size={12}>
        <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
          <Button
            variant="contained"
            startIcon={<SaveIcon />}
            onClick={handleSave}
            disabled={!dirty || mutation.isPending}
            size="large"
          >
            {mutation.isPending ? t('common.actions.saving') : t('settings.saveButton')}
          </Button>
        </Box>
      </Grid>
    </Grid>
  );
}
