import type { MarkdownParseResult } from '@/utils/markdownImport';
import {
  initialWizardSourceState,
  isWizardSourceAction,
  wizardSourceReducer,
  type WizardSourceAction,
  type WizardSourceState,
} from '@/components/shared/contentWizard/wizardSourceState';
import type { AiPhase, OutlineItem } from './blogWizardAiFields';

export type CreationMethod = 'scratch' | 'template' | 'import' | 'ai';

export type AiDraftField = 'aiBody' | 'aiExcerpt' | 'aiMetaTitle' | 'aiMetaDescription';

export interface BlogWizardState extends WizardSourceState {
  activeStep: number;
  method: CreationMethod | null;
  aiPhase: AiPhase;
  aiIdea: string;
  aiTitle: string;
  aiSubtitle: string;
  aiOutline: OutlineItem[];
  aiBody: string;
  aiExcerpt: string;
  aiMetaTitle: string;
  aiMetaDescription: string;
  aiError: string | null;
  importPhase: 'upload' | 'preview';
  parsed: MarkdownParseResult | null;
  importTitle: string;
  importExcerpt: string;
  importSlug: string;
}

export type BlogWizardAction =
  | WizardSourceAction
  | { type: 'RESET' }
  | { type: 'SELECT_METHOD'; method: CreationMethod }
  | { type: 'BACK' }
  | { type: 'SET_AI_IDEA'; value: string }
  | { type: 'SET_AI_TITLE'; value: string }
  | { type: 'SET_AI_SUBTITLE'; value: string }
  | { type: 'SET_AI_OUTLINE'; value: OutlineItem[] }
  | { type: 'SET_AI_BODY'; value: string }
  | { type: 'SET_AI_EXCERPT'; value: string }
  | { type: 'SET_AI_META_TITLE'; value: string }
  | { type: 'SET_AI_META_DESCRIPTION'; value: string }
  | { type: 'SET_AI_ERROR'; value: string | null }
  | { type: 'OUTLINE_GENERATED'; title: string; subtitle: string; outline: OutlineItem[] }
  | { type: 'POST_GENERATED'; body: string; excerpt: string; metaTitle: string; metaDescription: string }
  | { type: 'AI_FIELDS_REGENERATED'; fields: Partial<Pick<BlogWizardState, AiDraftField>> }
  | { type: 'FILE_PARSED'; parsed: MarkdownParseResult; title: string; excerpt: string; slug: string }
  | { type: 'SET_IMPORT_TITLE'; value: string }
  | { type: 'SET_IMPORT_EXCERPT'; value: string }
  | { type: 'SET_IMPORT_SLUG'; value: string };

export const initialBlogWizardState: BlogWizardState = {
  ...initialWizardSourceState,
  activeStep: 0, method: null,
  aiPhase: 'idea', aiIdea: '', aiTitle: '', aiSubtitle: '', aiOutline: [],
  aiBody: '', aiExcerpt: '', aiMetaTitle: '', aiMetaDescription: '', aiError: null,
  importPhase: 'upload', parsed: null,
  importTitle: '', importExcerpt: '', importSlug: '',
};

const PREVIOUS_AI_PHASE: Record<AiPhase, AiPhase | null> = { idea: null, outline: 'idea', post: 'outline' };

/** Back unwinds the current method's sub-phase first, then returns to method selection. */
export function stepBack(state: BlogWizardState): BlogWizardState {
  if (state.method === 'import' && state.importPhase === 'preview') {
    return { ...state, importPhase: 'upload', importError: null };
  }
  const previousAiPhase = state.method === 'ai' ? PREVIOUS_AI_PHASE[state.aiPhase] : null;
  if (previousAiPhase) return { ...state, aiPhase: previousAiPhase };
  return { ...state, activeStep: 0, method: null };
}

export function blogWizardReducer(state: BlogWizardState, action: BlogWizardAction): BlogWizardState {
  if (isWizardSourceAction(action)) return wizardSourceReducer(state, action);
  switch (action.type) {
    case 'RESET': return initialBlogWizardState;
    case 'SELECT_METHOD': return { ...state, method: action.method, activeStep: 1 };
    case 'BACK': return stepBack(state);
    case 'SET_AI_IDEA': return { ...state, aiIdea: action.value };
    case 'SET_AI_TITLE': return { ...state, aiTitle: action.value };
    case 'SET_AI_SUBTITLE': return { ...state, aiSubtitle: action.value };
    case 'SET_AI_OUTLINE': return { ...state, aiOutline: action.value };
    case 'SET_AI_BODY': return { ...state, aiBody: action.value };
    case 'SET_AI_EXCERPT': return { ...state, aiExcerpt: action.value };
    case 'SET_AI_META_TITLE': return { ...state, aiMetaTitle: action.value };
    case 'SET_AI_META_DESCRIPTION': return { ...state, aiMetaDescription: action.value };
    case 'SET_AI_ERROR': return { ...state, aiError: action.value };
    case 'OUTLINE_GENERATED': return { ...state, aiTitle: action.title || state.aiTitle, aiSubtitle: action.subtitle || state.aiSubtitle, aiOutline: action.outline, aiPhase: 'outline', aiError: null };
    case 'POST_GENERATED': return { ...state, aiBody: action.body || state.aiBody, aiExcerpt: action.excerpt || state.aiExcerpt, aiMetaTitle: action.metaTitle || state.aiMetaTitle, aiMetaDescription: action.metaDescription || state.aiMetaDescription, aiPhase: 'post', aiError: null };
    case 'AI_FIELDS_REGENERATED': return { ...state, ...action.fields };
    case 'FILE_PARSED': return { ...state, parsed: action.parsed, importTitle: action.title, importExcerpt: action.excerpt, importSlug: action.slug, importPhase: 'preview' };
    case 'SET_IMPORT_TITLE': return { ...state, importTitle: action.value };
    case 'SET_IMPORT_EXCERPT': return { ...state, importExcerpt: action.value };
    case 'SET_IMPORT_SLUG': return { ...state, importSlug: action.value };
  }
}
