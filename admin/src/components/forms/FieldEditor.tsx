import { useMemo } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box,
  FormControlLabel,
  IconButton,
  Switch,
  TextField,
  Tooltip,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutlined';
import type { FormFieldInput, FormFieldOption, FormFieldValidation } from '@/types/api';
import { fieldEditorSections, parseFloatOrUndef, parseIntOrUndef } from './fieldEditorRules';

interface FieldEditorProps {
  field: FormFieldInput;
  onChange: (patch: Partial<FormFieldInput>) => void;
}

/**
 * One field's editor surface. Which rows render depends on the field type
 * (see `fieldEditorSections`): every type gets label, help and required;
 * free-text types add placeholder / length / pattern rules, numbers add
 * min/max, and choice types add an options list.
 */
export default function FieldEditor({ field, onChange }: FieldEditorProps) {
  const { t } = useTranslation();
  const sections = fieldEditorSections(field.field_type);

  const v: FormFieldValidation = useMemo(() => (field.validation as FormFieldValidation | null | undefined) ?? {}, [field.validation]);
  const setValidation = (patch: Partial<FormFieldValidation>) =>
    onChange({ validation: { ...v, ...patch } });

  return (
    <Box sx={{ display: 'grid', gap: 2 }}>
      <TextField
        label={t('formsModule.builder.field.label', 'Label')}
        value={field.label}
        onChange={(e) => onChange({ label: e.target.value })}
        fullWidth
        size="small"
      />

      {sections.placeholder && (
        <TextField
          label={t('formsModule.builder.field.placeholder', 'Placeholder')}
          value={field.placeholder ?? ''}
          onChange={(e) => onChange({ placeholder: e.target.value || null })}
          fullWidth
          size="small"
        />
      )}

      <TextField
        label={t('formsModule.builder.field.helpText', 'Help text')}
        value={field.help_text ?? ''}
        onChange={(e) => onChange({ help_text: e.target.value || null })}
        fullWidth
        size="small"
      />

      <FormControlLabel
        control={
          <Switch
            checked={!!field.is_required}
            onChange={(_, checked) =>
              onChange({
                is_required: checked,
                validation: { ...v, required: checked },
              })
            }
            data-testid="forms.fields.field.required"
          />
        }
        label={t('formsModule.builder.field.required', 'Required')}
      />

      {sections.lengthRules && (
        <NumberRangeFields
          minLabel={t('formsModule.builder.field.minLength', 'Min length')}
          maxLabel={t('formsModule.builder.field.maxLength', 'Max length')}
          min={v.min_length}
          max={v.max_length}
          onMinChange={(raw) => setValidation({ min_length: parseIntOrUndef(raw) })}
          onMaxChange={(raw) => setValidation({ max_length: parseIntOrUndef(raw) })}
        />
      )}

      {sections.pattern && (
        <TextField
          label={t('formsModule.builder.field.pattern', 'Regex pattern')}
          value={v.pattern ?? ''}
          onChange={(e) => setValidation({ pattern: e.target.value || undefined })}
          fullWidth
          size="small"
          helperText={t(
            'formsModule.builder.field.patternHelp',
            'Optional regular expression — input must match before submit.',
          )}
        />
      )}

      {sections.minMax && (
        <NumberRangeFields
          minLabel={t('formsModule.builder.field.min', 'Min')}
          maxLabel={t('formsModule.builder.field.max', 'Max')}
          min={v.min}
          max={v.max}
          onMinChange={(raw) => setValidation({ min: parseFloatOrUndef(raw) })}
          onMaxChange={(raw) => setValidation({ max: parseFloatOrUndef(raw) })}
        />
      )}

      {sections.options && <OptionsEditor field={field} onChange={onChange} />}
    </Box>
  );
}

interface NumberRangeFieldsProps {
  minLabel: string;
  maxLabel: string;
  min: number | null | undefined;
  max: number | null | undefined;
  /** Receives the raw input string; the caller parses it. */
  onMinChange: (raw: string) => void;
  onMaxChange: (raw: string) => void;
}

/** Side-by-side min/max number inputs for a validation rule pair. */
function NumberRangeFields({ minLabel, maxLabel, min, max, onMinChange, onMaxChange }: NumberRangeFieldsProps) {
  return (
    <Box sx={{ display: 'flex', gap: 2 }}>
      <TextField
        label={minLabel}
        type="number"
        size="small"
        value={min ?? ''}
        onChange={(e) => onMinChange(e.target.value)}
      />
      <TextField
        label={maxLabel}
        type="number"
        size="small"
        value={max ?? ''}
        onChange={(e) => onMaxChange(e.target.value)}
      />
    </Box>
  );
}

interface OptionsEditorProps {
  field: FormFieldInput;
  onChange: (patch: Partial<FormFieldInput>) => void;
}

function OptionsEditor({ field, onChange }: OptionsEditorProps) {
  const { t } = useTranslation();
  const options: FormFieldOption[] = Array.isArray(field.options) ? field.options : [];

  function set(opts: FormFieldOption[]) {
    onChange({ options: opts });
  }

  function add() {
    set([...options, { key: `option_${options.length + 1}`, label: '' }]);
  }

  function update(index: number, patch: Partial<FormFieldOption>) {
    set(options.map((o, i) => (i === index ? { ...o, ...patch } : o)));
  }

  function remove(index: number) {
    set(options.filter((_, i) => i !== index));
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
        <Box sx={{ fontSize: 13, color: 'text.secondary', fontWeight: 600 }}>
          {t('formsModule.builder.field.options', 'Options')}
        </Box>
        <Tooltip title={t('formsModule.builder.field.addOption', 'Add option')}>
          <IconButton
            size="small"
            onClick={add}
            data-testid="forms.fields.options.btn.add"
          >
            <AddIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>
      {options.length === 0 && (
        <Box sx={{ fontSize: 12, color: 'text.secondary', fontStyle: 'italic' }}>
          {t(
            'formsModule.builder.field.optionsEmpty',
            'No options yet — add one to make this field useful.',
          )}
        </Box>
      )}
      <Box sx={{ display: 'grid', gap: 1 }}>
        {options.map((opt, i) => (
          <Box key={i} sx={{ display: 'flex', gap: 1, alignItems: 'center' }}>
            <TextField
              label={t('formsModule.builder.field.optionKey', 'Key')}
              size="small"
              value={opt.key}
              onChange={(e) => update(i, { key: e.target.value })}
              sx={{ flex: 1 }}
            />
            <TextField
              label={t('formsModule.builder.field.optionLabel', 'Label')}
              size="small"
              value={opt.label}
              onChange={(e) => update(i, { label: e.target.value })}
              sx={{ flex: 2 }}
            />
            <IconButton
              size="small"
              onClick={() => remove(i)}
              data-testid="forms.fields.options.btn.delete"
              sx={{ color: 'var(--err)' }}
            >
              <DeleteOutlineIcon fontSize="small" />
            </IconButton>
          </Box>
        ))}
      </Box>
    </Box>
  );
}
