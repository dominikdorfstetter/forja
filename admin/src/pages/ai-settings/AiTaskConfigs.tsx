import {
  Accordion,
  AccordionDetails,
  AccordionSummary,
  Autocomplete,
  Box,
  Chip,
  Slider,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import { ExpandMore as ExpandMoreIcon } from '@mui/icons-material';
import { useTranslation } from 'react-i18next';

import type { TaskConfig } from '@/types/api';

interface AiTaskConfigsProps {
  taskConfigs: Record<string, TaskConfig>;
  onChange: (configs: Record<string, TaskConfig>) => void;
  discoveredModels: string[];
  defaultModel: string;
  defaultTemperature: number;
  defaultMaxTokens: number;
  systemPrompts: Record<string, string>;
  onSystemPromptsChange: (prompts: Record<string, string>) => void;
}

const AI_TASKS = [
  { key: 'seo', labelKey: 'aiSettings.tasks.seo', descKey: 'aiSettings.tasks.seoDesc' },
  { key: 'excerpt', labelKey: 'aiSettings.tasks.excerpt', descKey: 'aiSettings.tasks.excerptDesc' },
  { key: 'translate', labelKey: 'aiSettings.tasks.translate', descKey: 'aiSettings.tasks.translateDesc' },
  { key: 'draft_outline', labelKey: 'aiSettings.tasks.draftOutline', descKey: 'aiSettings.tasks.draftOutlineDesc' },
  { key: 'draft_post', labelKey: 'aiSettings.tasks.draftPost', descKey: 'aiSettings.tasks.draftPostDesc' },
  { key: 'auto_tag', labelKey: 'aiSettings.tasks.autoTag', descKey: 'aiSettings.tasks.autoTagDesc', vision: true },
  { key: 'alt_text', labelKey: 'aiSettings.tasks.altText', descKey: 'aiSettings.tasks.altTextDesc', vision: true },
] as const;

function cleanTaskConfig(config: Record<string, unknown>): TaskConfig | undefined {
  const cleaned = Object.fromEntries(
    Object.entries(config).filter(([, v]) => v !== undefined && v !== ''),
  );
  return Object.keys(cleaned).length > 0 ? (cleaned as TaskConfig) : undefined;
}

export default function AiTaskConfigs({
  taskConfigs,
  onChange,
  discoveredModels,
  defaultModel,
  defaultTemperature,
  defaultMaxTokens,
  systemPrompts,
  onSystemPromptsChange,
}: AiTaskConfigsProps) {
  const { t } = useTranslation();

  const updateTask = (taskKey: string, field: keyof TaskConfig, value: unknown) => {
    const current = taskConfigs[taskKey] ?? {};
    const updated = { ...current, [field]: value || undefined };
    const cleaned = cleanTaskConfig(updated);
    const next = { ...taskConfigs };
    if (cleaned) {
      next[taskKey] = cleaned;
    } else {
      delete next[taskKey];
    }
    onChange(next);
  };

  const updatePrompt = (taskKey: string, value: string) => {
    const next = { ...systemPrompts };
    if (value.trim()) {
      next[taskKey] = value;
    } else {
      delete next[taskKey];
    }
    onSystemPromptsChange(next);
  };

  const hasOverrides = (taskKey: string): boolean =>
    !!taskConfigs[taskKey] || !!systemPrompts[taskKey];

  return (
    <Box>
      <Typography variant="subtitle1" sx={{ mb: 1 }}>
        {t('aiSettings.taskConfigs.title')}
      </Typography>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        {t('aiSettings.taskConfigs.description')}
      </Typography>

      {AI_TASKS.map((task) => {
        const config = taskConfigs[task.key] ?? {};
        const isVision = 'vision' in task && task.vision;

        return (
          <Accordion key={task.key} disableGutters>
            <AccordionSummary expandIcon={<ExpandMoreIcon />}>
              <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
                <Typography>{t(task.labelKey)}</Typography>
                {hasOverrides(task.key) && (
                  <Chip label={t('aiSettings.taskConfigs.custom')} size="small" color="primary" variant="outlined" />
                )}
                {isVision && (
                  <Chip label={t('aiSettings.taskConfigs.vision')} size="small" color="secondary" variant="outlined" />
                )}
              </Stack>
            </AccordionSummary>
            <AccordionDetails>
              <Stack spacing={2.5}>
                <Typography variant="body2" color="text.secondary">
                  {t(task.descKey)}
                </Typography>

                <Autocomplete
                  freeSolo
                  options={discoveredModels}
                  value={config.model ?? ''}
                  // eslint-disable-next-line forja/require-read-only-gate -- AiSettingsPage is admin-only routing
                  onChange={(_, newValue) => updateTask(task.key, 'model', newValue ?? '')}
                  onInputChange={(_, newValue, reason) => {
                    if (reason !== 'reset') updateTask(task.key, 'model', newValue);
                  }}
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label={t('aiSettings.fields.model')}
                      placeholder={defaultModel}
                      helperText={t('aiSettings.taskConfigs.modelHelp')}
                      size="small"
                    />
                  )}
                />

                <Box>
                  <Typography variant="body2" gutterBottom>
                    {t('aiSettings.fields.temperature')}: {config.temperature ?? defaultTemperature}
                  </Typography>
                  <Slider
                    value={config.temperature ?? defaultTemperature}
                    onChange={(_, val) => {
                      const numVal = val as number;
                      updateTask(
                        task.key,
                        'temperature',
                        numVal === defaultTemperature ? undefined : numVal,
                      );
                    }}
                    min={0}
                    max={2}
                    step={0.1}
                    valueLabelDisplay="auto"
                    size="small"
                  />
                </Box>

                <TextField
                  label={t('aiSettings.fields.maxTokens')}
                  type="number"
                  value={config.max_tokens ?? ''}
                  placeholder={String(defaultMaxTokens)}
                  onChange={(e) => {
                    const val = e.target.value ? Number(e.target.value) : undefined;
                    updateTask(task.key, 'max_tokens', val);
                  }}
                  helperText={t('aiSettings.taskConfigs.maxTokensHelp', { default: defaultMaxTokens })}
                  size="small"
                  fullWidth
                />

                <TextField
                  label={t('aiSettings.taskConfigs.systemPrompt')}
                  value={systemPrompts[task.key] ?? ''}
                  onChange={(e) => updatePrompt(task.key, e.target.value)}
                  placeholder={t('aiSettings.taskConfigs.systemPromptPlaceholder')}
                  multiline
                  minRows={2}
                  size="small"
                  fullWidth
                />
              </Stack>
            </AccordionDetails>
          </Accordion>
        );
      })}
    </Box>
  );
}
