import { generatePassword, validatePassword, type PasswordPolicy } from './passwordUtils';

/** Local (non-react-hook-form) state of the document create/edit dialog. */
export interface DocFormState {
  activeTab: number;
  sourceType: 'link' | 'upload';
  selectedFile: File | null;
  fileError: string | null;
  dragOver: boolean;
  isPrivate: boolean;
  password: string;
  confirmPassword: string;
  showPassword: boolean;
}

export type DocFormAction =
  | { type: 'RESET'; sourceType: 'link' | 'upload' }
  | { type: 'SET_ACTIVE_TAB'; value: number }
  | { type: 'SET_SOURCE_TYPE'; value: 'link' | 'upload' }
  | { type: 'SET_SELECTED_FILE'; file: File | null }
  | { type: 'SET_FILE_ERROR'; error: string | null }
  | { type: 'SET_DRAG_OVER'; value: boolean }
  | { type: 'SET_IS_PRIVATE'; value: boolean; policy?: PasswordPolicy }
  | { type: 'SET_PASSWORD'; value: string }
  | { type: 'SET_CONFIRM_PASSWORD'; value: string }
  | { type: 'SET_SHOW_PASSWORD'; value: boolean }
  | { type: 'GENERATE_PASSWORD'; policy?: PasswordPolicy };

export const initialDocFormState: DocFormState = {
  activeTab: 0,
  sourceType: 'link',
  selectedFile: null,
  fileError: null,
  dragOver: false,
  isPrivate: false,
  password: '',
  confirmPassword: '',
  showPassword: false,
};

export function docFormReducer(state: DocFormState, action: DocFormAction): DocFormState {
  switch (action.type) {
    case 'RESET': return { ...initialDocFormState, sourceType: action.sourceType };
    case 'SET_ACTIVE_TAB': return { ...state, activeTab: action.value };
    case 'SET_SOURCE_TYPE': return { ...state, sourceType: action.value, selectedFile: null, fileError: null, dragOver: false };
    case 'SET_SELECTED_FILE': return { ...state, selectedFile: action.file };
    case 'SET_FILE_ERROR': return { ...state, fileError: action.error };
    case 'SET_DRAG_OVER': return { ...state, dragOver: action.value };
    case 'SET_IS_PRIVATE': {
      const pw = action.value ? generatePassword(action.policy) : '';
      return { ...state, isPrivate: action.value, password: pw, confirmPassword: pw, showPassword: action.value };
    }
    case 'SET_PASSWORD': return { ...state, password: action.value };
    case 'SET_CONFIRM_PASSWORD': return { ...state, confirmPassword: action.value };
    case 'SET_SHOW_PASSWORD': return { ...state, showPassword: action.value };
    case 'GENERATE_PASSWORD': {
      const pw = generatePassword(action.policy);
      return { ...state, password: pw, confirmPassword: pw, showPassword: true };
    }
  }
}

/** True when privacy is off, or the chosen password satisfies the policy and matches its confirmation. */
export function isPrivacyPasswordValid(state: DocFormState, policy: PasswordPolicy | undefined): boolean {
  if (!state.isPrivate) return true;
  const minLength = policy?.minLength ?? 8;
  return !validatePassword(state.password, policy)
    && state.password.length >= minLength
    && state.password === state.confirmPassword;
}

/** Whether the dialog's submit button is enabled. */
export function canSubmitDocumentForm(
  state: DocFormState,
  { formValid, loading, isEditing, policy }: { formValid: boolean; loading: boolean; isEditing: boolean; policy?: PasswordPolicy },
): boolean {
  const hasSource = state.sourceType === 'link' || isEditing || state.selectedFile !== null;
  return formValid && isPrivacyPasswordValid(state, policy) && !loading && hasSource;
}
