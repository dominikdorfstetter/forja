import { type RefObject } from 'react';
import {
  Box,
  Paper,
  Typography,
  Chip,
  IconButton,
  Tooltip,
  Collapse,
  Divider,
  Stack,
  TextField,
  Switch,
  Button,
  InputAdornment,
  Grid,
} from '@mui/material';
import TuneIcon from '@mui/icons-material/Tune';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import VisibilityIcon from '@mui/icons-material/Visibility';
import { Controller, type Control, type FieldErrors } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type { PreviewTemplate } from '@/types/api';

type TemplateWithId = PreviewTemplate & { _id: number };

interface SettingsFormValues {
  max_document_file_size_mb: number;
  max_media_file_size_mb: number;
  analytics_enabled: boolean;
  maintenance_mode: boolean;
  contact_email?: string;
  editorial_workflow_enabled: boolean;
}

interface SiteAdvancedSettingsProps {
  control: Control<SettingsFormValues>;
  errors: FieldErrors<SettingsFormValues>;
  advancedOpen: boolean;
  onToggleAdvanced: () => void;
  highlightField?: string;
  workflowRef: RefObject<HTMLDivElement | null>;
  previewTemplates: TemplateWithId[];
  onAddTemplate: () => void;
  onRemoveTemplate: (index: number) => void;
  onTemplateChange: (index: number, field: keyof PreviewTemplate, value: string) => void;
}

export default function SiteAdvancedSettings({
  control,
  errors,
  advancedOpen,
  onToggleAdvanced,
  highlightField,
  workflowRef,
  previewTemplates,
  onAddTemplate,
  onRemoveTemplate,
  onTemplateChange,
}: SiteAdvancedSettingsProps) {
  const { t } = useTranslation();

  return (
    <Paper sx={{ p: 3 }}>
      <Box
        sx={{ display: 'flex', alignItems: 'center', gap: 1, cursor: 'pointer' }}
        onClick={onToggleAdvanced}
        role="button"
        aria-expanded={advancedOpen}
        data-testid="settings.advanced.toggle"
      >
        <TuneIcon color="primary" fontSize="small" />
        <Typography variant="h6" component="h2" sx={{ flexGrow: 1 }}>
          {t('settings.advanced.title')}
        </Typography>
        <ExpandMoreIcon
          sx={{
            transform: advancedOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 0.2s',
          }}
        />
      </Box>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
        {t('settings.advanced.description')}
      </Typography>

      <Collapse in={advancedOpen}>
        <Divider sx={{ my: 2 }} />

        <Grid container spacing={3}>
          {/* Upload Limits */}
          <Grid size={12}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <CloudUploadIcon color="action" fontSize="small" />
              <Typography variant="subtitle1" fontWeight={600}>{t('settings.uploadLimits.title')}</Typography>
            </Box>
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, sm: 6 }}>
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
              </Grid>
              <Grid size={{ xs: 12, sm: 6 }}>
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
              </Grid>
            </Grid>
          </Grid>

          {/* Feature Toggles */}
          <Grid size={12}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <TuneIcon color="action" fontSize="small" />
              <Typography variant="subtitle1" fontWeight={600}>{t('settings.featureToggles.title')}</Typography>
            </Box>
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
                    <Paper
                      ref={workflowRef}
                      variant="outlined"
                      sx={{
                        p: 2,
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        ...(highlightField === 'editorial_workflow' && {
                          borderColor: 'primary.main',
                          borderWidth: 2,
                          boxShadow: (theme) => `0 0 0 3px ${theme.palette.primary.main}25`,
                        }),
                      }}
                    >
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
          </Grid>

          {/* Preview Templates */}
          <Grid size={12}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
              <VisibilityIcon color="action" fontSize="small" />
              <Typography variant="subtitle1" fontWeight={600}>{t('settings.preview.title')}</Typography>
            </Box>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
              {t('settings.preview.description')}
            </Typography>

            <Stack spacing={1.5}>
              {previewTemplates.map((pt, index) => (
                <Box key={pt._id} sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
                  <TextField
                    value={pt.name}
                    onChange={(e) => onTemplateChange(index, 'name', e.target.value)}
                    label={t('settings.preview.name')}
                    size="small"
                    sx={{ flex: 1 }}
                  />
                  <TextField
                    value={pt.url}
                    onChange={(e) => onTemplateChange(index, 'url', e.target.value)}
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
                    <IconButton size="small" color="error" onClick={() => onRemoveTemplate(index)}>
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Box>
              ))}
              <Box>
                <Button
                  size="small"
                  startIcon={<AddIcon />}
                  onClick={onAddTemplate}
                >
                  {t('settings.preview.add')}
                </Button>
              </Box>
            </Stack>
          </Grid>
        </Grid>
      </Collapse>
    </Paper>
  );
}
