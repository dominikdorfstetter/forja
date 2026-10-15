import { describe, it, expect } from 'vitest';
import {
  canSubmitDocumentForm,
  docFormReducer,
  initialDocFormState,
  isPrivacyPasswordValid,
  type DocFormState,
} from '../documentFormState';

const file = new File(['x'], 'a.pdf');

function stateWith(patch: Partial<DocFormState>): DocFormState {
  return { ...initialDocFormState, ...patch };
}

describe('docFormReducer', () => {
  it('switching source type clears the picked file, its error and drag state', () => {
    const next = docFormReducer(
      stateWith({ sourceType: 'upload', selectedFile: file, fileError: 'too big', dragOver: true }),
      { type: 'SET_SOURCE_TYPE', value: 'link' },
    );
    expect(next).toMatchObject({ sourceType: 'link', selectedFile: null, fileError: null, dragOver: false });
  });

  it('turning privacy on seeds a matching visible password; off clears it', () => {
    const on = docFormReducer(initialDocFormState, { type: 'SET_IS_PRIVATE', value: true });
    expect(on.password.length).toBeGreaterThanOrEqual(10);
    expect(on.confirmPassword).toBe(on.password);
    expect(on.showPassword).toBe(true);

    const off = docFormReducer(on, { type: 'SET_IS_PRIVATE', value: false });
    expect(off).toMatchObject({ isPrivate: false, password: '', confirmPassword: '', showPassword: false });
  });
});

describe('isPrivacyPasswordValid', () => {
  it('is always valid when privacy is off', () => {
    expect(isPrivacyPasswordValid(stateWith({ isPrivate: false, password: 'x' }), undefined)).toBe(true);
  });

  it('requires the minimum length and a matching confirmation', () => {
    const policy = { minLength: 8, regex: '' };
    expect(isPrivacyPasswordValid(stateWith({ isPrivate: true, password: '', confirmPassword: '' }), policy)).toBe(false);
    expect(isPrivacyPasswordValid(stateWith({ isPrivate: true, password: 'short', confirmPassword: 'short' }), policy)).toBe(false);
    expect(isPrivacyPasswordValid(stateWith({ isPrivate: true, password: 'longenough', confirmPassword: 'different!' }), policy)).toBe(false);
    expect(isPrivacyPasswordValid(stateWith({ isPrivate: true, password: 'longenough', confirmPassword: 'longenough' }), policy)).toBe(true);
  });
});

describe('canSubmitDocumentForm', () => {
  const ok = { formValid: true, loading: false, isEditing: false };

  it('needs a picked file for a new upload', () => {
    expect(canSubmitDocumentForm(stateWith({ sourceType: 'upload' }), ok)).toBe(false);
    expect(canSubmitDocumentForm(stateWith({ sourceType: 'upload', selectedFile: file }), ok)).toBe(true);
  });

  it('lets links and edits through without a file', () => {
    expect(canSubmitDocumentForm(stateWith({ sourceType: 'link' }), ok)).toBe(true);
    expect(canSubmitDocumentForm(stateWith({ sourceType: 'upload' }), { ...ok, isEditing: true })).toBe(true);
  });

  it('is blocked by an invalid form, loading, or an invalid privacy password', () => {
    const ready = stateWith({ sourceType: 'link' });
    expect(canSubmitDocumentForm(ready, { ...ok, formValid: false })).toBe(false);
    expect(canSubmitDocumentForm(ready, { ...ok, loading: true })).toBe(false);
    expect(canSubmitDocumentForm(stateWith({ sourceType: 'link', isPrivate: true }), ok)).toBe(false);
  });
});
