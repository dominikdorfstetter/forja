import { useRef, useState } from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Stack,
  Autocomplete,
  Chip,
  Typography,
  Box,
  Radio,
  IconButton,
  Tooltip,
} from '@mui/material';
import UndoIcon from '@mui/icons-material/Undo';
import RedoIcon from '@mui/icons-material/Redo';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useQuery } from '@tanstack/react-query';
import { slugField, requiredString, optionalString } from '@/utils/validation';
import type { Site, CreateSiteRequest, Locale, SiteLocaleInput } from '@/types/api';
import { useTranslation } from 'react-i18next';
import apiService from '@/services/api';
import { useFormHistory } from '@/hooks/useFormHistory';

const siteSchema = z.object({
  name: requiredString(200),
  slug: slugField,
  description: optionalString(1000),
  timezone: optionalString(50),
});

type SiteFormData = z.infer<typeof siteSchema>;

interface SiteFormDialogProps {
  open: boolean;
  site?: Site | null;
  onSubmit: (data: CreateSiteRequest) => void;
  onClose: () => void;
  loading?: boolean;
}

export default function SiteFormDialog({ open, site, onSubmit, onClose, loading }: SiteFormDialogProps) {
  const { t } = useTranslation();
  const isCreateMode = !site;

  const { register, handleSubmit, reset, getValues, formState: { errors, isValid } } = useForm<SiteFormData>({
    resolver: zodResolver(siteSchema),
    defaultValues: {
      name: '',
      slug: '',
      description: '',
      timezone: 'UTC',
    },
    mode: 'onChange',
  });

  const { snapshot, undo, redo, canUndo, canRedo, clear } = useFormHistory(getValues, reset);

  // Locale selection state (create mode only)
  const [selectedLocales, setSelectedLocales] = useState<Locale[]>([]);
  const [defaultLocaleId, setDefaultLocaleId] = useState<string | null>(null);
  const [localeError, setLocaleError] = useState<string | null>(null);

  const { data: allLocales = [] } = useQuery({
    queryKey: ['locales'],
    queryFn: () => apiService.getLocales(),
    enabled: open && isCreateMode,
  });

  // Reset form when dialog opens
  const prevOpenRef = useRef(false);
  if (open && !prevOpenRef.current) {
    clear();
    reset(site ? {
      name: site.name,
      slug: site.slug,
      description: site.description || '',
      timezone: site.timezone,
    } : {
      name: '',
      slug: '',
      description: '',
      timezone: 'UTC',
    });
    if (!site) {
      setSelectedLocales([]);
      setDefaultLocaleId(null);
      setLocaleError(null);
    }
    setTimeout(() => snapshot(), 0);
  }
  prevOpenRef.current = open;

  // Derive effective default locale from selection (no useEffect needed)
  const effectiveDefaultLocaleId = (() => {
    if (selectedLocales.length === 0) return null;
    if (selectedLocales.length === 1) return selectedLocales[0].id;
    if (defaultLocaleId && selectedLocales.find((l) => l.id === defaultLocaleId)) return defaultLocaleId;
    return selectedLocales[0].id;
  })();

  const onFormSubmit = (data: SiteFormData) => {
    // Validate locales in create mode
    if (isCreateMode && selectedLocales.length > 0) {
      if (!effectiveDefaultLocaleId) {
        setLocaleError(t('forms.site.validation.exactlyOneDefault'));
        return;
      }
      setLocaleError(null);
    }

    const locales: SiteLocaleInput[] | undefined =
      isCreateMode && selectedLocales.length > 0
        ? selectedLocales.map((l) => ({
            locale_id: l.id,
            is_default: l.id === effectiveDefaultLocaleId,
            url_prefix: l.code,
          }))
        : undefined;

    onSubmit({
      name: data.name,
      slug: data.slug,
      description: data.description || undefined,
      timezone: data.timezone || undefined,
      locales,
    });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth aria-labelledby="site-form-title" data-testid="site-form.dialog">
      <form onSubmit={handleSubmit(onFormSubmit)}>
        <DialogTitle id="site-form-title">{site ? t('forms.site.editTitle') : t('forms.site.createTitle')}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <TextField
              label={t('forms.site.fields.name')}
              fullWidth
              required
              {...register('name')}
              onBlur={snapshot}
              error={!!errors.name}
              helperText={errors.name?.message}
              autoFocus
            />
            <TextField
              label={t('forms.site.fields.slug')}
              fullWidth
              required
              {...register('slug')}
              onBlur={snapshot}
              error={!!errors.slug}
              helperText={errors.slug?.message}
              disabled={!!site}
            />
            <TextField
              label={t('forms.site.fields.description')}
              fullWidth
              multiline
              rows={3}
              {...register('description')}
              onBlur={snapshot}
              error={!!errors.description}
              helperText={errors.description?.message}
            />
            <TextField
              label="Timezone"
              fullWidth
              {...register('timezone')}
              onBlur={snapshot}
              error={!!errors.timezone}
              helperText={errors.timezone?.message || 'e.g. Europe/Vienna, UTC'}
            />

            {/* Locale selection in create mode only */}
            {isCreateMode && (
              <Box>
                <Autocomplete
                  multiple
                  options={allLocales}
                  getOptionLabel={(option) =>
                    `${option.code} — ${option.name}${option.native_name ? ` (${option.native_name})` : ''}`
                  }
                  value={selectedLocales}
                  onChange={(_, value) => setSelectedLocales(value)}
                  renderTags={(value, getTagProps) =>
                    value.map((option, index) => {
                      const { key, ...tagProps } = getTagProps({ index });
                      return (
                        <Chip
                          key={key}
                          label={`${option.code} — ${option.name}`}
                          {...tagProps}
                          color={option.id === effectiveDefaultLocaleId ? 'primary' : 'default'}
                          size="small"
                        />
                      );
                    })
                  }
                  renderInput={(params) => (
                    <TextField
                      {...params}
                      label={t('forms.site.fields.initialLanguages')}
                      helperText={localeError || t('forms.site.fields.initialLanguagesHelper')}
                      error={!!localeError}
                    />
                  )}
                />

                {selectedLocales.length > 1 && (
                  <Box sx={{ mt: 1 }}>
                    <Typography variant="caption" color="text.secondary">
                      {t('forms.site.fields.defaultLanguage')}:
                    </Typography>
                    <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.5, mt: 0.5 }}>
                      {selectedLocales.map((locale) => (
                        <Chip
                          key={locale.id}
                          label={`${locale.code} — ${locale.name}`}
                          size="small"
                          icon={
                            <Radio
                              checked={locale.id === effectiveDefaultLocaleId}
                              size="small"
                              sx={{ p: 0 }}
                            />
                          }
                          onClick={() => setDefaultLocaleId(locale.id)}
                          variant={locale.id === effectiveDefaultLocaleId ? 'filled' : 'outlined'}
                          color={locale.id === effectiveDefaultLocaleId ? 'primary' : 'default'}
                          sx={{ cursor: 'pointer' }}
                        />
                      ))}
                    </Box>
                  </Box>
                )}
              </Box>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Tooltip title={t('forms.undo')}>
            <span>
              <IconButton size="small" onClick={undo} disabled={!canUndo}><UndoIcon fontSize="small" /></IconButton>
            </span>
          </Tooltip>
          <Tooltip title={t('forms.redo')}>
            <span>
              <IconButton size="small" onClick={redo} disabled={!canRedo}><RedoIcon fontSize="small" /></IconButton>
            </span>
          </Tooltip>
          <Box sx={{ flex: 1 }} />
          <Button onClick={onClose} disabled={loading} data-testid="site-form.btn.cancel">{t('common.actions.cancel')}</Button>
          <Button type="submit" variant="contained" disabled={loading || !isValid} data-testid="site-form.btn.submit">
            {loading ? t('common.actions.saving') : (site ? t('common.actions.save') : t('common.actions.create'))}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
