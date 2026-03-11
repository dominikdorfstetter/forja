import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Box,
  Button,
  CircularProgress,
  Paper,
  Stack,
  Typography,
} from '@mui/material';
import {
  AutoAwesome as AiIcon,
  Delete as DeleteIcon,
  Save as SaveIcon,
  Science as TestIcon,
} from '@mui/icons-material';
import { useSnackbar } from 'notistack';

import apiService from '@/services/api';
import { useSiteContext } from '@/store/SiteContext';
import type { AiConfigResponse, CreateAiConfigRequest } from '@/types/api';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import AiAdvancedSettings from './AiAdvancedSettings';
import AiProviderForm from './AiProviderForm';

interface ProviderPreset {
  key: string;
  label: string;
  base_url: string;
  model: string;
  requiresApiKey: boolean;
}

const PROVIDER_PRESETS: ProviderPreset[] = [
  { key: 'openai', label: 'OpenAI', base_url: 'https://api.openai.com', model: 'gpt-4o-mini', requiresApiKey: true },
  { key: 'anthropic', label: 'Anthropic (Claude)', base_url: 'https://api.anthropic.com', model: 'claude-sonnet-4-20250514', requiresApiKey: true },
  { key: 'google', label: 'Google (Gemini)', base_url: 'https://generativelanguage.googleapis.com/v1beta/openai', model: 'gemini-2.0-flash', requiresApiKey: true },
  { key: 'mistral', label: 'Mistral', base_url: 'https://api.mistral.ai', model: 'mistral-small-latest', requiresApiKey: true },
  { key: 'lmstudio', label: 'LM Studio', base_url: 'http://localhost:1234', model: '', requiresApiKey: false },
  { key: 'ollama', label: 'Ollama', base_url: 'http://localhost:11434', model: '', requiresApiKey: false },
  { key: 'custom', label: 'Custom Provider', base_url: '', model: '', requiresApiKey: true },
];

function detectPresetKey(baseUrl: string, providerName: string): string {
  const url = baseUrl.toLowerCase();
  const name = providerName.toLowerCase();
  for (const preset of PROVIDER_PRESETS) {
    if (preset.key === 'custom') continue;
    if (preset.base_url && url.startsWith(preset.base_url.toLowerCase())) return preset.key;
    if (name.includes(preset.key)) return preset.key;
  }
  return 'custom';
}

const aiConfigSchema = z.object({
  provider_name: z.string().min(1, 'Required').max(100),
  base_url: z.string().min(1, 'Required').max(500).url('Must be a valid URL'),
  api_key: z.string().max(500).optional().or(z.literal('')),
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
    base_url: config?.base_url ?? '',
    api_key: '',
    model: config?.model ?? '',
    temperature: config?.temperature ?? 0.7,
    max_tokens: config?.max_tokens ?? 1024,
    system_prompt_seo: config?.system_prompts?.seo ?? '',
    system_prompt_excerpt: config?.system_prompts?.excerpt ?? '',
    system_prompt_translate: config?.system_prompts?.translate ?? '',
  };
}

interface AiSettingsTabProps {
  embedded?: boolean;
}

export default function AiSettingsPage({ embedded }: AiSettingsTabProps = {}) {
  const { t } = useTranslation();
  const { selectedSiteId } = useSiteContext();
  const { enqueueSnackbar } = useSnackbar();
  const queryClient = useQueryClient();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState('');
  const [discoveredModels, setDiscoveredModels] = useState<string[]>([]);

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
    setValue,
    watch,
    formState: { isDirty, isSubmitting },
  } = useForm<AiConfigFormData>({
    resolver: zodResolver(aiConfigSchema),
    defaultValues: buildFormDefaults(),
  });

  const watchBaseUrl = watch('base_url');
  const watchApiKey = watch('api_key');
  const watchProviderName = watch('provider_name');

  const currentPreset = useMemo(
    () => PROVIDER_PRESETS.find((p) => p.key === selectedPreset),
    [selectedPreset],
  );

  const requiresApiKey = currentPreset?.requiresApiKey ?? true;

  useEffect(() => {
    if (configQuery.data) {
      reset(buildFormDefaults(configQuery.data));
      setSelectedPreset(detectPresetKey(configQuery.data.base_url, configQuery.data.provider_name));
    }
  }, [configQuery.data, reset]);

  const handlePresetChange = useCallback(
    (presetKey: string) => {
      setSelectedPreset(presetKey);
      setDiscoveredModels([]);
      const preset = PROVIDER_PRESETS.find((p) => p.key === presetKey);
      if (!preset || preset.key === 'custom') return;
      setValue('provider_name', preset.label, { shouldDirty: true });
      setValue('base_url', preset.base_url, { shouldDirty: true });
      setValue('model', preset.model, { shouldDirty: true });
      if (!preset.requiresApiKey) {
        setValue('api_key', '', { shouldDirty: true });
      }
    },
    [setValue],
  );

  const discoverModelsMutation = useMutation({
    mutationFn: () =>
      apiService.listAiModels(selectedSiteId, {
        base_url: watchBaseUrl,
        api_key: watchApiKey || undefined,
        provider_name: watchProviderName,
      }),
    onSuccess: (result) => {
      setDiscoveredModels(result.models);
      if (result.models.length > 0) {
        enqueueSnackbar(t('aiSettings.messages.modelsFound', { count: result.models.length }), {
          variant: 'success',
        });
      } else {
        enqueueSnackbar(t('aiSettings.messages.noModels'), { variant: 'info' });
      }
    },
    onError: () => {
      enqueueSnackbar(t('aiSettings.messages.modelsFailed'), { variant: 'error' });
    },
  });

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
      setSelectedPreset('');
      setDiscoveredModels([]);
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
        api_key: data.api_key || undefined,
        model: data.model,
        temperature: data.temperature,
        max_tokens: data.max_tokens,
        system_prompts: Object.keys(systemPrompts).length > 0 ? systemPrompts : undefined,
      });
    },
    [saveMutation],
  );

  return (
    <Box sx={{ maxWidth: 800, mx: embedded ? undefined : 'auto', p: embedded ? 0 : 3 }}>
      {!embedded && (
        <Stack direction="row" alignItems="center" spacing={1} sx={{ mb: 3 }}>
          <AiIcon />
          <Typography variant="h5">{t('aiSettings.title')}</Typography>
        </Stack>
      )}

      <Paper sx={{ p: 3 }} elevation={embedded ? 0 : 1}>
        <form onSubmit={handleSubmit(onSubmit)}>
          <Stack spacing={3}>
            <AiProviderForm
              control={control}
              presets={PROVIDER_PRESETS}
              selectedPreset={selectedPreset}
              onPresetChange={handlePresetChange}
              requiresApiKey={requiresApiKey}
              hasExistingConfig={hasExistingConfig}
              apiKeyMasked={configQuery.data?.api_key_masked}
              discoveredModels={discoveredModels}
              watchBaseUrl={watchBaseUrl}
              onDiscoverModels={() => discoverModelsMutation.mutate()}
              discoverLoading={discoverModelsMutation.isPending}
            />

            <AiAdvancedSettings control={control} />

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
