import type { AiGenerateResponse } from '@/types/api';
import type { AiPhase, OutlineItem, RegenerateField } from './blogWizardAiFields';
import { regeneratedValues } from './aiDraftRequests';

export type DialogMode = 'manual' | 'ai';
export type AiStep = AiPhase;
export type { OutlineItem };
/** Which body the dialog renders: the manual editor or one of the AI steps. */
export type QuickPostView = 'manual' | AiStep;

// --- Reducer ---

export interface QuickPostState {
  title: string;
  subtitle: string;
  body: string;
  excerpt: string;
  metaTitle: string;
  metaDescription: string;
  menuOpen: boolean;
  mode: DialogMode;
  aiStep: AiStep;
  idea: string;
  outline: OutlineItem[];
  aiError: string | null;
}

export type QuickPostAction =
  | { type: 'RESET' }
  | { type: 'SET_TITLE'; value: string }
  | { type: 'SET_SUBTITLE'; value: string }
  | { type: 'SET_BODY'; value: string }
  | { type: 'SET_EXCERPT'; value: string }
  | { type: 'SET_META_TITLE'; value: string }
  | { type: 'SET_META_DESCRIPTION'; value: string }
  | { type: 'SET_MENU_OPEN'; value: boolean }
  | { type: 'SET_MODE'; value: DialogMode }
  | { type: 'SET_AI_STEP'; value: AiStep }
  | { type: 'SET_IDEA'; value: string }
  | { type: 'SET_OUTLINE'; value: OutlineItem[] }
  | { type: 'SET_AI_ERROR'; value: string | null }
  | { type: 'OUTLINE_GENERATED'; title: string; subtitle: string; outline: OutlineItem[] }
  | { type: 'POST_GENERATED'; body: string; excerpt: string; metaTitle: string; metaDescription: string }
  | { type: 'REGENERATE_OUTLINE' };

export const initialQuickPostState: QuickPostState = {
  title: '', subtitle: '', body: '', excerpt: '', metaTitle: '', metaDescription: '',
  menuOpen: false, mode: 'manual', aiStep: 'idea', idea: '', outline: [], aiError: null,
};

export function quickPostReducer(state: QuickPostState, action: QuickPostAction): QuickPostState {
  switch (action.type) {
    case 'RESET': return { ...initialQuickPostState, mode: state.mode };
    case 'SET_TITLE': return { ...state, title: action.value };
    case 'SET_SUBTITLE': return { ...state, subtitle: action.value };
    case 'SET_BODY': return { ...state, body: action.value };
    case 'SET_EXCERPT': return { ...state, excerpt: action.value };
    case 'SET_META_TITLE': return { ...state, metaTitle: action.value };
    case 'SET_META_DESCRIPTION': return { ...state, metaDescription: action.value };
    case 'SET_MENU_OPEN': return { ...state, menuOpen: action.value };
    case 'SET_MODE': return { ...state, mode: action.value, aiStep: action.value === 'ai' ? 'idea' : state.aiStep };
    case 'SET_AI_STEP': return { ...state, aiStep: action.value };
    case 'SET_IDEA': return { ...state, idea: action.value };
    case 'SET_OUTLINE': return { ...state, outline: action.value };
    case 'SET_AI_ERROR': return { ...state, aiError: action.value };
    case 'OUTLINE_GENERATED': return { ...state, title: action.title || state.title, subtitle: action.subtitle || state.subtitle, outline: action.outline, aiStep: 'outline', aiError: null };
    case 'POST_GENERATED': return { ...state, body: action.body || state.body, excerpt: action.excerpt || state.excerpt, metaTitle: action.metaTitle || state.metaTitle, metaDescription: action.metaDescription || state.metaDescription, aiStep: 'post', aiError: null };
    case 'REGENERATE_OUTLINE': return { ...state, aiStep: 'idea', outline: [], title: '', subtitle: '' };
  }
}

// --- Derivations ---

export function quickPostView(state: Pick<QuickPostState, 'mode' | 'aiStep'>): QuickPostView {
  return state.mode === 'manual' ? 'manual' : state.aiStep;
}

/** Publish/draft actions show for the manual editor and the final AI step. */
export function showsPublishActions(view: QuickPostView): boolean {
  return view === 'manual' || view === 'post';
}

const SET_ACTION_FOR_KEY = {
  body: 'SET_BODY',
  excerpt: 'SET_EXCERPT',
  meta_title: 'SET_META_TITLE',
  meta_description: 'SET_META_DESCRIPTION',
} as const;

/** Reducer actions applying the non-empty regenerated values for `field`. */
export function regeneratedActions(
  field: RegenerateField,
  result: AiGenerateResponse,
): QuickPostAction[] {
  return regeneratedValues(field, result).map(([key, value]) => ({ type: SET_ACTION_FOR_KEY[key], value }));
}
