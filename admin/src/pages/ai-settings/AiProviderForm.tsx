import { useTranslation } from 'react-i18next';
import { Controller, type Control } from 'react-hook-form';
import {
  Autocomplete,
  Button,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  TextField,
} from '@mui/material';
import { Refresh as RefreshIcon } from '@mui/icons-material';

interface ProviderPreset {
  key: string;
  label: string;
  base_url: string;
  model: string;
  requiresApiKey: boolean;
}

interface AiConfigFormData {
  provider_name: string;
  base_url: string;
  api_key?: string;
  model: string;
  temperature: number;
  max_tokens: number;
  system_prompt_seo?: string;
  system_prompt_excerpt?: string;
  system_prompt_translate?: string;
}

interface AiProviderFormProps {
  control: Control<AiConfigFormData>;
  presets: ProviderPreset[];
  selectedPreset: string;
  onPresetChange: (presetKey: string) => void;
  requiresApiKey: boolean;
  hasExistingConfig: boolean;
  apiKeyMasked?: string;
  discoveredModels: string[];
  watchBaseUrl: string;
  onDiscoverModels: () => void;
  discoverLoading: boolean;
}

export default function AiProviderForm({
  control,
  presets,
  selectedPreset,
  onPresetChange,
  requiresApiKey,
  hasExistingConfig,
  apiKeyMasked,
  discoveredModels,
  watchBaseUrl,
  onDiscoverModels,
  discoverLoading,
}: AiProviderFormProps) {
  const { t } = useTranslation();

  return (
    <>
      <FormControl fullWidth>
        <InputLabel id="provider-preset-label">
          {t('aiSettings.fields.providerPreset')}
        </InputLabel>
        <Select
          labelId="provider-preset-label"
          value={selectedPreset}
          label={t('aiSettings.fields.providerPreset')}
          onChange={(e) => onPresetChange(e.target.value)}
        >
          {presets.map((preset) => (
            <MenuItem key={preset.key} value={preset.key}>
              {preset.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>

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
              (!requiresApiKey
                ? t('aiSettings.fields.apiKeyOptional')
                : hasExistingConfig
                  ? `${t('aiSettings.fields.apiKeyExisting')}: ${apiKeyMasked}`
                  : t('aiSettings.fields.apiKeyHelp'))
            }
            error={!!fieldState.error}
            fullWidth
            required={requiresApiKey}
          />
        )}
      />

      <Controller
        name="model"
        control={control}
        render={({ field, fieldState }) => (
          <Stack direction="row" spacing={1} alignItems="flex-start">
            <Autocomplete
              freeSolo
              fullWidth
              options={discoveredModels}
              value={field.value}
              onChange={(_, newValue) => field.onChange(newValue ?? '')}
              onInputChange={(_, newValue) => field.onChange(newValue)}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label={t('aiSettings.fields.model')}
                  helperText={fieldState.error?.message ?? t('aiSettings.fields.modelHelp')}
                  error={!!fieldState.error}
                  required
                />
              )}
            />
            <Button
              variant="outlined"
              onClick={onDiscoverModels}
              disabled={!watchBaseUrl || discoverLoading}
              sx={{ minWidth: 'auto', mt: '8px', px: 1.5, height: 40 }}
              aria-label={t('aiSettings.actions.discoverModels')}
            >
              {discoverLoading ? (
                <CircularProgress size={20} />
              ) : (
                <RefreshIcon />
              )}
            </Button>
          </Stack>
        )}
      />
    </>
  );
}
