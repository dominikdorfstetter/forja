import { Box, Chip, Radio, TextField, Typography, Autocomplete } from '@mui/material';
import { useTranslation } from 'react-i18next';
import type { Locale } from '@/types/api';

interface SiteWizardLanguagesStepProps {
  allLocales: Locale[];
  selectedLocales: Locale[];
  onSelectedLocalesChange: (locales: Locale[]) => void;
  defaultLocaleId: string | null;
  onDefaultLocaleIdChange: (id: string) => void;
  effectiveDefaultLocaleId: string | null;
  localeError: string | null;
  onLocaleErrorClear: () => void;
}

export default function SiteWizardLanguagesStep({
  allLocales,
  selectedLocales,
  onSelectedLocalesChange,
  defaultLocaleId: _defaultLocaleId,
  onDefaultLocaleIdChange,
  effectiveDefaultLocaleId,
  localeError,
  onLocaleErrorClear,
}: SiteWizardLanguagesStepProps) {
  const { t } = useTranslation();

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      <Typography variant="body2" color="text.secondary">
        {t('sites.wizard.languagesDescription')}
      </Typography>
      <Autocomplete
        multiple
        options={allLocales}
        getOptionLabel={(option) =>
          `${option.code} — ${option.name}${option.native_name ? ` (${option.native_name})` : ''}`
        }
        value={selectedLocales}
        onChange={(_, value) => { onSelectedLocalesChange(value); onLocaleErrorClear(); }}
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
        data-testid="site-wizard.locales"
      />

      {selectedLocales.length > 1 && (
        <Box>
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
                onClick={() => onDefaultLocaleIdChange(locale.id)}
                variant={locale.id === effectiveDefaultLocaleId ? 'filled' : 'outlined'}
                color={locale.id === effectiveDefaultLocaleId ? 'primary' : 'default'}
                sx={{ cursor: 'pointer' }}
              />
            ))}
          </Box>
        </Box>
      )}
    </Box>
  );
}
