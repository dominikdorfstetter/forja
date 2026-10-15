import type { MarkdownParseResult } from '@/utils/markdownImport';
import {
  initialWizardSourceState,
  isWizardSourceAction,
  wizardSourceReducer,
  type WizardSourceAction,
  type WizardSourceState,
} from '@/components/shared/contentWizard/wizardSourceState';

export type TemplateCreationMethod = 'scratch' | 'template' | 'import';

export interface TemplateWizardState extends WizardSourceState {
  activeStep: number;
  method: TemplateCreationMethod | null;
  // Import
  parsed: MarkdownParseResult | null;
  // Scratch
  name: string;
  slugPrefix: string;
  body: string;
  // Import edit fields
  editName: string;
  editSlugPrefix: string;
  editBody: string;
}

export type TemplateWizardAction =
  | WizardSourceAction
  | { type: 'RESET' }
  | { type: 'SELECT_METHOD'; method: TemplateCreationMethod }
  | { type: 'GO_BACK' }
  | { type: 'SET_PARSED'; result: MarkdownParseResult }
  | { type: 'SET_NAME'; value: string }
  | { type: 'SET_SLUG_PREFIX'; value: string }
  | { type: 'SET_BODY'; value: string }
  | { type: 'SET_EDIT_NAME'; value: string }
  | { type: 'SET_EDIT_SLUG_PREFIX'; value: string };

export const initialTemplateWizardState: TemplateWizardState = {
  ...initialWizardSourceState,
  activeStep: 0,
  method: null,
  parsed: null,
  name: '',
  slugPrefix: 'post',
  body: '',
  editName: '',
  editSlugPrefix: '',
  editBody: '',
};

export function templateWizardReducer(state: TemplateWizardState, action: TemplateWizardAction): TemplateWizardState {
  if (isWizardSourceAction(action)) return wizardSourceReducer(state, action);
  switch (action.type) {
    case 'RESET':
      return initialTemplateWizardState;
    case 'SELECT_METHOD':
      return { ...state, method: action.method, activeStep: 1 };
    case 'GO_BACK':
      return { ...state, activeStep: 0, method: null };
    case 'SET_PARSED':
      // Imported slugs carry a timestamp suffix; the template stores just the prefix.
      return { ...state, parsed: action.result, editName: action.result.title, editSlugPrefix: action.result.slug.replace(/-\d+$/, ''), editBody: action.result.body };
    case 'SET_NAME':
      return { ...state, name: action.value };
    case 'SET_SLUG_PREFIX':
      return { ...state, slugPrefix: action.value };
    case 'SET_BODY':
      return { ...state, body: action.value };
    case 'SET_EDIT_NAME':
      return { ...state, editName: action.value };
    case 'SET_EDIT_SLUG_PREFIX':
      return { ...state, editSlugPrefix: action.value };
  }
}
