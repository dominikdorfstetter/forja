import { useCallback, useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Box, Stack } from '@mui/material';
import { useSnackbar } from 'notistack';
import { useNavigate } from 'react-router';

import { deleteAiConfig, getAiConfig, listAiModels, testAiConnection, upsertAiConfig } from '@/services/ai';
import { useSiteContext } from '@/store/SiteContext';
import type { AiConfigResponse, CreateAiConfigRequest, TaskConfig } from '@/types/api';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import AiAdvancedSettings from './AiAdvancedSettings';
import AiProviderForm from './AiProviderForm';
import AiTaskConfigs from './AiTaskConfigs';
import { SectionHead, M3Button } from '@/components/design-system';
import { useFormSaveBar } from '@/hooks/useFormSaveBar';
import { formResolver } from '@/utils/validation';

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
  { key: 'deepseek', label: 'DeepSeek', base_url: 'https://api.deepseek.com', model: 'deepseek-chat', requiresApiKey: true },
  { key: 'qwen', label: 'Qwen (DashScope)', base_url: 'https://dashscope-intl.aliyuncs.com/compatible-mode', model: 'qwen-plus', requiresApiKey: true },
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
  };
}

export default function AiSettingsPage() {
  const { t } = useTranslation();
  const { selectedSiteId } = useSiteContext();
  const { enqueueSnackbar } = useSnackbar();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [selectedPreset, setSelectedPreset] = useState('');
  const [discoveredModels, setDiscoveredModels] = useState<string[]>([]);
  const [taskConfigs, setTaskConfigs] = useState<Record<string, TaskConfig>>({});
  const [systemPrompts, setSystemPrompts] = useState<Record<string, string>>({});
  const [extraDirty, setExtraDirty] = useState(false);

  const configQuery = useQuery({
    queryKey: ['ai-config', selectedSiteId],
    queryFn: () => getAiConfig(selectedSiteId),
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
    resolver: formResolver(aiConfigSchema),
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

  // Load form defaults + task configs + system prompts from existing config
  useEffect(() => {
    if (configQuery.data) {
      reset(buildFormDefaults(configQuery.data));
      setSelectedPreset(detectPresetKey(configQuery.data.base_url, configQuery.data.provider_name));
      setTaskConfigs((configQuery.data.task_configs as Record<string, TaskConfig> | null | undefined) ?? {});
      setSystemPrompts((configQuery.data.system_prompts as Record<string, string> | null | undefined) ?? {});
      setExtraDirty(false);
    }
  }, [configQuery.data, reset]);

  // Auto-load models when config is loaded
  const discoverModelsMutation = useMutation({
    mutationFn: () =>
      listAiModels(selectedSiteId, {
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

  useEffect(() => {
    if (configQuery.data && watchBaseUrl && watchProviderName) {
      discoverModelsMutation.mutate();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [configQuery.data?.id]);

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

  const saveMutation = useMutation({
    mutationFn: (data: CreateAiConfigRequest) =>
      upsertAiConfig(selectedSiteId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-config', selectedSiteId] });
      enqueueSnackbar(t('aiSettings.messages.saved'), { variant: 'success' });
      setExtraDirty(false);
    },
    onError: () => {
      enqueueSnackbar(t('aiSettings.messages.saveFailed'), { variant: 'error' });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteAiConfig(selectedSiteId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['ai-config', selectedSiteId] });
      reset(buildFormDefaults());
      setSelectedPreset('');
      setDiscoveredModels([]);
      setTaskConfigs({});
      setSystemPrompts({});
      setExtraDirty(false);
      enqueueSnackbar(t('aiSettings.messages.deleted'), { variant: 'success' });
    },
  });

  const testMutation = useMutation({
    mutationFn: () => testAiConnection(selectedSiteId),
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
      saveMutation.mutate({
        provider_name: data.provider_name,
        base_url: data.base_url,
        api_key: data.api_key || undefined,
        model: data.model,
        temperature: data.temperature,
        max_tokens: data.max_tokens,
        system_prompts: Object.keys(systemPrompts).length > 0 ? systemPrompts : undefined,
        task_configs: Object.keys(taskConfigs).length > 0 ? taskConfigs : undefined,
      });
    },
    [saveMutation, systemPrompts, taskConfigs],
  );

  const canSave = isDirty || extraDirty;

  const discardChanges = useCallback(() => {
    if (configQuery.data) {
      reset(buildFormDefaults(configQuery.data));
      setSelectedPreset(detectPresetKey(configQuery.data.base_url, configQuery.data.provider_name));
      setTaskConfigs((configQuery.data.task_configs as Record<string, TaskConfig> | null | undefined) ?? {});
      setSystemPrompts((configQuery.data.system_prompts as Record<string, string> | null | undefined) ?? {});
    } else {
      reset(buildFormDefaults());
      setSelectedPreset('');
      setTaskConfigs({});
      setSystemPrompts({});
    }
    setExtraDirty(false);
  }, [configQuery.data, reset]);

  useFormSaveBar({
    id: 'site-settings.ai',
    isDirty: canSave,
    saving: isSubmitting || saveMutation.isPending,
    onSave: handleSubmit(onSubmit),
    onDiscard: discardChanges,
    saveTestId: 'site-settings.ai.save',
    discardTestId: 'site-settings.ai.discard',
  });

  return (
    <Box>
      <SectionHead
        icon="auto_awesome"
        title={t('siteSettings.ai.title', 'AI Assistant')}
        subtitle={t(
          'siteSettings.ai.subtitle',
          'The AI provider used for generating drafts, rewrites, and translations.',
        )}
      />

      {hasExistingConfig && (
        <Box sx={{ display: 'flex', gap: 1, mb: 3, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          <M3Button
            variant="outlined"
            size="sm"
            icon="analytics"
            onClick={() => navigate('/site-settings/ai/usage')}
            data-testid="site-settings.ai.view-usage"
          >
            {t('aiSettings.actions.viewUsage')}
          </M3Button>
          <M3Button
            variant="outlined"
            size="sm"
            icon={testMutation.isPending ? 'progress_activity' : 'science'}
            onClick={() => testMutation.mutate()}
            disabled={testMutation.isPending}
            data-testid="site-settings.ai.test"
          >
            {t('aiSettings.actions.testConnection')}
          </M3Button>
          <M3Button
            variant="outlined"
            size="sm"
            icon="delete"
            danger
            onClick={() => setShowDeleteConfirm(true)}
            data-testid="site-settings.ai.remove"
          >
            {t('aiSettings.actions.remove')}
          </M3Button>
        </Box>
      )}

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
            modelsLoading={discoverModelsMutation.isPending}
          />

          <AiAdvancedSettings control={control} />

          <AiTaskConfigs
            taskConfigs={taskConfigs}
            onChange={(configs) => {
              setTaskConfigs(configs);
              setExtraDirty(true);
            }}
            discoveredModels={discoveredModels}
            defaultModel={watch('model')}
            defaultTemperature={watch('temperature')}
            defaultMaxTokens={watch('max_tokens')}
            systemPrompts={systemPrompts}
            onSystemPromptsChange={(prompts) => {
              setSystemPrompts(prompts);
              setExtraDirty(true);
            }}
          />
        </Stack>
      </form>

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
