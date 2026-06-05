import { type RefObject } from 'react';
import {
  Box,
  TextField,
  IconButton,
  Tooltip,
  InputAdornment,
} from '@mui/material';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import DeleteIcon from '@mui/icons-material/Delete';
import { Controller, type Control, type FieldErrors } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type { PreviewTemplate } from '@/types/api';
import {
  CardGroup,
  SettingsCard,
  Field,
  ToggleField,
  M3Button,
} from '@/components/design-system';

type TemplateWithId = PreviewTemplate & { _id: number; is_builtin: boolean };

interface SettingsFormValues {
  max_document_file_size_mb: number;
  max_media_file_size_mb: number;
  maintenance_mode: boolean;
  contact_email?: string;
  editorial_workflow_enabled: boolean;
  document_password_min_length: number;
  document_password_regex?: string;
}

interface SiteAdvancedSettingsProps {
  control: Control<SettingsFormValues>;
  errors: FieldErrors<SettingsFormValues>;
  highlightField?: string;
  workflowRef: RefObject<HTMLDivElement | null>;
  memberCount?: number;
  previewTemplates: TemplateWithId[];
  onAddTemplate: () => void;
  onRemoveTemplate: (index: number) => void;
  onTemplateChange: (index: number, field: keyof PreviewTemplate, value: string) => void;
}

export default function SiteAdvancedSettings({
  control,
  errors,
  highlightField,
  workflowRef,
  memberCount,
  previewTemplates,
  onAddTemplate,
  onRemoveTemplate,
  onTemplateChange,
}: SiteAdvancedSettingsProps) {
  const { t } = useTranslation();
  const showEditorial = memberCount === undefined || memberCount >= 2;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
      <CardGroup label={t('settings.uploadLimits.title')}>
        <SettingsCard>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 3 }}>
            <Controller
              name="max_document_file_size_mb"
              control={control}
              render={({ field }) => (
                <Field
                  fieldId="max_document_file_size_mb"
                  label={t('settings.uploadLimits.maxDocumentSize')}
                  hint={errors.max_document_file_size_mb?.message || '1 \u2013 100 MB'}
                >
                  <TextField
                    {...field}
                    id="max_document_file_size_mb"
                    onChange={(e) => field.onChange(Number(e.target.value))}
                    type="number"
                    fullWidth
                    size="small"
                    error={!!errors.max_document_file_size_mb}
                    slotProps={{
                      input: { endAdornment: <InputAdornment position="end">MB</InputAdornment> },
                      htmlInput: { min: 1, max: 100 },
                    }}
                  />
                </Field>
              )}
            />
            <Controller
              name="max_media_file_size_mb"
              control={control}
              render={({ field }) => (
                <Field
                  fieldId="max_media_file_size_mb"
                  label={t('settings.uploadLimits.maxMediaSize')}
                  hint={errors.max_media_file_size_mb?.message || '1 \u2013 500 MB'}
                >
                  <TextField
                    {...field}
                    id="max_media_file_size_mb"
                    onChange={(e) => field.onChange(Number(e.target.value))}
                    type="number"
                    fullWidth
                    size="small"
                    error={!!errors.max_media_file_size_mb}
                    slotProps={{
                      input: { endAdornment: <InputAdornment position="end">MB</InputAdornment> },
                      htmlInput: { min: 1, max: 500 },
                    }}
                  />
                </Field>
              )}
            />
          </Box>
        </SettingsCard>
      </CardGroup>

      <CardGroup label={t('settings.featureToggles.title')}>
        <SettingsCard>
          <Controller
            name="maintenance_mode"
            control={control}
            render={({ field }) => (
              <ToggleField
                label={t('settings.featureToggles.maintenanceMode')}
                sublabel={t('settings.featureToggles.maintenanceModeDescription')}
                checked={field.value}
                onChange={field.onChange}
              />
            )}
          />
          {showEditorial && (
            <Box
              ref={workflowRef}
              sx={{
                borderRadius: 2,
                transition: 'box-shadow 200ms, background 200ms',
                ...(highlightField === 'editorial_workflow' && {
                  outline: '2px solid var(--primary)',
                  outlineOffset: 2,
                }),
              }}
            >
              <Controller
                name="editorial_workflow_enabled"
                control={control}
                render={({ field }) => (
                  <ToggleField
                    label={t('settings.featureToggles.editorialWorkflow')}
                    sublabel={t('settings.featureToggles.editorialWorkflowDescription')}
                    checked={field.value}
                    onChange={field.onChange}
                  />
                )}
              />
            </Box>
          )}
        </SettingsCard>
      </CardGroup>

      <CardGroup label={t('settings.passwordPolicy.title')}>
        <SettingsCard>
          <div style={{ fontSize: 13, color: 'var(--on-surface-variant)', lineHeight: 1.5 }}>
            {t('settings.passwordPolicy.description')}
          </div>
          <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 3 }}>
            <Controller
              name="document_password_min_length"
              control={control}
              render={({ field }) => (
                <Field
                  fieldId="document_password_min_length"
                  label={t('settings.passwordPolicy.minLength')}
                  hint={errors.document_password_min_length?.message || '4 \u2013 128'}
                >
                  <TextField
                    {...field}
                    id="document_password_min_length"
                    onChange={(e) => field.onChange(Number(e.target.value))}
                    type="number"
                    fullWidth
                    size="small"
                    error={!!errors.document_password_min_length}
                    slotProps={{ htmlInput: { min: 4, max: 128 } }}
                  />
                </Field>
              )}
            />
            <Controller
              name="document_password_regex"
              control={control}
              render={({ field }) => (
                <Field
                  fieldId="document_password_regex"
                  label={t('settings.passwordPolicy.regex')}
                  hint={errors.document_password_regex?.message ?? `${field.value?.length ?? 0} / 500`}
                >
                  <TextField
                    {...field}
                    id="document_password_regex"
                    fullWidth
                    size="small"
                    placeholder="e.g. ^(?=.*[A-Z])(?=.*[0-9]).+$"
                    error={!!errors.document_password_regex}
                    slotProps={{ htmlInput: { maxLength: 500 } }}
                  />
                </Field>
              )}
            />
          </Box>
        </SettingsCard>
      </CardGroup>

      <CardGroup label={t('settings.preview.title')}>
        <SettingsCard>
          <div style={{ fontSize: 13, color: 'var(--on-surface-variant)', lineHeight: 1.5 }}>
            {t('settings.preview.description')}
          </div>
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.25 }}>
            {previewTemplates.map((pt, index) => (
              <Box
                key={pt._id}
                sx={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 1,
                  flexWrap: { xs: 'wrap', sm: 'nowrap' },
                }}
              >
                <TextField
                  value={pt.name}
                  onChange={(e) => onTemplateChange(index, 'name', e.target.value)}
                  label={t('settings.preview.name')}
                  size="small"
                  sx={{ flex: 1, minWidth: 140 }}
                  disabled={pt.is_builtin}
                />
                <TextField
                  value={pt.url}
                  onChange={(e) => onTemplateChange(index, 'url', e.target.value)}
                  label={t('settings.preview.url')}
                  size="small"
                  placeholder="http://localhost:4321"
                  sx={{ flex: 2, minWidth: 200 }}
                  disabled={pt.is_builtin}
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
                {!pt.is_builtin && (
                  <Tooltip title={t('common.actions.delete')}>
                    <IconButton size="small" color="error" onClick={() => onRemoveTemplate(index)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                )}
              </Box>
            ))}
            <Box>
              <M3Button variant="ghost" size="sm" icon="add" onClick={onAddTemplate}>
                {t('settings.preview.add')}
              </M3Button>
            </Box>
          </Box>
        </SettingsCard>
      </CardGroup>
    </Box>
  );
}
