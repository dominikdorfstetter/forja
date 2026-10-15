import type { Dispatch } from 'react';
import type { MarkdownParseResult } from '@/utils/markdownImport';

/**
 * State both content wizards (blog + content template) keep for their shared
 * sources: the template browser and the markdown import dropzone.
 */
export interface WizardSourceState {
  selectedTemplate: string | null;
  templateSearch: string;
  templatePage: number;
  dragOver: boolean;
  importError: string | null;
  fileName: string;
  fileSize: number;
}

export type WizardSourceAction =
  | { type: 'SET_SELECTED_TEMPLATE'; value: string | null }
  | { type: 'SET_TEMPLATE_SEARCH'; value: string }
  | { type: 'SET_TEMPLATE_PAGE'; value: number }
  | { type: 'SET_DRAG_OVER'; value: boolean }
  | { type: 'SET_IMPORT_ERROR'; value: string | null }
  | { type: 'SET_FILE_NAME'; value: string }
  | { type: 'SET_FILE_SIZE'; value: number };

export const initialWizardSourceState: WizardSourceState = {
  selectedTemplate: null,
  templateSearch: '',
  templatePage: 0,
  dragOver: false,
  importError: null,
  fileName: '',
  fileSize: 0,
};

const SOURCE_ACTION_TYPES: ReadonlySet<string> = new Set<WizardSourceAction['type']>([
  'SET_SELECTED_TEMPLATE',
  'SET_TEMPLATE_SEARCH',
  'SET_TEMPLATE_PAGE',
  'SET_DRAG_OVER',
  'SET_IMPORT_ERROR',
  'SET_FILE_NAME',
  'SET_FILE_SIZE',
]);

export function isWizardSourceAction(action: { type: string }): action is WizardSourceAction {
  return SOURCE_ACTION_TYPES.has(action.type);
}

/** Applies a source action to any wizard state that embeds the source slice. */
export function wizardSourceReducer<S extends WizardSourceState>(state: S, action: WizardSourceAction): S {
  switch (action.type) {
    case 'SET_SELECTED_TEMPLATE': return { ...state, selectedTemplate: action.value || null };
    case 'SET_TEMPLATE_SEARCH': return { ...state, templateSearch: action.value, templatePage: 0, selectedTemplate: null };
    case 'SET_TEMPLATE_PAGE': return { ...state, templatePage: action.value };
    case 'SET_DRAG_OVER': return { ...state, dragOver: action.value };
    case 'SET_IMPORT_ERROR': return { ...state, importError: action.value };
    case 'SET_FILE_NAME': return { ...state, fileName: action.value };
    case 'SET_FILE_SIZE': return { ...state, fileSize: action.value };
  }
}

/** Template-browser props wired to a wizard's source slice. */
export function templateBrowserBindings(state: WizardSourceState, dispatch: Dispatch<WizardSourceAction>) {
  return {
    selectedTemplate: state.selectedTemplate,
    onSelectTemplate: (value: string | null) => dispatch({ type: 'SET_SELECTED_TEMPLATE', value }),
    templateSearch: state.templateSearch,
    onSearchChange: (value: string) => dispatch({ type: 'SET_TEMPLATE_SEARCH', value }),
    templatePage: state.templatePage,
    onPageChange: (value: number) => dispatch({ type: 'SET_TEMPLATE_PAGE', value }),
  };
}

/** Markdown-dropzone props wired to a wizard's source slice; parsing is wizard-specific. */
export function markdownUploadBindings(
  state: WizardSourceState,
  dispatch: Dispatch<WizardSourceAction>,
  onParsed: (result: MarkdownParseResult) => void,
) {
  return {
    dragOver: state.dragOver,
    fileName: state.fileName,
    fileSize: state.fileSize,
    importError: state.importError,
    onDragOver: (value: boolean) => dispatch({ type: 'SET_DRAG_OVER', value }),
    onImportError: (value: string | null) => dispatch({ type: 'SET_IMPORT_ERROR', value }),
    onFileName: (value: string) => dispatch({ type: 'SET_FILE_NAME', value }),
    onFileSize: (value: number) => dispatch({ type: 'SET_FILE_SIZE', value }),
    onParsed,
  };
}

export type MarkdownUploadBindings = ReturnType<typeof markdownUploadBindings>;
