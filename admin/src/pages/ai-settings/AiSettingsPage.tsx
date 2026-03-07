import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Alert,
  Box,
  Button,
  CircularProgress,
  Paper,
  Slider,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import {
  AutoAwesome as AiIcon,
  Delete as DeleteIcon,
  ExpandMore as ExpandMoreIcon,
  Save as SaveIcon,
  Science as TestIcon,
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';

import apiService from '@/services/api';
import { useSiteContext } from '@/store/SiteContext';
import type { AiConfigResponse, CreateAiConfigRequest } from '@/types/api';
import ConfirmDialog from '@/components/shared/ConfirmDialog';

const aiConfigSchema = z.object({
  provider_name: z.string().min(1, 'Required').max(100),
  base_url: z.string().min(1, 'Required').max(500).url('Must be a valid URL'),
  api_key: z.string().min(1, 'Required').max(500),
  model: z.string().min(1, 'Required').max(200),
  temperature: z.number().min(0).max(2),
  max_tokens: z.number().int().min(1).max(16384),
  system_prompt_seo: z.string().max(2000).optional(),
  system_prompt_excerpt: z.string().max(2000).optional(),
  system_prompt_translate: z.string().max(2000).optional(),
});

type AiConfigFormData = z.infer<typeof aiConfigSchema>;

function buildFormDefaults(config?: AiConfigResponse | null): AiConfigFormData {
  return {
    provider_name: config?.provider_name ?? '',
    base_url: config?.base_url ?? 'https://api.openai.com',
    api_key: '',
    model: config?.model ?? 'gpt-4o-mini',
    temperature: config?.temperature ?? 0.7,
    max_tokens: config?.max_tokens ?? 1024,
    system_prompt_seo: config?.system_prompts?.seo ?? '',
    system_prompt_excerpt: config?.system_prompts?.excerpt ?? '',
    system_prompt_translate: config?.system_prompts?.translate ?? '',
  };
}

export default function AiSettingsPage() {
  const { t } = useTranslation();
  const { selectedSiteId } = useSiteContext();
  const { enqueueSnackbar } = useSnackbar();
  const queryClient = useQueryClient();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const configQuery = useQuery({
    queryKey: ['ai-config', selectedSiteId],
    queryFn: () => apiService.getAiConfig(selectedSiteId),
    enabled: !!selectedSiteId,
    retry: false,
  });

  const hasExistingConfig = configQuery.isSuccess && !!configQuery.data;

  const {
    control,
    handleSubmit,
    reset,
    formState: { isDirty, isSubmitting },
  } = useForm<AiConfigFormData>({
    resolver: zodResolver(aiConfigSchema),
    defaultValues: buildFormDefaults(),
  });

  useEffect(() => {
    if (configQuery.data) {
      reset(buildFormDefaults(configQuery.data));
    }
  }, [configQuery.data, reset]);

  const saveMutation = useMutation({
    mutationFn: (data: CreateAiConfigRequest) =>
      apiService.upsertAiConfig(selectedSiteId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-config', selectedSiteId] });
      enqueueSnackbar(t('aiSettings.messages.saved'), { variant: 'success' });
    },
    onError: () => {
      enqueueSnackbar(t('aiSettings.messages.saveFailed'), { variant: 'error' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => apiService.deleteAiConfig(selectedSiteId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-config', selectedSiteId] });
      reset(buildFormDefaults());
      enqueueSnackbar(t('aiSettings.messages.deleted'), { variant: 'success' });
    },
  });

  const testMutation = useMutation({
    mutationFn: () => apiService.testAiConnection(selectedSiteId),
    onSuccess: (result) => {
      enqueueSnackbar(result.message, {
        variant: result.success ? 'success' : 'error',
      });
    },
    onError: () => {
      enqueueSnackbar(t('aiSettings.messages.testFailed'), { variant: 'error' });
    },
  });

  const onSubmit = useCallback(
    (data: AiConfigFormData) => {
      const systemPrompts: Record<string, string> = {};
      if (data.system_prompt_seo) systemPrompts.seo = data.system_prompt_seo;
      if (data.system_prompt_excerpt) systemPrompts.excerpt = data.system_prompt_excerpt;
      if (data.system_prompt_translate) systemPrompts.translate = data.system_prompt_translate;

      saveMutation.mutate({
        provider_name: data.provider_name,
        base_url: data.base_url,
        api_key: data.api_key,
        model: data.model,
        temperature: data.temperature,
        max_tokens: data.max_tokens,
        system_prompts: Object.keys(systemPrompts).length > 0 ? systemPrompts : undefined,
      });
    },
    [saveMutation],
  );

  return (
    <Box sx={{ maxWidth: 800, mx: 'auto', p: 3 }}>
      <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 3 }}>
        <AiIcon />
        <Typography variant="h5">{t('aiSettings.title')}</Typography>
      </Stack>

      <Paper sx={{ p: 3 }}>
        <form onSubmit={handleSubmit(onSubmit)}>
          <Stack spacing={3}>
            <Controller
              name="provider_name"
              control={control}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  label={t('aiSettings.fields.providerName')}
                  helperText={fieldState.error?.message ?? t('aiSettings.fields.providerNameHelp')}
                  error={!!fieldState.error}
                  fullWidth
                  required
                />
              )}
            />

            <Controller
              name="base_url"
              control={control}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  label={t('aiSettings.fields.baseUrl')}
                  helperText={fieldState.error?.message ?? t('aiSettings.fields.baseUrlHelp')}
                  error={!!fieldState.error}
                  fullWidth
                  required
                />
              )}
            />

            <Controller
              name="api_key"
              control={control}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  label={t('aiSettings.fields.apiKey')}
                  type="password"
                  helperText={
                    fieldState.error?.message ??
                    (hasExistingConfig
                      ? `${t('aiSettings.fields.apiKeyExisting')}: ${configQuery.data?.api_key_masked}`
                      : t('aiSettings.fields.apiKeyHelp'))
                  }
                  error={!!fieldState.error}
                  fullWidth
                  required
                />
              )}
            />

            <Controller
              name="model"
              control={control}
              render={({ field, fieldState }) => (
                <TextField
                  {...field}
                  label={t('aiSettings.fields.model')}
                  helperText={fieldState.error?.message ?? t('aiSettings.fields.modelHelp')}
                  error={!!fieldState.error}
                  fullWidth
                  required
                />
              )}
            />

            <Accordion>
              <AccordionSummary expandIcon={<ExpandMoreIcon />}>
                <Typography>{t('aiSettings.advanced')}</Typography>
              </AccordionSummary>
              <AccordionDetails>
                <Stack spacing={3}>
                  <Controller
                    name="temperature"
                    control={control}
                    render={({ field }) => (
                      <Box>
                        <Typography gutterBottom>
                          {t('aiSettings.fields.temperature')}: {field.value}
                        </Typography>
                        <Slider
                          {...field}
                          onChange={(_, val) => field.onChange(val)}
                          min={0}
                          max={2}
                          step={0.1}
                          valueLabelDisplay="auto"
                        />
                      </Box>
                    )}
                  />

                  <Controller
                    name="max_tokens"
                    control={control}
                    render={({ field, fieldState }) => (
                      <TextField
                        {...field}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                        label={t('aiSettings.fields.maxTokens')}
                        type="number"
                        error={!!fieldState.error}
                        helperText={fieldState.error?.message}
                        fullWidth
                      />
                    )}
                  />

                  <Alert severity="info" sx={{ mb: 1 }}>
                    {t('aiSettings.fields.systemPromptsHelp')}
                  </Alert>

                  <Controller
                    name="system_prompt_seo"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        label={t('aiSettings.fields.systemPromptSeo')}
                        multiline
                        minRows={2}
                        fullWidth
                      />
                    )}
                  />

                  <Controller
                    name="system_prompt_excerpt"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        label={t('aiSettings.fields.systemPromptExcerpt')}
                        multiline
                        minRows={2}
                        fullWidth
                      />
                    )}
                  />

                  <Controller
                    name="system_prompt_translate"
                    control={control}
                    render={({ field }) => (
                      <TextField
                        {...field}
                        label={t('aiSettings.fields.systemPromptTranslate')}
                        multiline
                        minRows={2}
                        fullWidth
                      />
                    )}
                  />
                </Stack>
              </AccordionDetails>
            </Accordion>

            <Stack direction="row" spacing={2} justifyContent="space-between">
              <Stack direction="row" spacing={2}>
                <Button
                  type="submit"
                  variant="contained"
                  startIcon={isSubmitting ? <CircularProgress size={16} /> : <SaveIcon />}
                  disabled={!isDirty || isSubmitting}
                >
                  {t('aiSettings.actions.save')}
                </Button>

                {hasExistingConfig && (
                  <Button
                    variant="outlined"
                    startIcon={
                      testMutation.isPending ? <CircularProgress size={16} /> : <TestIcon />
                    }
                    onClick={() => testMutation.mutate()}
                    disabled={testMutation.isPending}
                  >
                    {t('aiSettings.actions.testConnection')}
                  </Button>
                )}
              </Stack>

              {hasExistingConfig && (
                <Button
                  variant="outlined"
                  color="error"
                  startIcon={<DeleteIcon />}
                  onClick={() => setShowDeleteConfirm(true)}
                >
                  {t('aiSettings.actions.remove')}
                </Button>
              )}
            </Stack>
          </Stack>
        </form>
      </Paper>

      <ConfirmDialog
        open={showDeleteConfirm}
        title={t('aiSettings.deleteConfirm.title')}
        message={t('aiSettings.deleteConfirm.message')}
        onConfirm={() => {
          deleteMutation.mutate();
          setShowDeleteConfirm(false);
        }}
        onCancel={() => setShowDeleteConfirm(false)}
      />
    </Box>
  );
}
