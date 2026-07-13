import { useState, useCallback, type ReactNode } from 'react';
import { Box, TextField, Typography } from '@mui/material';
import {
  Controller,
  type Control,
  type FieldValues,
  type FieldPath,
} from 'react-hook-form';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import CharCounter from '@/pages/blog-detail/CharCounter';

/** One locale-aware text field's presentation + limits. `name` is both the RHF
 *  field name on the default-locale path and the localization-row key on the
 *  non-default path. */
export interface LocaleFieldSpec {
  name: string;
  label: string;
  maxLength: number;
  counterMax: number;
  multiline?: boolean;
  rows?: number;
  /** data-testid base; the default path gets `${testId}` and the non-default
   *  path `${testId}.localized` so tests can target each persistence model. */
  testId?: string;
}

/** A persisted localization row. Only `id` is required; field values are read
 *  by spec `name`. */
export interface LocalizationRow {
  id: string;
  [key: string]: unknown;
}

export interface LocaleAwareFieldsProps<TForm extends FieldValues> {
  fields: LocaleFieldSpec[];
  control: Control<TForm>;
  /** True for the site's default locale: the fields bind to the form (RHF
   *  `Controller`) and persist with the rest of the form on submit. */
  isDefault: boolean;
  /** Snapshot callback fired on default-locale field blur (save-bar / autosave). */
  onDefaultBlur: () => void;
  /** Footer slot rendered under a default-locale field (e.g. an AI button),
   *  keyed by field `name`. */
  footerSlots?: Record<string, ReactNode>;

  // ── Non-default persistence (owned here) ──────────────────────────────
  locale: { id: string; code: string };
  /** The existing localization row for this locale, if one has been created. */
  localization?: LocalizationRow;
  /** Create a localization row for `localeId` carrying `values`. The caller's
   *  adapter supplies any entity-specific required fields (e.g. `title`). */
  createLocalization: (localeId: string, values: Record<string, string>) => Promise<unknown>;
  /** Update the localization row `locId` with `values`. */
  updateLocalization: (locId: string, values: Record<string, string>) => Promise<unknown>;
  /** Query key invalidated after a successful non-default save. */
  invalidateKey: readonly unknown[];
  /** Default-locale values used as placeholders on the non-default path. */
  placeholders?: Record<string, string>;
  /** Hint shown above the non-default fields. */
  localeHint?: string;
  /** Notified with the live non-default field values on every edit — read-only
   *  mirror for callers that render previews. The save path stays owned here. */
  onLocaleValuesChange?: (values: Record<string, string>) => void;
}

/**
 * One locale-aware field group. Owns the fork between the two persistence
 * models so callers never branch on `isDefault`:
 *
 * - **Default locale** → RHF `Controller`s; values persist with the form.
 * - **Non-default locale** → local state + a per-locale save-on-blur mutation
 *   (create-then-update), invalidating `invalidateKey` on success.
 */
export default function LocaleAwareFields<TForm extends FieldValues>({
  fields,
  control,
  isDefault,
  onDefaultBlur,
  footerSlots,
  locale,
  localization,
  createLocalization,
  updateLocalization,
  invalidateKey,
  placeholders,
  localeHint,
  onLocaleValuesChange,
}: LocaleAwareFieldsProps<TForm>) {
  const queryClient = useQueryClient();

  // Lazily seed local state from the persisted row for this locale.
  const [edited, setEdited] = useState<Record<string, string>>({});

  const valueFor = useCallback(
    (name: string): string => {
      if (name in edited) return edited[name];
      const persisted = localization?.[name];
      return typeof persisted === 'string' ? persisted : '';
    },
    [edited, localization],
  );

  const saveMutation = useMutation({
    mutationFn: (values: Record<string, string>) =>
      localization
        ? updateLocalization(localization.id, values)
        : createLocalization(locale.id, values),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: invalidateKey }),
  });

  const handleLocaleChange = useCallback(
    (name: string, value: string) => {
      setEdited((prev) => {
        const next = { ...prev, [name]: value };
        if (onLocaleValuesChange) {
          const merged: Record<string, string> = {};
          for (const spec of fields) {
            merged[spec.name] =
              spec.name in next
                ? next[spec.name]
                : typeof localization?.[spec.name] === 'string'
                  ? (localization[spec.name] as string)
                  : '';
          }
          onLocaleValuesChange(merged);
        }
        return next;
      });
    },
    [fields, localization, onLocaleValuesChange],
  );

  const handleLocaleBlur = useCallback(() => {
    const values: Record<string, string> = {};
    for (const spec of fields) values[spec.name] = valueFor(spec.name);
    saveMutation.mutate(values);
  }, [fields, valueFor, saveMutation]);

  if (isDefault) {
    return (
      <>
        {fields.map((spec) => (
          <Controller
            key={spec.name}
            name={spec.name as FieldPath<TForm>}
            control={control}
            render={({ field, fieldState }) => (
              <Box sx={{ mb: 2 }}>
                <TextField
                  {...field}
                  value={field.value ?? ''}
                  label={spec.label}
                  fullWidth
                  multiline={spec.multiline}
                  rows={spec.rows}
                  error={!!fieldState.error}
                  helperText={fieldState.error?.message}
                  onBlur={() => {
                    field.onBlur();
                    onDefaultBlur();
                  }}
                  slotProps={{
                    htmlInput: {
                      maxLength: spec.maxLength,
                      ...(spec.testId ? { 'data-testid': spec.testId } : {}),
                    },
                  }}
                />
                <Box
                  sx={{
                    display: 'flex',
                    justifyContent: footerSlots?.[spec.name] ? 'space-between' : 'flex-end',
                    alignItems: 'center',
                    mt: 0.5,
                  }}
                >
                  {footerSlots?.[spec.name]}
                  <CharCounter current={(field.value as string)?.length || 0} max={spec.counterMax} />
                </Box>
              </Box>
            )}
          />
        ))}
      </>
    );
  }

  return (
    <>
      {localeHint && (
        <Typography variant="caption" color="text.secondary" sx={{ mb: 2, display: 'block' }}>
          {localeHint}
        </Typography>
      )}
      {fields.map((spec) => (
        <Box key={spec.name} sx={{ mb: 2 }}>
          <TextField
            label={spec.label}
            fullWidth
            multiline={spec.multiline}
            rows={spec.rows}
            value={valueFor(spec.name)}
            placeholder={placeholders?.[spec.name] || ''}
            onChange={(e) => handleLocaleChange(spec.name, e.target.value)}
            onBlur={handleLocaleBlur}
            slotProps={{
              htmlInput: {
                maxLength: spec.maxLength,
                ...(spec.testId ? { 'data-testid': `${spec.testId}.localized` } : {}),
              },
            }}
          />
          <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 0.5 }}>
            <CharCounter current={valueFor(spec.name).length} max={spec.counterMax} />
          </Box>
        </Box>
      ))}
    </>
  );
}
