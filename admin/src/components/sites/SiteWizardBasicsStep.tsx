import { useMemo } from 'react';
import { Box, TextField, Autocomplete } from '@mui/material';
import type { UseFormRegister, FieldErrors, UseFormSetValue, UseFormWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { slugify } from '@/utils/slugify';

interface SiteWizardBasicsStepProps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  register: UseFormRegister<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  errors: FieldErrors<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  setValue: UseFormSetValue<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  watch: UseFormWatch<any>;
}

interface TimezoneOption {
  id: string;
  label: string;
  region: string;
}

const FALLBACK_ZONES = [
  'UTC',
  'Europe/London',
  'Europe/Berlin',
  'Europe/Vienna',
  'America/New_York',
  'America/Chicago',
  'America/Los_Angeles',
  'Asia/Tokyo',
  'Asia/Shanghai',
];

function getRegion(zone: string): string {
  const slash = zone.indexOf('/');
  return slash === -1 ? 'Other' : zone.slice(0, slash);
}

function getUtcOffset(zone: string): string {
  try {
    const parts = new Intl.DateTimeFormat('en-US', {
      timeZone: zone,
      timeZoneName: 'longOffset',
    }).formatToParts(new Date());
    const tz = parts.find((p) => p.type === 'timeZoneName')?.value;
    if (!tz) return '';
    if (tz === 'GMT') return 'UTC';
    return tz.replace('GMT', 'UTC');
  } catch {
    return '';
  }
}

function toOption(zone: string): TimezoneOption {
  const offset = getUtcOffset(zone);
  return {
    id: zone,
    label: offset ? `${zone} (${offset})` : zone,
    region: getRegion(zone),
  };
}

function getTimezoneOptions(): TimezoneOption[] {
  const zones = (() => {
    try {
      return Intl.supportedValuesOf('timeZone');
    } catch {
      return FALLBACK_ZONES;
    }
  })();

  return zones
    .map(toOption)
    .sort((a, b) => {
      if (a.region !== b.region) return a.region.localeCompare(b.region);
      return a.id.localeCompare(b.id);
    });
}

export default function SiteWizardBasicsStep({ register, errors, setValue, watch }: SiteWizardBasicsStepProps) {
  const { t } = useTranslation();

  const slugValue = watch('slug');
  const timezoneValue = watch('timezone');

  const timezoneOptions = useMemo(() => getTimezoneOptions(), []);

  const currentTimezone = useMemo(
    () => timezoneOptions.find((o) => o.id === timezoneValue) ?? null,
    [timezoneOptions, timezoneValue],
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <TextField
        autoFocus
        label={t('forms.site.fields.name')}
        fullWidth
        required
        {...register('name', {
          // Auto-fill slug from name as the user types.
          onChange: (e) => setValue('slug', slugify(e.target.value)),
        })}
        error={!!errors.name}
        helperText={(errors.name?.message as string) ?? undefined}
        data-testid="site-wizard.input.name"
      />
      <TextField
        label={t('forms.site.fields.slug')}
        fullWidth
        value={slugValue ?? ''}
        slotProps={{ input: { readOnly: true } }}
        error={!!errors.slug}
        helperText={(errors.slug?.message as string) ?? undefined}
        data-testid="site-wizard.input.slug"
      />
      <TextField
        label={t('forms.site.fields.description')}
        fullWidth
        multiline
        rows={3}
        {...register('description')}
        error={!!errors.description}
        helperText={(errors.description?.message as string) ?? undefined}
      />
      <Autocomplete
        options={timezoneOptions}
        getOptionLabel={(o) => o.label}
        groupBy={(o) => o.region}
        value={currentTimezone}
        // eslint-disable-next-line forja/require-read-only-gate -- creation wizard is opened only by isAdmin paths
        onChange={(_, value) => {
          setValue('timezone', value?.id ?? '');
        }}
        isOptionEqualToValue={(option, value) => option.id === value.id}
        renderInput={(params) => (
          <TextField
            {...params}
            label="Timezone"
            error={!!errors.timezone}
            helperText={(errors.timezone?.message as string) ?? undefined}
          />
        )}
        data-testid="site-wizard.autocomplete.timezone"
      />
    </Box>
  );
}
