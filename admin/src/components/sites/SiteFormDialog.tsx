import { useRef, useState, useEffect, useMemo } from 'react';
import {
  TextField,
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
import { z } from 'zod';
import { useQuery } from '@tanstack/react-query';
import { slugField, requiredString, optionalString, formResolver} from '@/utils/validation';
import type { Site, CreateSiteRequest, Locale, SiteLocaleInput } from '@/types/api';
import { useTranslation } from 'react-i18next';
import { getLocales } from '@/services/locales';
import { useFormHistory } from '@/hooks/useFormHistory';
import { slugify } from '@/utils/slugify';
import FormDialog from '@/components/shared/FormDialog';
import { M3Button } from '@/components/design-system';
import { queryKeys } from '@/lib/queryKeys';

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

  const { register, handleSubmit, reset, getValues, setValue, watch, formState: { errors, isValid } } = useForm<SiteFormData>({
    resolver: formResolver(siteSchema),
    defaultValues: {
      name: '',
      slug: '',
      description: '',
      timezone: 'UTC',
    },
    mode: 'onChange',
  });

  const { snapshot, undo, redo, canUndo, canRedo, clear } = useFormHistory(getValues, reset);

  const [slugManuallyEdited, setSlugManuallyEdited] = useState(false);

  const nameValue = watch('name');
  const slugValue = watch('slug');
  const timezoneValue = watch('timezone');

  // Auto-fill slug from name. Kept as an effect on purpose: it must also
  // re-derive the slug on edit-mode reset() (when `site` loads), not only on
  // user keystrokes — an onChange-only refactor would change mount behavior
  // for existing sites.
  // react-doctor-disable-next-line react-doctor/no-effect-chain
  useEffect(() => {
    if (!slugManuallyEdited && typeof nameValue === 'string') {
      setValue('slug', slugify(nameValue));
    }
  }, [nameValue, slugManuallyEdited, setValue]);

  useEffect(() => {
    if (!slugValue && slugManuallyEdited) {
      setSlugManuallyEdited(false);
    }
  }, [slugValue, slugManuallyEdited]);

  // Timezone options
  const timezoneOptions = useMemo(() => {
    const locale = navigator.language || 'en';
    try {
      return Intl.supportedValuesOf('timeZone').map((zone) => {
        const date = new Date();
        const offsetPart = Intl.DateTimeFormat(locale, { timeZone: zone, timeZoneName: 'shortOffset' })
          .formatToParts(date).find((p) => p.type === 'timeZoneName');
        const namePart = Intl.DateTimeFormat(locale, { timeZone: zone, timeZoneName: 'long' })
          .formatToParts(date).find((p) => p.type === 'timeZoneName');
        const offset = offsetPart?.value ?? '';
        const name = namePart?.value ?? zone;
        return { id: zone, label: `${name} (${offset})` };
      });
    } catch {
      return [
        { id: 'UTC', label: 'UTC' },
        { id: 'Europe/Vienna', label: 'Europe/Vienna (UTC+1/UTC+2)' },
        { id: 'Europe/Berlin', label: 'Europe/Berlin (UTC+1/UTC+2)' },
        { id: 'America/New_York', label: 'America/New York (UTC-5/UTC-4)' },
        { id: 'Europe/London', label: 'Europe/London (UTC+0/UTC+1)' },
        { id: 'Asia/Tokyo', label: 'Asia/Tokyo (UTC+9)' },
      ];
    }
  }, []);

  const currentTimezone = useMemo(
    () => timezoneOptions.find((o) => o.id === timezoneValue) ?? null,
    [timezoneOptions, timezoneValue],
  );

  const [selectedLocales, setSelectedLocales] = useState<Locale[]>([]);
  const [defaultLocaleId, setDefaultLocaleId] = useState<string | null>(null);
  const [localeError, setLocaleError] = useState<string | null>(null);

  const { data: allLocales = [] } = useQuery({
    queryKey: queryKeys.locales(),
    queryFn: () => getLocales(),
    enabled: open && isCreateMode,
  });

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

  const effectiveDefaultLocaleId = (() => {
    if (selectedLocales.length === 0) return null;
    if (selectedLocales.length === 1) return selectedLocales[0].id;
    if (defaultLocaleId && selectedLocales.find((l) => l.id === defaultLocaleId)) return defaultLocaleId;
    return selectedLocales[0].id;
  })();

  const onFormSubmit = (data: SiteFormData) => {
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
    <FormDialog
      open={open}
      onClose={onClose}
      onSubmit={handleSubmit(onFormSubmit)}
      icon="domain"
      title={site ? t('forms.site.editTitle') : t('forms.site.createTitle')}
      data-testid="site-form.dialog"
      actions={
        <>
          <Tooltip title={t('forms.undo')}>
            <span>
              <IconButton size="small" onClick={undo} disabled={!canUndo}>
                <UndoIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          <Tooltip title={t('forms.redo')}>
            <span>
              <IconButton size="small" onClick={redo} disabled={!canRedo}>
                <RedoIcon fontSize="small" />
              </IconButton>
            </span>
          </Tooltip>
          <Box sx={{ flex: 1 }} />
          <M3Button variant="ghost" size="sm" onClick={onClose} disabled={loading} data-testid="site-form.btn.cancel">
            {t('common.actions.cancel')}
          </M3Button>
          <M3Button
            type="submit"
            variant="filled"
            size="sm"
            disabled={loading || !isValid}
            data-testid="site-form.btn.submit"
          >
            {loading ? t('common.actions.saving') : (site ? t('common.actions.save') : t('common.actions.create'))}
          </M3Button>
        </>
      }
    >
      <TextField
        label={t('forms.site.fields.name')}
        fullWidth
        required
        size="small"
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
        size="small"
        {...register('slug', {
          onChange: () => setSlugManuallyEdited(true),
        } as never)}
        onBlur={snapshot}
        error={!!errors.slug}
        helperText={errors.slug?.message}
        disabled={!!site}
      />
      <TextField
        label={t('forms.site.fields.description')}
        fullWidth
        multiline
        size="small"
        rows={3}
        {...register('description')}
        onBlur={snapshot}
        error={!!errors.description}
        helperText={errors.description?.message}
      />
      <Autocomplete
        options={timezoneOptions}
        getOptionLabel={(o) => o.label}
        value={currentTimezone}
        // eslint-disable-next-line forja/require-read-only-gate -- dialog is opened only by isAdmin paths (Sites.tsx / SystemSitesPage.tsx / DashboardWelcome.tsx)
        onChange={(_, value) => {
          setValue('timezone', value?.id ?? '');
          snapshot();
        }}
        isOptionEqualToValue={(option, value) => option.id === value.id}
        size="small"
        renderInput={(params) => (
          <TextField
            {...params}
            label="Timezone"
            error={!!errors.timezone}
            helperText={errors.timezone?.message}
          />
        )}
        data-testid="site-form.autocomplete.timezone"
      />

      {isCreateMode && (
        <Box>
          <Autocomplete
            multiple
            options={allLocales}
            getOptionLabel={(option) =>
              `${option.code} — ${option.name}${option.native_name ? ` (${option.native_name})` : ''}`
            }
            value={selectedLocales}
            // eslint-disable-next-line forja/require-read-only-gate -- dialog is opened only by isAdmin paths (Sites.tsx / SystemSitesPage.tsx / DashboardWelcome.tsx)
            onChange={(_, value) => setSelectedLocales(value)}
            renderValue={(value, getItemProps) =>
              value.map((option, index) => {
                const { key, ...tagProps } = getItemProps({ index });
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
                size="small"
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
    </FormDialog>
  );
}
