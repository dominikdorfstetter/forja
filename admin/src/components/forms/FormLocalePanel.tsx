import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Box, IconButton, TextField, Tooltip, Typography } from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import { M3Button } from '@/components/design-system';
import { useAiAssist } from '@/hooks/useAiAssist';
import type {
  FormFieldInput,
  FormFieldLocalizationInput,
  FormLocalizationInput,
} from '@/types/api';

interface FormLocalePanelProps {
  /** The active locale UUID; the panel edits this locale's overrides. */
  localeId: string;
  /** Locale display name for the header. */
  localeName: string;
  /** Locale code (e.g. `de`) — passed to the AI translate endpoint as the
   *  target language hint. */
  localeCode: string;
  /** Canonical (default-locale) form-level text. Used as the source for
   *  AI "translate from default" — the AI never sees the locale overrides. */
  canonicalName: string;
  canonicalDescription: string | null;
  canonicalConsentText: string | null;
  /** Current set of form-level localizations. The panel reads/writes the
   *  entry matching `localeId`; creates one when missing. */
  formLocs: FormLocalizationInput[];
  onFormLocsChange: (next: FormLocalizationInput[]) => void;
  /** Field array (unchanged contract — same one FieldBuilder mutates).
   *  The panel only edits the per-field `localizations` array for the
   *  active locale; field type, validation, options stay untouched. */
  fields: FormFieldInput[];
  onFieldsChange: (next: FormFieldInput[]) => void;
}

/**
 * Per-locale editor surface (#579 localization). Activated from the
 * FormDetail page's locale switcher. Shows ONLY the translatable text
 * inputs for the active locale — form name / description / consent_text
 * at the top, then per-field display_label / placeholder / help_text.
 *
 * Non-localizable fields (active toggle, bot_protection, validation,
 * options, field types) stay on the canonical Settings + Fields tabs
 * where they belong.
 */
export default function FormLocalePanel({
  localeId,
  localeName,
  localeCode,
  canonicalName,
  canonicalDescription,
  canonicalConsentText,
  formLocs,
  onFormLocsChange,
  fields,
  onFieldsChange,
}: FormLocalePanelProps) {
  const { t } = useTranslation();
  const ai = useAiAssist();
  const [translatingAll, setTranslatingAll] = useState(false);
  const [translatingKey, setTranslatingKey] = useState<string | null>(null);

  const formLoc = formLocs.find((l) => l.locale_id === localeId) ?? {
    locale_id: localeId,
  };

  function updateFormLoc(patch: Partial<FormLocalizationInput>) {
    const merged: FormLocalizationInput = { ...formLoc, ...patch };
    const others = formLocs.filter((l) => l.locale_id !== localeId);
    onFormLocsChange([...others, merged]);
  }

  function getFieldLoc(field: FormFieldInput): FormFieldLocalizationInput {
    return (
      field.localizations?.find((l) => l.locale_id === localeId) ?? {
        locale_id: localeId,
      }
    );
  }

  function updateFieldLoc(fieldIndex: number, patch: Partial<FormFieldLocalizationInput>) {
    onFieldsChange(
      fields.map((f, i) => {
        if (i !== fieldIndex) return f;
        const existing = f.localizations ?? [];
        const current = existing.find((l) => l.locale_id === localeId) ?? {
          locale_id: localeId,
        };
        const merged: FormFieldLocalizationInput = { ...current, ...patch };
        const others = existing.filter((l) => l.locale_id !== localeId);
        return { ...f, localizations: [...others, merged] };
      }),
    );
  }

  // ── AI translate helpers ──────────────────────────────────────────────
  //
  // The backend `translate` action returns an AiGenerateResponse with the
  // blog-shaped keys (title/subtitle/excerpt/body/meta_title/meta_description).
  // Forms don't have those keys, so we reuse them as transport slots —
  // pack source text into `title` (and optionally `subtitle`, `excerpt`),
  // read the translated value from the same slot on the response.

  async function translateOne(source: string | null | undefined): Promise<string | null> {
    if (!source || !source.trim()) return null;
    const res = await ai.generate(
      'translate',
      JSON.stringify({ title: source }),
      localeCode,
    );
    return res.title ?? null;
  }

  async function translateAll() {
    setTranslatingAll(true);
    try {
      // Form-level: source from the canonical/default-locale text (not the
      // user's in-progress locale overrides). Packs into title/excerpt/body
      // — 3 strings in a single round-trip.
      const formSrc: Record<string, string> = {};
      if (canonicalName.trim()) formSrc.title = canonicalName;
      if (canonicalDescription?.trim()) formSrc.excerpt = canonicalDescription;
      if (canonicalConsentText?.trim()) formSrc.body = canonicalConsentText;

      const tasks: Promise<void>[] = [];

      tasks.push(
        (async () => {
          const r = await ai.generate(
            'translate',
            JSON.stringify(formSrc),
            localeCode,
          );
          const next: FormLocalizationInput = {
            ...formLoc,
            name: r.title ?? formLoc.name ?? null,
            description: r.excerpt ?? formLoc.description ?? null,
            consent_text: r.body ?? formLoc.consent_text ?? null,
          };
          const others = formLocs.filter((l) => l.locale_id !== localeId);
          onFormLocsChange([...others, next]);
        })(),
      );

      // Per-field: pack display_label/placeholder/help_text per field —
      // source is the canonical label/placeholder/help_text, falling back
      // to the user's already-typed locale value if they edited it.
      for (let i = 0; i < fields.length; i++) {
        const field = fields[i];
        const loc = getFieldLoc(field);
        const fieldSrc = {
          title: field.label, // always present
          subtitle: field.placeholder || undefined,
          excerpt: field.help_text || undefined,
        };
        tasks.push(
          (async () => {
            const r = await ai.generate(
              'translate',
              JSON.stringify(fieldSrc),
              localeCode,
            );
            updateFieldLoc(i, {
              display_label: r.title ?? loc.display_label ?? null,
              placeholder: r.subtitle ?? loc.placeholder ?? null,
              help_text: r.excerpt ?? loc.help_text ?? null,
            });
          })(),
        );
      }

      await Promise.all(tasks);
    } finally {
      setTranslatingAll(false);
    }
  }

  async function translateField(
    key: string,
    source: string | null | undefined,
    apply: (translated: string | null) => void,
  ) {
    setTranslatingKey(key);
    try {
      const translated = await translateOne(source);
      if (translated !== null) apply(translated);
    } finally {
      setTranslatingKey(null);
    }
  }

  function renderAiButton(
    key: string,
    source: string | null | undefined,
    apply: (translated: string | null) => void,
  ) {
    if (!ai.isConfigured) return null;
    const busy = translatingKey === key || translatingAll;
    const disabled = busy || !source || !source.trim();
    return (
      <Tooltip
        title={t(
          'formsModule.locale.translateOne',
          'Translate from default with AI',
        )}
      >
        <span>
          <IconButton
            size="small"
            onClick={() => translateField(key, source, apply)}
            disabled={disabled}
            data-testid={`forms.locale.ai.${key}`}
          >
            <AutoAwesomeIcon
              fontSize="small"
              sx={{ opacity: busy ? 0.4 : 1 }}
            />
          </IconButton>
        </span>
      </Tooltip>
    );
  }

  return (
    <Box sx={{ display: 'grid', gap: 3 }} data-testid="forms.locale-panel">
      <Box>
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', mb: 2, gap: 2 }}>
          <Box>
            <Typography variant="overline" color="text.secondary">
              {t('formsModule.locale.heading', 'Translations for {{name}}', {
                name: localeName,
              })}
            </Typography>
            <Typography variant="body2" color="text.secondary">
              {t(
                'formsModule.locale.help',
                'Leave a field blank to fall back to the default-locale text. Field labels stay as the technical key (submission data).',
              )}
            </Typography>
          </Box>
          {ai.isConfigured && (
            <M3Button
              size="md"
              variant="outlined"
              icon="auto_awesome"
              onClick={translateAll}
              disabled={translatingAll || ai.isGenerating}
              data-testid="forms.locale.ai.translateAll"
            >
              {translatingAll
                ? t('formsModule.locale.translatingAll', 'Translating…')
                : t('formsModule.locale.translateAll', 'Translate from default')}
            </M3Button>
          )}
        </Box>

        <Box sx={{ display: 'grid', gap: 2, maxWidth: 720 }}>
          <TextField
            label={t('formsModule.locale.name', 'Form name')}
            value={formLoc.name ?? ''}
            onChange={(e) => updateFormLoc({ name: e.target.value || null })}
            fullWidth
            slotProps={{
              input: {
                endAdornment: renderAiButton(
                  'form.name',
                  canonicalName,
                  (v) => updateFormLoc({ name: v }),
                ),
              },
            }}
          />
          <TextField
            label={t('formsModule.locale.description', 'Description')}
            value={formLoc.description ?? ''}
            onChange={(e) => updateFormLoc({ description: e.target.value || null })}
            multiline
            minRows={2}
            fullWidth
            slotProps={{
              input: {
                endAdornment: renderAiButton(
                  'form.description',
                  canonicalDescription,
                  (v) => updateFormLoc({ description: v }),
                ),
              },
            }}
          />
          <TextField
            label={t('formsModule.locale.consentText', 'Consent text')}
            value={formLoc.consent_text ?? ''}
            onChange={(e) => updateFormLoc({ consent_text: e.target.value || null })}
            multiline
            minRows={2}
            fullWidth
            helperText={t(
              'formsModule.locale.consentHelp',
              'Only used when the form requires consent.',
            )}
            slotProps={{
              input: {
                endAdornment: renderAiButton(
                  'form.consent_text',
                  canonicalConsentText,
                  (v) => updateFormLoc({ consent_text: v }),
                ),
              },
            }}
          />
        </Box>
      </Box>

      {fields.length > 0 && (
        <Box>
          <Typography variant="overline" color="text.secondary">
            {t('formsModule.locale.fieldsHeading', 'Field translations')}
          </Typography>
          <Box sx={{ display: 'grid', gap: 2, mt: 1 }}>
            {fields.map((field, i) => {
              const loc = getFieldLoc(field);
              return (
                <Box
                  key={`${field.label}-${i}`}
                  sx={{
                    border: '1px solid var(--outline-variant)',
                    borderRadius: 3,
                    p: 2,
                    background: 'var(--surface-container-low)',
                  }}
                >
                  <Typography variant="caption" color="text.secondary">
                    {field.field_type} ·{' '}
                    {t('formsModule.locale.technicalKey', 'key:')} {field.label}
                  </Typography>
                  <Box sx={{ display: 'grid', gap: 1.5, mt: 1 }}>
                    <TextField
                      label={t('formsModule.locale.displayLabel', 'Display label')}
                      value={loc.display_label ?? ''}
                      onChange={(e) =>
                        updateFieldLoc(i, { display_label: e.target.value || null })
                      }
                      size="small"
                      fullWidth
                      slotProps={{
                        input: {
                          endAdornment: renderAiButton(
                            `field.${i}.display_label`,
                            field.label,
                            (v) => updateFieldLoc(i, { display_label: v }),
                          ),
                        },
                      }}
                    />
                    <TextField
                      label={t('formsModule.locale.placeholder', 'Placeholder')}
                      value={loc.placeholder ?? ''}
                      onChange={(e) =>
                        updateFieldLoc(i, { placeholder: e.target.value || null })
                      }
                      size="small"
                      fullWidth
                      slotProps={{
                        input: {
                          endAdornment: renderAiButton(
                            `field.${i}.placeholder`,
                            field.placeholder,
                            (v) => updateFieldLoc(i, { placeholder: v }),
                          ),
                        },
                      }}
                    />
                    <TextField
                      label={t('formsModule.locale.helpText', 'Help text')}
                      value={loc.help_text ?? ''}
                      onChange={(e) =>
                        updateFieldLoc(i, { help_text: e.target.value || null })
                      }
                      size="small"
                      fullWidth
                      slotProps={{
                        input: {
                          endAdornment: renderAiButton(
                            `field.${i}.help_text`,
                            field.help_text,
                            (v) => updateFieldLoc(i, { help_text: v }),
                          ),
                        },
                      }}
                    />
                  </Box>
                </Box>
              );
            })}
          </Box>
        </Box>
      )}
    </Box>
  );
}
