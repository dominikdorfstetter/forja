import {
  TextField,
  Switch,
  FormControlLabel,
  MenuItem,
  Stack,
  Typography,
} from '@mui/material';
import { useTranslation } from 'react-i18next';
import type { SectionType } from '@/types/api';
import {
  SECTION_SETTINGS_FIELDS,
  readBool,
  readNumber,
  readString,
  type SectionSettings,
  type SettingsFieldDescriptor,
} from './sectionSettingsFields';

interface SectionSettingsFormProps {
  sectionType: SectionType;
  settings: Record<string, unknown>;
  onChange: (settings: Record<string, unknown>) => void;
}

interface SettingsBinding {
  settings: SectionSettings;
  onChange: (settings: SectionSettings) => void;
}

interface FieldProps<F extends SettingsFieldDescriptor['kind']> extends SettingsBinding {
  field: Extract<SettingsFieldDescriptor, { kind: F }>;
}

function SwitchSetting({ field, settings, onChange }: FieldProps<'switch'>) {
  const { t } = useTranslation();
  return (
    <FormControlLabel
      control={
        <Switch
          checked={readBool(settings, field.key, field.fallback)}
          onChange={(e) => onChange({ ...settings, [field.key]: e.target.checked })}
        />
      }
      label={t(field.labelKey)}
    />
  );
}

function TextSetting({ field, settings, onChange }: FieldProps<'text'>) {
  const { t } = useTranslation();
  return (
    <TextField
      label={t(field.labelKey)}
      fullWidth
      size="small"
      value={readString(settings, field.key, field.fallback)}
      onChange={(e) => onChange({ ...settings, [field.key]: e.target.value })}
      helperText={t(field.helperKey)}
    />
  );
}

function SelectSetting({ field, settings, onChange }: FieldProps<'select'>) {
  const { t } = useTranslation();
  const { fallback } = field;
  const value = typeof fallback === 'number'
    ? readNumber(settings, field.key, fallback)
    : readString(settings, field.key, fallback);
  return (
    <TextField
      select
      label={t(field.labelKey)}
      fullWidth
      size="small"
      value={value}
      onChange={(e) => onChange({
        ...settings,
        [field.key]: typeof fallback === 'number' ? Number(e.target.value) : e.target.value,
      })}
    >
      {field.options.map((option) => (
        <MenuItem key={option.value} value={option.value}>
          {option.labelKey ? t(option.labelKey, option.labelParams) : option.value}
        </MenuItem>
      ))}
    </TextField>
  );
}

function JsonSetting({ field, settings, onChange }: FieldProps<'json'>) {
  const { t } = useTranslation();
  return (
    <TextField
      multiline
      minRows={4}
      maxRows={12}
      fullWidth
      size="small"
      value={JSON.stringify(settings, null, 2)}
      onChange={(e) => {
        try {
          const parsed = JSON.parse(e.target.value);
          onChange(parsed);
        } catch {
          // Allow intermediate invalid JSON while typing
        }
      }}
      helperText={t(field.helperKey)}
    />
  );
}

function SettingsField({ field, settings, onChange }: SettingsBinding & { field: SettingsFieldDescriptor }) {
  switch (field.kind) {
    case 'switch':
      return <SwitchSetting field={field} settings={settings} onChange={onChange} />;
    case 'text':
      return <TextSetting field={field} settings={settings} onChange={onChange} />;
    case 'select':
      return <SelectSetting field={field} settings={settings} onChange={onChange} />;
    case 'json':
      return <JsonSetting field={field} settings={settings} onChange={onChange} />;
  }
}

/** Per-section-type settings form, driven by the {@link SECTION_SETTINGS_FIELDS} registry. */
export default function SectionSettingsForm({ sectionType, settings, onChange }: SectionSettingsFormProps) {
  const { t } = useTranslation();
  const descriptor = SECTION_SETTINGS_FIELDS[sectionType];
  if (!descriptor) return null;

  return (
    <Stack spacing={2}>
      <Typography variant="subtitle2" color="text.secondary">{t(descriptor.titleKey)}</Typography>
      {descriptor.fields.map((field) => (
        <SettingsField
          key={field.kind === 'json' ? field.kind : field.key}
          field={field}
          settings={settings}
          onChange={onChange}
        />
      ))}
    </Stack>
  );
}
