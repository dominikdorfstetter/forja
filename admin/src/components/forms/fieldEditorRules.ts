import type { FormFieldInput } from '@/types/api';

type FieldType = FormFieldInput['field_type'];

/** Which editor rows apply to a field type:
 * - text / custom: placeholder, min/max length, pattern
 * - textarea: placeholder, min/max length
 * - email: placeholder
 * - number: placeholder, min, max
 * - date: (none beyond label/help/required)
 * - select / radio / checkbox: options list
 */
export function fieldEditorSections(type: FieldType) {
  const options = isOptionType(type);
  return {
    placeholder: type !== 'date' && !options,
    lengthRules: type === 'text' || type === 'textarea' || type === 'custom',
    pattern: type === 'text' || type === 'custom',
    minMax: type === 'number',
    options,
  };
}

export function isOptionType(t: FieldType): boolean {
  return t === 'select' || t === 'radio' || t === 'checkbox';
}

export function parseIntOrUndef(v: string): number | undefined {
  if (v === '') return undefined;
  const n = parseInt(v, 10);
  return Number.isNaN(n) ? undefined : n;
}

export function parseFloatOrUndef(v: string): number | undefined {
  if (v === '') return undefined;
  const n = parseFloat(v);
  return Number.isNaN(n) ? undefined : n;
}
