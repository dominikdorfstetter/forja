import { useEffect, useState } from 'react';
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
import SettingsIcon from '@mui/icons-material/Settings';
import LanguageIcon from '@mui/icons-material/Language';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { format } from 'date-fns';
import { useSnackbar } from 'notistack';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router';
import apiService from '@/services/api';
import PageHeader from '@/components/shared/PageHeader';
import LoadingState from '@/components/shared/LoadingState';
import { useSiteContext } from '@/store/SiteContext';
import { SUPPORTED_LANGUAGES } from '@/i18n';
import GavelIcon from '@mui/icons-material/Gavel';
import KeyIcon from '@mui/icons-material/Key';
import type { UpdateSiteSettingsRequest, PreviewTemplate } from '@/types/api';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import { useAuth } from '@/store/AuthContext';
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
  posts_per_page: z.number().int().min(1, 'Min 1').max(100, 'Max 100'),
  editorial_workflow_enabled: z.boolean(),
});

type SettingsFormValues = z.infer<typeof settingsSchema>;

const BYTES_PER_MB = 1_048_576;

// ─── Site Settings Tab ──────────────────────────────────────────────

function SiteSettingsTab() {
  const { t } = useTranslation();
  const { selectedSiteId } = useSiteContext();
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();

  const [previewTemplates, setPreviewTemplates] = useState<PreviewTemplate[]>([]);
  const [previewTemplatesDirty, setPreviewTemplatesDirty] = useState(false);

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
      posts_per_page: 10,
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
        posts_per_page: settings.posts_per_page,
        editorial_workflow_enabled: settings.editorial_workflow_enabled,
      });
      setPreviewTemplates(settings.preview_templates ?? []);
      setPreviewTemplatesDirty(false);
    }
  }, [settings, reset]);

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
      posts_per_page: values.posts_per_page,
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
        {/* Upload Limits */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <CloudUploadIcon color="primary" fontSize="small" />
              <Typography variant="h6" component="h2">{t('settings.uploadLimits.title')}</Typography>
            </Box>
            <Divider sx={{ mb: 2.5 }} />

            <Stack spacing={2.5}>
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
            </Stack>
          </Paper>
        </Grid>

        {/* General Settings */}
        <Grid size={{ xs: 12, md: 6 }}>
          <Paper sx={{ p: 3, height: '100%' }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <SettingsIcon color="primary" fontSize="small" />
              <Typography variant="h6" component="h2">{t('settings.general.title')}</Typography>
            </Box>
            <Divider sx={{ mb: 2.5 }} />

            <Stack spacing={2.5}>
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

              <Controller
                name="posts_per_page"
                control={control}
                render={({ field }) => (
                  <TextField
                    {...field}
                    onChange={(e) => field.onChange(Number(e.target.value))}
                    label={t('settings.general.postsPerPage')}
                    type="number"
                    fullWidth
                    size="small"
                    inputProps={{ min: 1, max: 100 }}
                    helperText={errors.posts_per_page?.message || '1 \u2013 100'}
                    error={!!errors.posts_per_page}
                  />
                )}
              />
            </Stack>
          </Paper>
        </Grid>

        {/* Toggles */}
        <Grid size={12}>
          <Paper sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <TuneIcon color="primary" fontSize="small" />
              <Typography variant="h6" component="h2">{t('settings.featureToggles.title')}</Typography>
            </Box>
            <Divider sx={{ mb: 2 }} />

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
                    <Paper variant="outlined" sx={{ p: 2, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
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
          </Paper>
        </Grid>

        {/* Preview Templates */}
        <Grid size={12}>
          <Paper sx={{ p: 3 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <VisibilityIcon color="primary" fontSize="small" />
              <Typography variant="h6" component="h2">{t('settings.preview.title')}</Typography>
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              {t('settings.preview.description')}
            </Typography>
            <Divider sx={{ mb: 2 }} />

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
  const { t, i18n } = useTranslation();

  return (
    <Grid container spacing={3}>
      <Grid size={{ xs: 12, md: 6 }}>
        <Paper sx={{ p: 3 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
            <LanguageIcon color="primary" fontSize="small" />
            <Typography variant="h6" component="h2">{t('settings.preferences.title')}</Typography>
          </Box>
          <Divider sx={{ mb: 2.5 }} />

          <TextField
            select
            label={t('settings.preferences.language.label')}
            value={i18n.language}
            onChange={(e) => i18n.changeLanguage(e.target.value)}
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
    </Grid>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────

export default function SettingsPage() {
  const { t } = useTranslation();
  const { isAdmin } = useAuth();
  const { selectedSiteId } = useSiteContext();
  const [tabIndex, setTabIndex] = useState(0);

  return (
    <Box>
      <PageHeader title={t('settings.title')} subtitle={t('settings.subtitle')} />

      <Paper sx={{ mb: 3 }}>
        <Tabs
          value={tabIndex}
          onChange={(_, v) => setTabIndex(v)}
          variant="scrollable"
          scrollButtons="auto"
          aria-label="Settings sections"
        >
          <Tab icon={<TuneIcon />} iconPosition="start" label={t('settings.tabs.siteSettings')} />
          <Tab icon={<StorageIcon />} iconPosition="start" label={t('settings.tabs.systemInfo')} />
          <Tab icon={<LanguageIcon />} iconPosition="start" label={t('settings.tabs.preferences')} />
          {selectedSiteId && <Tab icon={<GavelIcon />} iconPosition="start" label={t('settings.tabs.legal')} />}
          {isAdmin && <Tab icon={<KeyIcon />} iconPosition="start" label={t('settings.tabs.apiKeys')} />}
        </Tabs>
      </Paper>

      {tabIndex === 0 && <SiteSettingsTab />}
      {tabIndex === 1 && <SystemInfoTab />}
      {tabIndex === 2 && <PreferencesTab />}
      {tabIndex === 3 && selectedSiteId && <LegalPage embedded />}
      {tabIndex === (selectedSiteId ? 4 : 3) && isAdmin && <ApiKeysPage embedded />}
    </Box>
  );
}
