import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Box,
  Slider,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { ExpandMore as ExpandMoreIcon } from '@mui/icons-material';
import { Controller, type Control } from 'react-hook-form';
import { useTranslation } from 'react-i18next';

interface AiConfigFormData {
  provider_name: string;
  base_url: string;
  api_key?: string;
  model: string;
  temperature: number;
  max_tokens: number;
}

interface AiAdvancedSettingsProps {
  control: Control<AiConfigFormData>;
}

export default function AiAdvancedSettings({ control }: AiAdvancedSettingsProps) {
  const { t } = useTranslation();

  return (
    <Accordion>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <Typography>{t('aiSettings.advanced')}</Typography>
      </AccordionSummary>
      <AccordionDetails>
        <Stack spacing={3}>
          <Typography variant="body2" color="text.secondary">
            {t('aiSettings.advancedDescription')}
          </Typography>

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
        </Stack>
      </AccordionDetails>
    </Accordion>
  );
}
