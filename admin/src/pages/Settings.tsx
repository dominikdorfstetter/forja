import { useEffect, useRef, useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  Chip,
  IconButton,
  Tooltip,
  Alert,
  Collapse,
  Divider,
  Stack,
  TextField,
  Switch,
  Button,
  InputAdornment,
  Tabs,
  Tab,
  Grid,
  MenuItem,
} from '@mui/material';
import RefreshIcon from '@mui/icons-material/Refresh';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import WarningIcon from '@mui/icons-material/Warning';
import SaveIcon from '@mui/icons-material/Save';
import TuneIcon from '@mui/icons-material/Tune';
import StorageIcon from '@mui/icons-material/Storage';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import SettingsIcon from '@mui/icons-material/Settings';
import LanguageIcon from '@mui/icons-material/Language';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import TableChartIcon from '@mui/icons-material/TableChart';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { useSnackbar } from 'notistack';
import { useTranslation } from 'react-i18next';
import { useNavigate, useSearchParams } from 'react-router';
import apiService from '@/services/api';
import PageHeader from '@/components/shared/PageHeader';
import LoadingState from '@/components/shared/LoadingState';
import { useSiteContext } from '@/store/SiteContext';
import { SUPPORTED_LANGUAGES } from '@/i18n';
import GavelIcon from '@mui/icons-material/Gavel';
import KeyIcon from '@mui/icons-material/Key';
import type { UpdateSiteSettingsRequest, PreviewTemplate } from '@/types/api';
import PaletteIcon from '@mui/icons-material/Palette';
import SaveAltIcon from '@mui/icons-material/SaveAlt';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import { useAuth } from '@/store/AuthContext';
import { useSiteContextData } from '@/hooks/useSiteContextData';
import { useUserPreferences } from '@/store/UserPreferencesContext';
import { useThemeMode } from '@/theme/ThemeContext';
import LegalPage from '@/pages/Legal';
import ApiKeysPage from '@/pages/ApiKeys';

const STATUS_CONFIG = {
  healthy: { icon: <CheckCircleIcon color="success" />, color: 'success' as const, labelKey: 'common.status.healthy' },
  degraded: { icon: <WarningIcon color="warning" />, color: 'warning' as const, labelKey: 'common.status.degraded' },
  unhealthy: { icon: <ErrorIcon color="error" />, color: 'error' as const, labelKey: 'common.status.unhealthy' },
};

const settingsSchema = z.object({
  max_document_file_size_mb: z.number().min(1, 'Min 1 MB').max(100, 'Max 100 MB'),
  max_media_file_size_mb: z.number().min(1, 'Min 1 MB').max(500, 'Max 500 MB'),
  analytics_enabled: z.boolean(),
  maintenance_mode: z.boolean(),
  contact_email: z.string().max(500).optional().or(z.literal('')),
  editorial_workflow_enabled: z.boolean(),
});

type SettingsFormValues = z.infer<typeof settingsSchema>;

const BYTES_PER_MB = 1_048_576;

// ─── Site Settings Tab ──────────────────────────────────────────────

function SiteSettingsTab({ highlightField }: { highlightField?: string }) {
  const { t } = useTranslation();
  const { selectedSiteId } = useSiteContext();
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const workflowRef = useRef<HTMLDivElement>(null);

  const [previewTemplates, setPreviewTemplates] = useState<PreviewTemplate[]>([]);
  const [previewTemplatesDirty, setPreviewTemplatesDirty] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(highlightField === 'editorial_workflow');

  const { data: settings, isLoading } = useQuery({
    queryKey: ['site-settings', selectedSiteId],
    queryFn: () => apiService.getSiteSettings(selectedSiteId),
    enabled: !!selectedSiteId,
  });

  const { control, handleSubmit, reset, formState: { isDirty, errors } } = useForm<SettingsFormValues>({
    resolver: zodResolver(settingsSchema),
    defaultValues: {
      max_document_file_size_mb: 10,
      max_media_file_size_mb: 50,
      analytics_enabled: false,
      maintenance_mode: false,
      contact_email: '',
      editorial_workflow_enabled: false,
    },
  });

  useUnsavedChanges(isDirty || previewTemplatesDirty);

  useEffect(() => {
    if (settings) {
      reset({
        max_document_file_size_mb: Math.round(settings.max_document_file_size / BYTES_PER_MB),
        max_media_file_size_mb: Math.round(settings.max_media_file_size / BYTES_PER_MB),
        analytics_enabled: settings.analytics_enabled,
        maintenance_mode: settings.maintenance_mode,
        contact_email: settings.contact_email,
        editorial_workflow_enabled: settings.editorial_workflow_enabled,
      });
      setPreviewTemplates(settings.preview_templates ?? []);
      setPreviewTemplatesDirty(false);
    }
  }, [settings, reset]);

  // Scroll to and highlight the editorial workflow toggle when linked from prompt
  useEffect(() => {
    if (highlightField === 'editorial_workflow' && advancedOpen && workflowRef.current) {
      const timer = setTimeout(() => {
        workflowRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [highlightField, advancedOpen]);

  const mutation = useMutation({
    mutationFn: (data: UpdateSiteSettingsRequest) =>
      apiService.updateSiteSettings(selectedSiteId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['site-settings', selectedSiteId] });
      enqueueSnackbar(t('settings.messages.saved'), { variant: 'success' });
    },
    onError: () => {
      enqueueSnackbar(t('settings.messages.saveFailed'), { variant: 'error' });
    },
  });

  const onSubmit = (values: SettingsFormValues) => {
    mutation.mutate({
      max_document_file_size: values.max_document_file_size_mb * BYTES_PER_MB,
      max_media_file_size: values.max_media_file_size_mb * BYTES_PER_MB,
      analytics_enabled: values.analytics_enabled,
      maintenance_mode: values.maintenance_mode,
      contact_email: values.contact_email || '',
      editorial_workflow_enabled: values.editorial_workflow_enabled,
      preview_templates: previewTemplates.filter(pt => pt.name.trim() && pt.url.trim()),
    });
    setPreviewTemplatesDirty(false);
  };

  const handleAddTemplate = () => {
    setPreviewTemplates(prev => [...prev, { name: '', url: '' }]);
    setPreviewTemplatesDirty(true);
  };

  const handleRemoveTemplate = (index: number) => {
    setPreviewTemplates(prev => prev.filter((_, i) => i !== index));
    setPreviewTemplatesDirty(true);
  };

  const handleTemplateChange = (index: number, field: keyof PreviewTemplate, value: string) => {
    setPreviewTemplates(prev => prev.map((pt, i) => i === index ? { ...pt, [field]: value } : pt));
    setPreviewTemplatesDirty(true);
  };

  if (!selectedSiteId) {
    return (
      <Alert severity="info">
        {t('settings.selectSiteAlert')}
      </Alert>
    );
  }

  if (isLoading) {
    return <LoadingState label={t('settings.loadingSiteSettings')} />;
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <Grid container spacing={3}>
        {/* General Settings — always visible (Level 1) */}
        <Grid size={12}>
          <Paper sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <SettingsIcon color="primary" fontSize="small" />
              <Typography variant="h6" component="h2">{t('settings.general.title')}</Typography>
            </Box>
            <Divider sx={{ mb: 2.5 }} />

            <Controller
              name="contact_email"
              control={control}
              render={({ field }) => (
                <TextField
                  {...field}
                  label={t('settings.general.contactEmail')}
                  type="email"
                  fullWidth
                  size="small"
                  helperText={errors.contact_email?.message}
                  error={!!errors.contact_email}
                />
              )}
            />
          </Paper>
        </Grid>

        {/* Advanced Settings — collapsible (Level 2) */}
        <Grid size={12}>
          <Paper sx={{ p: 3 }}>
            <Box
              sx={{ display: 'flex', alignItems: 'center', gap: 1, cursor: 'pointer' }}
              onClick={() => setAdvancedOpen((prev) => !prev)}
              role="button"
              aria-expanded={advancedOpen}
              data-testid="settings.advanced.toggle"
            >
              <TuneIcon color="primary" fontSize="small" />
              <Typography variant="h6" component="h2" sx={{ flexGrow: 1 }}>
                {t('settings.advanced.title')}
              </Typography>
              <ExpandMoreIcon
                sx={{
                  transform: advancedOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                  transition: 'transform 0.2s',
                }}
              />
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              {t('settings.advanced.description')}
            </Typography>

            <Collapse in={advancedOpen}>
              <Divider sx={{ my: 2 }} />

              <Grid container spacing={3}>
                {/* Upload Limits */}
                <Grid size={12}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <CloudUploadIcon color="action" fontSize="small" />
                    <Typography variant="subtitle1" fontWeight={600}>{t('settings.uploadLimits.title')}</Typography>
                  </Box>
                  <Grid container spacing={2}>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <Controller
                        name="max_document_file_size_mb"
                        control={control}
                        render={({ field }) => (
                          <TextField
                            {...field}
                            onChange={(e) => field.onChange(Number(e.target.value))}
                            label={t('settings.uploadLimits.maxDocumentSize')}
                            type="number"
                            fullWidth
                            size="small"
                            InputProps={{
                              endAdornment: <InputAdornment position="end">MB</InputAdornment>,
                            }}
                            inputProps={{ min: 1, max: 100 }}
                            helperText={errors.max_document_file_size_mb?.message || '1 \u2013 100 MB'}
                            error={!!errors.max_document_file_size_mb}
                          />
                        )}
                      />
                    </Grid>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <Controller
                        name="max_media_file_size_mb"
                        control={control}
                        render={({ field }) => (
                          <TextField
                            {...field}
                            onChange={(e) => field.onChange(Number(e.target.value))}
                            label={t('settings.uploadLimits.maxMediaSize')}
                            type="number"
                            fullWidth
                            size="small"
                            InputProps={{
                              endAdornment: <InputAdornment position="end">MB</InputAdornment>,
                            }}
                            inputProps={{ min: 1, max: 500 }}
                            helperText={errors.max_media_file_size_mb?.message || '1 \u2013 500 MB'}
                            error={!!errors.max_media_file_size_mb}
                          />
                        )}
                      />
                    </Grid>
                  </Grid>
                </Grid>

                {/* Feature Toggles */}
                <Grid size={12}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <TuneIcon color="action" fontSize="small" />
                    <Typography variant="subtitle1" fontWeight={600}>{t('settings.featureToggles.title')}</Typography>
                  </Box>
                  <Grid container spacing={2}>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <Controller
                        name="analytics_enabled"
                        control={control}
                        render={({ field }) => (
                          <Paper variant="outlined" sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <Box>
                              <Typography variant="body1" fontWeight={500}>{t('settings.featureToggles.analytics')}</Typography>
                              <Typography variant="caption" color="text.secondary">
                                {t('settings.featureToggles.analyticsDescription')}
                              </Typography>
                            </Box>
                            <Switch checked={field.value} onChange={field.onChange} />
                          </Paper>
                        )}
                      />
                    </Grid>

                    <Grid size={{ xs: 12, sm: 6 }}>
                      <Controller
                        name="maintenance_mode"
                        control={control}
                        render={({ field }) => (
                          <Paper
                            variant="outlined"
                            sx={{
                              p: 2,
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              borderColor: field.value ? 'warning.main' : undefined,
                            }}
                          >
                            <Box>
                              <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                                <Typography variant="body1" fontWeight={500}>{t('settings.featureToggles.maintenanceMode')}</Typography>
                                {field.value && <Chip label={t('common.status.active')} color="warning" size="small" />}
                              </Box>
                              <Typography variant="caption" color="text.secondary">
                                {t('settings.featureToggles.maintenanceModeDescription')}
                              </Typography>
                            </Box>
                            <Switch checked={field.value} onChange={field.onChange} color="warning" />
                          </Paper>
                        )}
                      />
                    </Grid>

                    <Grid size={{ xs: 12, sm: 6 }}>
                      <Controller
                        name="editorial_workflow_enabled"
                        control={control}
                        render={({ field }) => (
                          <Paper
                            ref={workflowRef}
                            variant="outlined"
                            sx={{
                              p: 2,
                              display: 'flex',
                              justifyContent: 'space-between',
                              alignItems: 'center',
                              ...(highlightField === 'editorial_workflow' && {
                                borderColor: 'primary.main',
                                borderWidth: 2,
                                boxShadow: (theme) => `0 0 0 3px ${theme.palette.primary.main}25`,
                              }),
                            }}
                          >
                            <Box>
                              <Typography variant="body1" fontWeight={500}>{t('settings.featureToggles.editorialWorkflow')}</Typography>
                              <Typography variant="caption" color="text.secondary">
                                {t('settings.featureToggles.editorialWorkflowDescription')}
                              </Typography>
                            </Box>
                            <Switch checked={field.value} onChange={field.onChange} />
                          </Paper>
                        )}
                      />
                    </Grid>
                  </Grid>
                </Grid>

                {/* Preview Templates */}
                <Grid size={12}>
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                    <VisibilityIcon color="action" fontSize="small" />
                    <Typography variant="subtitle1" fontWeight={600}>{t('settings.preview.title')}</Typography>
                  </Box>
                  <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                    {t('settings.preview.description')}
                  </Typography>

                  <Stack spacing={1.5}>
                    {previewTemplates.map((pt, index) => (
                      <Box key={index} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                        <TextField
                          value={pt.name}
                          onChange={(e) => handleTemplateChange(index, 'name', e.target.value)}
                          label={t('settings.preview.name')}
                          size="small"
                          sx={{ flex: 1 }}
                        />
                        <TextField
                          value={pt.url}
                          onChange={(e) => handleTemplateChange(index, 'url', e.target.value)}
                          label={t('settings.preview.url')}
                          size="small"
                          placeholder="http://localhost:4321"
                          sx={{ flex: 2 }}
                        />
                        <Tooltip title={t('settings.preview.openPreview')}>
                          <span>
                            <IconButton
                              size="small"
                              disabled={!pt.url.trim()}
                              onClick={() => window.open(pt.url, '_blank')}
                            >
                              <OpenInNewIcon fontSize="small" />
                            </IconButton>
                          </span>
                        </Tooltip>
                        <Tooltip title={t('common.actions.delete')}>
                          <IconButton size="small" color="error" onClick={() => handleRemoveTemplate(index)}>
                            <DeleteIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Box>
                    ))}
                    <Box>
                      <Button
                        size="small"
                        startIcon={<AddIcon />}
                        onClick={handleAddTemplate}
                      >
                        {t('settings.preview.add')}
                      </Button>
                    </Box>
                  </Stack>
                </Grid>
              </Grid>
            </Collapse>
          </Paper>
        </Grid>

        {/* Save */}
        <Grid size={12}>
          <Box sx={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button
              type="submit"
              variant="contained"
              startIcon={<SaveIcon />}
              disabled={!(isDirty || previewTemplatesDirty) || mutation.isPending}
              size="large"
            >
              {mutation.isPending ? t('common.actions.saving') : t('settings.saveButton')}
            </Button>
          </Box>
        </Grid>
      </Grid>

    </form>
  );
}

// ─── Modules Tab ────────────────────────────────────────────────────

const MODULE_DEFS = [
  { key: 'module_blog_enabled' as const, labelKey: 'settings.modules.blog', descKey: 'settings.modules.blogDesc' },
  { key: 'module_pages_enabled' as const, labelKey: 'settings.modules.pages', descKey: 'settings.modules.pagesDesc' },
  { key: 'module_cv_enabled' as const, labelKey: 'settings.modules.cv', descKey: 'settings.modules.cvDesc' },
  { key: 'module_legal_enabled' as const, labelKey: 'settings.modules.legal', descKey: 'settings.modules.legalDesc' },
  { key: 'module_documents_enabled' as const, labelKey: 'settings.modules.documents', descKey: 'settings.modules.documentsDesc' },
  { key: 'module_ai_enabled' as const, labelKey: 'settings.modules.ai', descKey: 'settings.modules.aiDesc' },
] as const;

type ModuleKey = typeof MODULE_DEFS[number]['key'];

function ModulesTab() {
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
  });
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (settings) {
      setModules({
        module_blog_enabled: settings.module_blog_enabled,
        module_pages_enabled: settings.module_pages_enabled,
        module_cv_enabled: settings.module_cv_enabled,
        module_legal_enabled: settings.module_legal_enabled,
        module_documents_enabled: settings.module_documents_enabled,
        module_ai_enabled: settings.module_ai_enabled,
      });
      setDirty(false);
    }
  }, [settings]);

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

// ─── System Information Tab ─────────────────────────────────────────

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  const value = bytes / Math.pow(1024, i);
  return `${value.toFixed(i > 0 ? 1 : 0)} ${units[i]}`;
}

function SystemInfoTab() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: health, isLoading: healthLoading, error: healthError, refetch: refetchHealth } = useQuery({
    queryKey: ['health'],
    queryFn: () => apiService.getHealth(),
    retry: false,
    refetchInterval: 30_000,
  });

  const { data: environments, isLoading: envLoading } = useQuery({
    queryKey: ['environments'],
    queryFn: () => apiService.getEnvironments(),
  });

  const statusCfg = health ? STATUS_CONFIG[health.status] : null;

  return (
    <Grid container spacing={3}>
      {/* Server Health */}
      <Grid size={12}>
        <Paper sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <StorageIcon color="primary" fontSize="small" />
              <Typography variant="h6" component="h2">{t('settings.systemInfo.serverHealth')}</Typography>
            </Box>
            <Tooltip title={t('common.actions.refresh')}>
              <IconButton aria-label={t('common.actions.refresh')} onClick={() => refetchHealth()} disabled={healthLoading} size="small">
                <RefreshIcon />
              </IconButton>
            </Tooltip>
          </Box>
          <Divider sx={{ mb: 2 }} />

          {healthLoading ? (
            <LoadingState label={t('settings.systemInfo.checkingHealth')} />
          ) : healthError ? (
            <Alert severity="error">{t('common.errors.serverUnreachable')}</Alert>
          ) : health ? (
            <Stack spacing={2}>
              <Alert severity={statusCfg!.color} icon={statusCfg!.icon}>
                {t('settings.systemInfo.overallStatus')} <strong>{t(statusCfg!.labelKey)}</strong>
                {health.version && (
                  <Chip label={`v${health.version}`} size="small" variant="outlined" sx={{ ml: 1.5, height: 22 }} />
                )}
              </Alert>

              <TableContainer>
                <Table size="small">
                  <TableHead>
                    <TableRow>
                      <TableCell scope="col">{t('settings.systemInfo.service')}</TableCell>
                      <TableCell scope="col">{t('settings.systemInfo.status')}</TableCell>
                      <TableCell scope="col">{t('settings.systemInfo.latency')}</TableCell>
                      <TableCell scope="col">{t('settings.systemInfo.details')}</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {health.services.map((svc) => (
                      <TableRow key={svc.name}>
                        <TableCell>
                          <Typography variant="body2" fontWeight={500} sx={{ textTransform: 'capitalize' }}>
                            {svc.name}
                          </Typography>
                        </TableCell>
                        <TableCell>
                          <Chip
                            label={svc.status === 'up' ? t('common.status.up') : t('common.status.down')}
                            size="small"
                            color={svc.status === 'up' ? 'success' : 'error'}
                          />
                        </TableCell>
                        <TableCell>
                          {svc.latency_ms != null ? `${svc.latency_ms} ms` : '\u2014'}
                        </TableCell>
                        <TableCell>
                          {svc.error ? (
                            <Typography variant="body2" color="error.main">{svc.error}</Typography>
                          ) : '\u2014'}
                        </TableCell>
                      </TableRow>
                    ))}
                    {health.storage && (() => {
                      const s = health.storage;
                      const details: string[] = [];
                      if (s.bucket) details.push(`Bucket: ${s.bucket}`);
                      if (s.used_percent != null) details.push(`${s.used_percent}% used`);
                      if (s.available_bytes != null) details.push(`${formatBytes(s.available_bytes)} free`);
                      if (s.total_bytes != null) details.push(`${formatBytes(s.total_bytes)} total`);
                      if (s.error) details.push(s.error);
                      return (
                        <TableRow key={s.name}>
                          <TableCell>
                            <Typography variant="body2" fontWeight={500} sx={{ textTransform: 'capitalize' }}>
                              {s.name}
                            </Typography>
                          </TableCell>
                          <TableCell>
                            <Chip
                              label={s.status === 'up' ? t('common.status.up') : t('common.status.down')}
                              size="small"
                              color={s.status === 'up' ? 'success' : 'error'}
                            />
                          </TableCell>
                          <TableCell>
                            {s.latency_ms != null ? `${s.latency_ms} ms` : '\u2014'}
                          </TableCell>
                          <TableCell>
                            {details.length > 0 ? (
                              <Typography variant="body2" color={s.error ? 'error.main' : 'text.secondary'}>
                                {details.join(' \u2022 ')}
                              </Typography>
                            ) : '\u2014'}
                          </TableCell>
                        </TableRow>
                      );
                    })()}
                  </TableBody>
                </Table>
              </TableContainer>

              <Typography variant="caption" color="text.secondary">
                {t('settings.systemInfo.autoRefresh')}
              </Typography>
            </Stack>
          ) : null}
        </Paper>
      </Grid>

      {/* Environments & Locales side by side */}
      <Grid size={{ xs: 12, md: 6 }}>
        <Paper sx={{ p: 3, height: '100%' }}>
          <Typography variant="h6" component="h2" gutterBottom>{t('settings.systemInfo.environments')}</Typography>
          <Divider sx={{ mb: 2 }} />

          {envLoading ? (
            <LoadingState label={t('settings.systemInfo.loadingEnvironments')} />
          ) : !environments || environments.length === 0 ? (
            <Alert severity="info">{t('settings.systemInfo.noEnvironments')}</Alert>
          ) : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell scope="col">{t('settings.systemInfo.envName')}</TableCell>
                    <TableCell scope="col">{t('settings.systemInfo.envDisplayName')}</TableCell>
                    <TableCell scope="col">{t('settings.systemInfo.envDefault')}</TableCell>
                    <TableCell scope="col">{t('settings.systemInfo.envCreated')}</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {environments.map((env) => (
                    <TableRow key={env.id}>
                      <TableCell>
                        <Chip label={env.name} size="small" variant="outlined" />
                      </TableCell>
                      <TableCell>{env.display_name}</TableCell>
                      <TableCell>
                        {env.is_default && <Chip label={t('common.labels.default')} size="small" color="primary" />}
                      </TableCell>
                      <TableCell>{format(new Date(env.created_at), 'PP')}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Paper>
      </Grid>

      <Grid size={{ xs: 12, md: 6 }}>
        <Paper sx={{ p: 3, height: '100%' }}>
          <Typography variant="h6" component="h2" gutterBottom>{t('settings.systemInfo.locales')}</Typography>
          <Divider sx={{ mb: 2 }} />

          <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
            {t('settings.systemInfo.localesMovedDescription')}
          </Typography>
          <Button
            variant="outlined"
            startIcon={<LanguageIcon />}
            onClick={() => navigate('/locales')}
          >
            {t('settings.systemInfo.manageLocales')}
          </Button>
        </Paper>
      </Grid>
    </Grid>
  );
}

// ─── Preferences Tab ────────────────────────────────────────────────

function PreferencesTab() {
  const { t } = useTranslation();
  const { preferences, updatePreferences } = useUserPreferences();
  const { themeId, options: themeOptions } = useThemeMode();

  return (
    <Grid container spacing={3}>
      {/* Language */}
      <Grid size={{ xs: 12, md: 6 }}>
        <Paper sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <LanguageIcon color="primary" fontSize="small" />
            <Typography variant="h6" component="h2">{t('settings.preferences.language.title')}</Typography>
          </Box>
          <Divider sx={{ mb: 2.5 }} />

          <TextField
            select
            label={t('settings.preferences.language.label')}
            value={preferences.language}
            onChange={(e) => updatePreferences({ language: e.target.value })}
            fullWidth
            size="small"
            helperText={t('settings.preferences.language.description')}
          >
            {SUPPORTED_LANGUAGES.map((lang) => (
              <MenuItem key={lang.code} value={lang.code}>
                {lang.nativeName} ({lang.name})
              </MenuItem>
            ))}
          </TextField>
        </Paper>
      </Grid>

      {/* Theme */}
      <Grid size={{ xs: 12, md: 6 }}>
        <Paper sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <PaletteIcon color="primary" fontSize="small" />
            <Typography variant="h6" component="h2">{t('settings.preferences.theme.title')}</Typography>
          </Box>
          <Divider sx={{ mb: 2.5 }} />

          <TextField
            select
            label={t('settings.preferences.theme.label')}
            value={themeId}
            onChange={(e) => updatePreferences({ theme_id: e.target.value })}
            fullWidth
            size="small"
            helperText={t('settings.preferences.theme.description')}
          >
            {themeOptions.map((opt) => (
              <MenuItem key={opt.id} value={opt.id}>
                {opt.label} {opt.mode !== 'system' ? `(${opt.mode})` : ''}
              </MenuItem>
            ))}
          </TextField>
        </Paper>
      </Grid>

      {/* Autosave */}
      <Grid size={{ xs: 12, md: 6 }}>
        <Paper sx={{ p: 3, height: '100%' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <SaveAltIcon color="primary" fontSize="small" />
            <Typography variant="h6" component="h2">{t('settings.preferences.autosave.title')}</Typography>
          </Box>
          <Divider sx={{ mb: 2.5 }} />

          <Stack spacing={2.5}>
            <Stack direction="row" alignItems="center" justifyContent="space-between">
              <Box>
                <Typography variant="body1">{t('settings.preferences.autosave.enableLabel')}</Typography>
                <Typography variant="body2" color="text.secondary">
                  {t('settings.preferences.autosave.enableDescription')}
                </Typography>
              </Box>
              <Switch
                checked={preferences.autosave_enabled}
                onChange={(e) => updatePreferences({ autosave_enabled: e.target.checked })}
              />
            </Stack>

            <TextField
              type="number"
              label={t('settings.preferences.autosave.debounceLabel')}
              helperText={t('settings.preferences.autosave.debounceDescription')}
              size="small"
              fullWidth
              disabled={!preferences.autosave_enabled}
              defaultValue={preferences.autosave_debounce_seconds}
              key={preferences.autosave_debounce_seconds}
              slotProps={{
                input: {
                  endAdornment: <InputAdornment position="end">{t('settings.preferences.autosave.seconds')}</InputAdornment>,
                },
                htmlInput: { min: 1, max: 60 },
              }}
              onBlur={(e) => {
                const val = parseInt(e.target.value, 10);
                if (!isNaN(val) && val >= 1 && val <= 60 && val !== preferences.autosave_debounce_seconds) {
                  updatePreferences({ autosave_debounce_seconds: val });
                }
              }}
            />
          </Stack>
        </Paper>
      </Grid>

      {/* Table Display */}
      <Grid size={{ xs: 12, md: 6 }}>
        <Paper sx={{ p: 3, height: '100%' }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <TableChartIcon color="primary" fontSize="small" />
            <Typography variant="h6" component="h2">{t('settings.preferences.tableDisplay.title')}</Typography>
          </Box>
          <Divider sx={{ mb: 2.5 }} />

          <TextField
            select
            label={t('settings.preferences.tableDisplay.pageSizeLabel')}
            helperText={t('settings.preferences.tableDisplay.pageSizeDescription')}
            size="small"
            fullWidth
            value={preferences.page_size}
            onChange={(e) => {
              const val = Number(e.target.value);
              if (val !== preferences.page_size) {
                updatePreferences({ page_size: val });
              }
            }}
          >
            {[10, 25, 50, 100].map((size) => (
              <MenuItem key={size} value={size}>{size}</MenuItem>
            ))}
          </TextField>
        </Paper>
      </Grid>
    </Grid>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────

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

  // 4. System Info — master only
  if (isMaster) {
    tabs.push({
      key: 'systemInfo',
      icon: <StorageIcon />,
      label: t('settings.tabs.systemInfo'),
      content: <SystemInfoTab />,
    });
  }

  // 5. Legal — admin + site selected + module enabled
  if (isAdmin && selectedSiteId && modules.legal) {
    tabs.push({
      key: 'legal',
      icon: <GavelIcon />,
      label: t('settings.tabs.legal'),
      content: <LegalPage embedded />,
    });
  }

  // 5. API Keys — admin only
  if (isAdmin) {
    tabs.push({
      key: 'apiKeys',
      icon: <KeyIcon />,
      label: t('settings.tabs.apiKeys'),
      content: <ApiKeysPage embedded />,
    });
  }

  // Auto-switch to siteSettings tab when highlight param is set
  useEffect(() => {
    if (highlightField) {
      const idx = tabs.findIndex((t) => t.key === 'siteSettings');
      if (idx >= 0) setTabIndex(idx);
    }
  }, [highlightField]); // eslint-disable-line react-hooks/exhaustive-deps

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
