import { describe, it, expect, vi } from 'vitest';
import {
  initialWizardSourceState,
  isWizardSourceAction,
  markdownUploadBindings,
  templateBrowserBindings,
  wizardSourceReducer,
} from '../wizardSourceState';

describe('wizardSourceState', () => {
  it('recognises only source actions', () => {
    expect(isWizardSourceAction({ type: 'SET_FILE_SIZE' })).toBe(true);
    expect(isWizardSourceAction({ type: 'SET_TEMPLATE_SEARCH' })).toBe(true);
    expect(isWizardSourceAction({ type: 'RESET' })).toBe(false);
  });

  it('keeps host-specific fields when reducing', () => {
    const state = { ...initialWizardSourceState, extra: 'kept' };
    expect(wizardSourceReducer(state, { type: 'SET_FILE_NAME', value: 'a.md' })).toEqual({ ...state, fileName: 'a.md' });
  });

  it('normalises an empty template selection to null', () => {
    const selected = wizardSourceReducer(initialWizardSourceState, { type: 'SET_SELECTED_TEMPLATE', value: 'tpl' });
    expect(selected.selectedTemplate).toBe('tpl');
    expect(wizardSourceReducer(selected, { type: 'SET_SELECTED_TEMPLATE', value: '' }).selectedTemplate).toBeNull();
  });

  it('resets paging and selection when the template search changes', () => {
    const browsing = { ...initialWizardSourceState, templatePage: 3, selectedTemplate: 'tpl' };
    expect(wizardSourceReducer(browsing, { type: 'SET_TEMPLATE_SEARCH', value: 'news' })).toEqual({
      ...browsing, templateSearch: 'news', templatePage: 0, selectedTemplate: null,
    });
  });

  it('binds template-browser and dropzone callbacks to source actions', () => {
    const dispatch = vi.fn();
    const onParsed = vi.fn();
    templateBrowserBindings(initialWizardSourceState, dispatch).onPageChange(2);
    const upload = markdownUploadBindings(initialWizardSourceState, dispatch, onParsed);
    upload.onDragOver(true);
    upload.onImportError('bad');
    expect(dispatch.mock.calls).toEqual([
      [{ type: 'SET_TEMPLATE_PAGE', value: 2 }],
      [{ type: 'SET_DRAG_OVER', value: true }],
      [{ type: 'SET_IMPORT_ERROR', value: 'bad' }],
    ]);
    expect(upload.onParsed).toBe(onParsed);
  });
});
