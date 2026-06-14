/**
 * Schema-driven entry form (#798): reads a custom type's schema and emits the
 * right MUI control per field. All fields render in one flow ordered by
 * display_order (so the form matches the builder's field order); a single
 * locale switcher at the top drives the localized fields, while shared fields
 * are edited once. Localized fields carry a small per-language hint. PII
 * fields are badged and, when the server redacted them (null for non-admin
 * readers), shown read-only as "redacted".
 *
 * Built once, works for every type. richtext currently maps to a multiline
 * field and media to an asset-id field — swapping in the Tiptap block editor
 * and the media gallery picker is a documented fast-follow.
 */
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Chip,
  FormControlLabel,
  MenuItem,
  Stack,
  Switch,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material';
import LanguageIcon from '@mui/icons-material/Language';

import { useFormSaveBar } from '@/hooks/useFormSaveBar';
import type {
  CustomEntryRequest,
  CustomFieldResponse,
  CustomTypeResponse,
} from '@/types/customTypes';

const REDACTED = '__redacted__';

/** Drop redacted (null-from-server) PII values so we never overwrite them. */
function cleanEntryValues(obj: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== null && v !== REDACTED));
}

/** The canonical entry payload `onSubmit` would send. */
function buildEntryRequest(
  shared: Record<string, unknown>,
  localized: Record<string, Record<string, unknown>>,
): CustomEntryRequest {
  return {
    shared: cleanEntryValues(shared),
    localized: Object.fromEntries(
      Object.entries(localized).map(([l, vals]) => [l, cleanEntryValues(vals)]),
    ),
  };
}

/**
 * Fingerprint of the canonical payload for dirty-tracking. Empty locale buckets
 * are normalised away so a typed-then-cleared field doesn't read as a change.
 */
function entryFingerprint(
  shared: Record<string, unknown>,
  localized: Record<string, Record<string, unknown>>,
): string {
  const req = buildEntryRequest(shared, localized);
  const nonEmptyLocalized = Object.fromEntries(
    Object.entries(req.localized).filter(([, v]) => Object.keys(v).length > 0),
  );
  return JSON.stringify({ shared: req.shared, localized: nonEmptyLocalized });
}

interface FieldControlProps {
  field: CustomFieldResponse;
  value: unknown;
  onChange: (v: unknown) => void;
}

function FieldControl({ field, value, onChange }: FieldControlProps) {
  const { t } = useTranslation();
  const testId = `field-${field.key}`;
  const redacted = field.is_pii && value === null;

  const label = (
    <Stack direction="row" spacing={1} component="span" sx={{ alignItems: 'center' }}>
      <span>{field.label}</span>
      {field.is_pii && <Chip size="small" color="warning" label={t('collections.piiBadge')} />}
    </Stack>
  );

  if (redacted) {
    return (
      <TextField
        label={field.label}
        value={t('collections.piiBadge')}
        disabled
        fullWidth
        slotProps={{ htmlInput: { 'data-testid': testId, 'aria-label': field.label } }}
      />
    );
  }

  switch (field.field_type) {
    case 'boolean':
      return (
        <FormControlLabel
          control={
            <Switch
              checked={!!value}
              onChange={(e) => onChange(e.target.checked)}
              data-testid={testId}
            />
          }
          label={label}
        />
      );
    case 'number':
      return (
        <TextField
          type="number"
          label={field.label}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value === '' ? null : Number(e.target.value))}
          required={field.required}
          fullWidth
          slotProps={{ htmlInput: { 'data-testid': testId } }}
        />
      );
    case 'date':
      return (
        <TextField
          type="date"
          label={field.label}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value || null)}
          required={field.required}
          fullWidth
          slotProps={{ htmlInput: { 'data-testid': testId }, inputLabel: { shrink: true } }}
        />
      );
    case 'enum':
      return (
        <TextField
          select
          label={field.label}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value)}
          required={field.required}
          fullWidth
          slotProps={{ htmlInput: { 'data-testid': testId } }}
        >
          {(field.enum_options ?? []).map((opt) => (
            <MenuItem key={opt} value={opt}>
              {opt}
            </MenuItem>
          ))}
        </TextField>
      );
    case 'richtext':
    case 'text':
    case 'media':
    default:
      return (
        <TextField
          label={field.label}
          value={value ?? ''}
          onChange={(e) => onChange(e.target.value || null)}
          required={field.required}
          fullWidth
          multiline={field.field_type === 'richtext'}
          minRows={field.field_type === 'richtext' ? 4 : undefined}
          slotProps={{ htmlInput: { 'data-testid': testId } }}
        />
      );
  }
}

export interface CollectionEntryFormProps {
  schema: CustomTypeResponse;
  /** Locale codes available for localized fields (e.g. site locales). */
  locales: string[];
  initialShared?: Record<string, unknown>;
  initialLocalized?: Record<string, Record<string, unknown>>;
  onSubmit: (req: CustomEntryRequest) => void;
  submitting?: boolean;
  /** Force the save bar visible — create flows have nothing "dirty" yet. */
  forceVisible?: boolean;
}

export function CollectionEntryForm({
  schema,
  locales,
  initialShared,
  initialLocalized,
  onSubmit,
  submitting,
  forceVisible,
}: CollectionEntryFormProps) {
  const { t } = useTranslation();
  // One ordered flow — display_order matches the builder. Localized vs shared
  // is a per-field binding decision, not a layout split.
  const fields = useMemo(
    () =>
      schema.fields
        .filter((f) => !f.deprecated_at)
        .sort((a, b) => a.display_order - b.display_order),
    [schema.fields],
  );
  const hasLocalized = fields.some((f) => f.localized);

  const [shared, setShared] = useState<Record<string, unknown>>(() => initialShared ?? {});
  const [localized, setLocalized] =
    useState<Record<string, Record<string, unknown>>>(() => initialLocalized ?? {});
  const [activeLocale, setActiveLocale] = useState(locales[0] ?? 'en');

  const setSharedValue = (key: string, v: unknown) => setShared((s) => ({ ...s, [key]: v }));
  const setLocalizedValue = (locale: string, key: string, v: unknown) =>
    setLocalized((l) => ({ ...l, [locale]: { ...(l[locale] ?? {}), [key]: v } }));

  const valueFor = (f: CustomFieldResponse) =>
    f.localized ? (localized[activeLocale]?.[f.key] ?? null) : (shared[f.key] ?? null);
  const setValueFor = (f: CustomFieldResponse, v: unknown) =>
    f.localized ? setLocalizedValue(activeLocale, f.key, v) : setSharedValue(f.key, v);

  const submit = () => onSubmit(buildEntryRequest(shared, localized));

  // Drive the global save bar (#48) — dirty compares the payload fingerprint to
  // the baseline captured at mount.
  const [baseline] = useState(() => entryFingerprint(initialShared ?? {}, initialLocalized ?? {}));
  const isDirty = entryFingerprint(shared, localized) !== baseline;

  useFormSaveBar({
    id: 'collection-entry-form',
    isDirty,
    saving: submitting,
    forceVisible,
    saveLabel: t('collections.saveEntry'),
    saveTestId: 'save-entry',
    discardTestId: 'discard-entry',
    onSave: submit,
    onDiscard: () => {
      setShared(initialShared ?? {});
      setLocalized(initialLocalized ?? {});
    },
  });

  const showLocaleHint = hasLocalized && locales.length > 1;

  return (
    <Box
      component="form"
      data-testid="collection-entry-form"
      onSubmit={(e) => {
        e.preventDefault();
        submit();
      }}
    >
      {hasLocalized && (
        <Tabs
          value={activeLocale}
          onChange={(_e, v) => setActiveLocale(v)}
          data-testid="locale-tabs"
          variant="scrollable"
          sx={{ mb: 2 }}
        >
          {locales.map((loc) => (
            <Tab key={loc} value={loc} label={loc} data-testid={`locale-tab-${loc}`} />
          ))}
        </Tabs>
      )}

      <Stack spacing={2}>
        {fields.map((f) => (
          <Box key={f.id}>
            <FieldControl field={f} value={valueFor(f)} onChange={(v) => setValueFor(f, v)} />
            {showLocaleHint && f.localized && (
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: 'inline-flex', alignItems: 'center', gap: 0.5, mt: 0.5 }}
              >
                <LanguageIcon sx={{ fontSize: 14 }} />
                {t('collections.perLanguage', { locale: activeLocale.toUpperCase() })}
              </Typography>
            )}
          </Box>
        ))}
      </Stack>
    </Box>
  );
}
