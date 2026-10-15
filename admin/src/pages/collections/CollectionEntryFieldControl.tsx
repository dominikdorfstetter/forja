/**
 * Per-field-type controls for the schema-driven entry form (#798). Each custom
 * field type has its own control; text-like types (text / richtext / media)
 * share the default one. PII fields the server redacted (null for non-admin
 * readers) render read-only.
 */
import { useTranslation } from 'react-i18next';
import { Chip, FormControlLabel, MenuItem, Stack, Switch, TextField } from '@mui/material';

import type { CustomFieldResponse } from '@/types/customTypes';

export interface FieldControlProps {
  field: CustomFieldResponse;
  value: unknown;
  onChange: (v: unknown) => void;
}

interface FieldRendererProps extends FieldControlProps {
  testId: string;
}

function BooleanField({ field, value, onChange, testId }: FieldRendererProps) {
  const { t } = useTranslation();
  return (
    <FormControlLabel
      control={
        <Switch checked={!!value} onChange={(e) => onChange(e.target.checked)} data-testid={testId} />
      }
      label={
        <Stack direction="row" spacing={1} component="span" sx={{ alignItems: 'center' }}>
          <span>{field.label}</span>
          {field.is_pii && <Chip size="small" color="warning" label={t('collections.piiBadge')} />}
        </Stack>
      }
    />
  );
}

function NumberField({ field, value, onChange, testId }: FieldRendererProps) {
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
}

function DateField({ field, value, onChange, testId }: FieldRendererProps) {
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
}

function EnumField({ field, value, onChange, testId }: FieldRendererProps) {
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
}

/** text / richtext / media — richtext gets a multiline field. */
function TextLikeField({ field, value, onChange, testId }: FieldRendererProps) {
  const isRichText = field.field_type === 'richtext';
  return (
    <TextField
      label={field.label}
      value={value ?? ''}
      onChange={(e) => onChange(e.target.value || null)}
      required={field.required}
      fullWidth
      multiline={isRichText}
      minRows={isRichText ? 4 : undefined}
      slotProps={{ htmlInput: { 'data-testid': testId } }}
    />
  );
}

function RedactedField({ field, testId }: FieldRendererProps) {
  const { t } = useTranslation();
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

export function FieldControl({ field, value, onChange }: FieldControlProps) {
  const props = { field, value, onChange, testId: `field-${field.key}` };
  if (field.is_pii && value === null) return <RedactedField {...props} />;
  switch (field.field_type) {
    case 'boolean':
      return <BooleanField {...props} />;
    case 'number':
      return <NumberField {...props} />;
    case 'date':
      return <DateField {...props} />;
    case 'enum':
      return <EnumField {...props} />;
    default:
      return <TextLikeField {...props} />;
  }
}
