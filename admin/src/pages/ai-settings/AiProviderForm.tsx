import { useTranslation } from 'react-i18next';
import { Controller, type Control } from 'react-hook-form';
import {
  Autocomplete,
  CircularProgress,
  FormControl,
  Grid,
  InputLabel,
  MenuItem,
  Select,
  TextField,
} from '@mui/material';

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
  modelsLoading: boolean;
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
  modelsLoading,
}: AiProviderFormProps) {
  const { t } = useTranslation();

  return (
    <Grid container spacing={2.5}>
      {/* Provider Preset — full width */}
      <Grid size={12}>
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
      </Grid>
      {/* Provider Name + Base URL — side by side */}
      <Grid size={{ xs: 12, md: 6 }}>
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
      </Grid>
      <Grid size={{ xs: 12, md: 6 }}>
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
      </Grid>
      {/* API Key — full width */}
      <Grid size={12}>
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
              required={requiresApiKey && !hasExistingConfig}
            />
          )}
        />
      </Grid>
      {/* Model selector — auto-populated from provider */}
      <Grid size={12}>
        <Controller
          name="model"
          control={control}
          render={({ field, fieldState }) => (
            <Autocomplete
              freeSolo
              fullWidth
              loading={modelsLoading}
              options={discoveredModels}
              value={field.value}
              // eslint-disable-next-line forja/require-read-only-gate -- AiSettingsPage is admin-only routing
              onChange={(_, newValue) => field.onChange(newValue ?? '')}
              onInputChange={(_, newValue, reason) => {
                if (reason === 'input') field.onChange(newValue);
              }}
              filterOptions={(options) => options}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label={t('aiSettings.fields.model')}
                  helperText={fieldState.error?.message ?? t('aiSettings.fields.modelHelp')}
                  error={!!fieldState.error}
                  required
                  slotProps={{
                    ...params.slotProps,

                    input: {
                      ...params.slotProps.input,
                      endAdornment: (
                        <>
                          {modelsLoading ? <CircularProgress size={18} /> : null}
                          {params.slotProps.input.endAdornment}
                        </>
                      ),
                    }
                  }}
                />
              )}
            />
          )}
        />
      </Grid>
    </Grid>
  );
}
