import { useTranslation } from 'react-i18next';
import { Box } from '@mui/material';
import FormLocalePanel from '@/components/forms/FormLocalePanel';
import type { FormFieldInput, FormLocalizationInput, SiteLocaleResponse } from '@/types/api';
import type { SettingsState } from './formDetailModel';

interface FormTranslationsTabProps {
  /** Active site locales; the default one is the canonical source. */
  activeLocales: SiteLocaleResponse[];
  activeLocaleId: string | null;
  onActiveLocaleChange: (localeId: string) => void;
  settings: SettingsState;
  localizations: FormLocalizationInput[];
  onLocalizationsChange: (next: FormLocalizationInput[]) => void;
  fields: FormFieldInput[];
  onFieldsChange: (next: FormFieldInput[]) => void;
}

interface LocaleChipProps {
  locale: SiteLocaleResponse;
  active: boolean;
  onSelect: (localeId: string) => void;
}

function LocaleChip({ locale, active, onSelect }: LocaleChipProps) {
  return (
    <button
      type="button"
      onClick={() => onSelect(locale.locale_id)}
      data-testid={`forms.detail.locale.${locale.code}`}
      style={{
        padding: '6px 14px',
        borderRadius: 999,
        border: '1px solid var(--outline-variant)',
        background: active
          ? 'var(--primary-container)'
          : 'var(--surface-container-low)',
        color: active ? 'var(--on-primary-container)' : 'var(--on-surface)',
        fontSize: 13,
        fontWeight: 600,
        cursor: 'pointer',
      }}
      aria-pressed={active}
    >
      {locale.native_name || locale.name} ({locale.code})
    </button>
  );
}

/** Translations tab: pick a non-default locale, then edit its overrides. */
export default function FormTranslationsTab({
  activeLocales,
  activeLocaleId,
  onActiveLocaleChange,
  settings,
  localizations,
  onLocalizationsChange,
  fields,
  onFieldsChange,
}: FormTranslationsTabProps) {
  const { t } = useTranslation();
  const defaultLocale = activeLocales.find((l) => l.is_default) ?? activeLocales[0];
  const translatable = activeLocales.filter(
    (l) => !defaultLocale || l.locale_id !== defaultLocale.locale_id,
  );
  const selected = activeLocales.find((l) => l.locale_id === activeLocaleId);

  return (
    <Box>
      <Box sx={{ display: 'flex', gap: 1, mb: 3, flexWrap: 'wrap', alignItems: 'center' }}>
        <Box sx={{ fontSize: 13, color: 'text.secondary', mr: 1 }}>
          {t('formsModule.detail.localePicker', 'Locale:')}
        </Box>
        {translatable.map((l) => (
          <LocaleChip
            key={l.locale_id}
            locale={l}
            active={activeLocaleId === l.locale_id}
            onSelect={onActiveLocaleChange}
          />
        ))}
      </Box>

      {activeLocaleId ? (
        <FormLocalePanel
          localeId={activeLocaleId}
          localeName={selected?.name ?? ''}
          localeCode={selected?.code ?? ''}
          canonicalName={settings.name}
          canonicalDescription={settings.description || null}
          canonicalConsentText={settings.consent_text || null}
          formLocs={localizations}
          onFormLocsChange={onLocalizationsChange}
          fields={fields}
          onFieldsChange={onFieldsChange}
        />
      ) : (
        <Box
          sx={{
            border: '1px dashed var(--outline-variant)',
            borderRadius: 3,
            p: 4,
            textAlign: 'center',
            color: 'text.secondary',
          }}
        >
          {activeLocales.length <= 1
            ? t(
                'formsModule.detail.translations.noLocales',
                'Enable additional site locales in Site settings to translate this form.',
              )
            : t(
                'formsModule.detail.translations.pickLocale',
                'Pick a locale above to add or edit translations.',
              )}
        </Box>
      )}
    </Box>
  );
}
