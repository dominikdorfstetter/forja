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

interface FieldEditorProps {
  field: FormFieldInput;
  onChange: (patch: Partial<FormFieldInput>) => void;
}

/**
 * One field's editor surface. Shape depends on field type:
 * - text / custom: label, placeholder, help, required, min/max length, pattern
 * - textarea: label, placeholder, help, required, min/max length
 * - email: label, placeholder, help, required
 * - number: label, placeholder, help, required, min, max
 * - date: label, help, required
 * - select / radio / checkbox: label, help, required, options list
 *
 * Splitting per type would balloon the component count; the conditional
 * blocks here are cheap and the conditions are small enough to read.
 */
export default function FieldEditor({ field, onChange }: FieldEditorProps) {
  const { t } = useTranslation();
  const type = field.field_type;

  const v: FormFieldValidation = useMemo(() => (field.validation as FormFieldValidation | null | undefined) ?? {}, [field.validation]);
  const setValidation = (patch: Partial<FormFieldValidation>) =>
    onChange({ validation: { ...v, ...patch } });

  const showPlaceholder = type !== 'date' && !isOptionType(type);
  const showLenRules = type === 'text' || type === 'textarea' || type === 'custom';
  const showPattern = type === 'text' || type === 'custom';
  const showMinMax = type === 'number';
  const showOptions = isOptionType(type);

  return (
    <Box sx={{ display: 'grid', gap: 2 }}>
      <TextField
        label={t('formsModule.builder.field.label', 'Label')}
        value={field.label}
        onChange={(e) => onChange({ label: e.target.value })}
        fullWidth
        size="small"
      />

      {showPlaceholder && (
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

      {showLenRules && (
        <Box sx={{ display: 'flex', gap: 2 }}>
          <TextField
            label={t('formsModule.builder.field.minLength', 'Min length')}
            type="number"
            size="small"
            value={v.min_length ?? ''}
            onChange={(e) => setValidation({ min_length: parseIntOrUndef(e.target.value) })}
          />
          <TextField
            label={t('formsModule.builder.field.maxLength', 'Max length')}
            type="number"
            size="small"
            value={v.max_length ?? ''}
            onChange={(e) => setValidation({ max_length: parseIntOrUndef(e.target.value) })}
          />
        </Box>
      )}

      {showPattern && (
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

      {showMinMax && (
        <Box sx={{ display: 'flex', gap: 2 }}>
          <TextField
            label={t('formsModule.builder.field.min', 'Min')}
            type="number"
            size="small"
            value={v.min ?? ''}
            onChange={(e) => setValidation({ min: parseFloatOrUndef(e.target.value) })}
          />
          <TextField
            label={t('formsModule.builder.field.max', 'Max')}
            type="number"
            size="small"
            value={v.max ?? ''}
            onChange={(e) => setValidation({ max: parseFloatOrUndef(e.target.value) })}
          />
        </Box>
      )}

      {showOptions && <OptionsEditor field={field} onChange={onChange} />}
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

function isOptionType(t: FormFieldInput['field_type']): boolean {
  return t === 'select' || t === 'radio' || t === 'checkbox';
}

function parseIntOrUndef(v: string): number | undefined {
  if (v === '') return undefined;
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? undefined : n;
}

function parseFloatOrUndef(v: string): number | undefined {
  if (v === '') return undefined;
  const n = parseFloat(v);
  return Number.isNaN(n) ? undefined : n;
}
