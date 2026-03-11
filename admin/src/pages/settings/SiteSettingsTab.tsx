import { useEffect, useRef, useState } from 'react';
import {
  Box,
  Paper,
  Typography,
  Alert,
  Divider,
  TextField,
  Button,
  Grid,
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import SettingsIcon from '@mui/icons-material/Settings';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useSnackbar } from 'notistack';
import { useTranslation } from 'react-i18next';
import apiService from '@/services/api';
import LoadingState from '@/components/shared/LoadingState';
import { useSiteContext } from '@/store/SiteContext';
import type { UpdateSiteSettingsRequest, PreviewTemplate } from '@/types/api';
import { useUnsavedChanges } from '@/hooks/useUnsavedChanges';
import SiteAdvancedSettings from './SiteAdvancedSettings';

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

type TemplateWithId = PreviewTemplate & { _id: number };

export default function SiteSettingsTab({ highlightField }: { highlightField?: string }) {
  const { t } = useTranslation();
  const { selectedSiteId } = useSiteContext();
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const workflowRef = useRef<HTMLDivElement>(null);
  const templateIdCounter = useRef(0);

  const [previewTemplates, setPreviewTemplates] = useState<TemplateWithId[]>([]);
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

  const prevSettingsRef = useRef<typeof settings>(undefined);
  if (settings && settings !== prevSettingsRef.current) {
    prevSettingsRef.current = settings;
    reset({
      max_document_file_size_mb: Math.round(settings.max_document_file_size / BYTES_PER_MB),
      max_media_file_size_mb: Math.round(settings.max_media_file_size / BYTES_PER_MB),
      analytics_enabled: settings.analytics_enabled,
      maintenance_mode: settings.maintenance_mode,
      contact_email: settings.contact_email,
      editorial_workflow_enabled: settings.editorial_workflow_enabled,
    });
    setPreviewTemplates((settings.preview_templates ?? []).map(pt => ({
      ...pt,
      _id: templateIdCounter.current++,
    })));
    setPreviewTemplatesDirty(false);
  }

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
      preview_templates: previewTemplates
        .filter(pt => pt.name.trim() && pt.url.trim())
        .map(({ _id: _, ...pt }) => pt),
    });
    setPreviewTemplatesDirty(false);
  };

  const handleAddTemplate = () => {
    setPreviewTemplates(prev => [...prev, { name: '', url: '', _id: templateIdCounter.current++ }]);
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
          <SiteAdvancedSettings
            control={control}
            errors={errors}
            advancedOpen={advancedOpen}
            onToggleAdvanced={() => setAdvancedOpen((prev) => !prev)}
            highlightField={highlightField}
            workflowRef={workflowRef}
            previewTemplates={previewTemplates}
            onAddTemplate={handleAddTemplate}
            onRemoveTemplate={handleRemoveTemplate}
            onTemplateChange={handleTemplateChange}
          />
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
