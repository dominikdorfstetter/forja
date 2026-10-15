import { describe, it, expect } from 'vitest';
import {
  fieldEditorSections,
  isOptionType,
  parseFloatOrUndef,
  parseIntOrUndef,
} from '../fieldEditorRules';

describe('fieldEditorRules', () => {
  it('shows length rules and pattern for free-text types', () => {
    expect(fieldEditorSections('text')).toEqual({
      placeholder: true, lengthRules: true, pattern: true, minMax: false, options: false,
    });
    expect(fieldEditorSections('textarea')).toMatchObject({ lengthRules: true, pattern: false });
  });

  it('shows min/max only for numbers and options only for choice types', () => {
    expect(fieldEditorSections('number')).toMatchObject({ placeholder: true, minMax: true, lengthRules: false });
    expect(fieldEditorSections('select')).toMatchObject({ placeholder: false, options: true });
    expect(fieldEditorSections('date')).toMatchObject({ placeholder: false, options: false });
  });

  it('classifies choice field types', () => {
    expect(isOptionType('radio')).toBe(true);
    expect(isOptionType('checkbox')).toBe(true);
    expect(isOptionType('email')).toBe(false);
  });

  it('parses numeric inputs, mapping empty or invalid input to undefined', () => {
    expect(parseIntOrUndef('')).toBeUndefined();
    expect(parseIntOrUndef('abc')).toBeUndefined();
    expect(parseIntOrUndef('42')).toBe(42);
    expect(parseFloatOrUndef('')).toBeUndefined();
    expect(parseFloatOrUndef('1.5')).toBe(1.5);
  });
});
