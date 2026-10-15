import type { AiGenerateResponse } from '@/types/api';
import type { AiPhase, RegenerateField } from './blogWizardAiFields';
import type { AiDraftField, BlogWizardState } from './blogWizardState';
import { regeneratedValues, type AiResultKey } from './aiDraftRequests';

/** Template/AI pickers (and the AI-enabled method grid) need the wider dialog. */
export function wizardDialogWidth(state: BlogWizardState, aiAvailable: boolean): 'md' | 'sm' {
  const wide = state.method === 'template' || state.method === 'ai' || (state.activeStep === 0 && aiAvailable);
  return wide ? 'md' : 'sm';
}

export function canManageTemplates(state: BlogWizardState, isAdmin: boolean): boolean {
  return state.activeStep === 1 && state.method === 'template' && isAdmin;
}

// --- Primary footer action ---

export type PrimaryActionId = 'scratch' | 'template' | 'import' | 'aiOutline' | 'aiPost' | 'aiCreate';

const AI_PHASE_ACTION: Record<AiPhase, PrimaryActionId> = { idea: 'aiOutline', outline: 'aiPost', post: 'aiCreate' };

export function primaryActionId(state: BlogWizardState): PrimaryActionId | null {
  if (state.activeStep !== 1) return null;
  switch (state.method) {
    case 'scratch':
    case 'template':
      return state.method;
    case 'import':
      return state.importPhase === 'preview' ? 'import' : null;
    case 'ai':
      return AI_PHASE_ACTION[state.aiPhase];
    default:
      return null;
  }
}

interface BusyFlags {
  isCreating: boolean;
  isGenerating: boolean;
}

const PRIMARY_DISABLED: Record<PrimaryActionId, (s: BlogWizardState, f: BusyFlags) => boolean> = {
  scratch: (_s, f) => f.isCreating,
  template: (s, f) => !s.selectedTemplate || f.isCreating,
  import: (s, f) => f.isCreating || !s.importTitle.trim() || !s.importSlug.trim(),
  aiOutline: (s, f) => f.isGenerating || !s.aiIdea.trim(),
  aiPost: (s, f) => f.isGenerating || !s.aiTitle.trim() || s.aiOutline.length === 0,
  aiCreate: (s, f) => f.isCreating || !s.aiTitle.trim(),
};

export function isPrimaryActionDisabled(id: PrimaryActionId, state: BlogWizardState, flags: BusyFlags): boolean {
  return PRIMARY_DISABLED[id](state, flags);
}

// --- AI regeneration ---

const DRAFT_FIELD_FOR_KEY: Record<AiResultKey, AiDraftField> = {
  body: 'aiBody',
  excerpt: 'aiExcerpt',
  meta_title: 'aiMetaTitle',
  meta_description: 'aiMetaDescription',
};

/** The non-empty draft fields a regeneration of `field` should overwrite. */
export function regeneratedFields(field: RegenerateField, result: AiGenerateResponse): Partial<Record<AiDraftField, string>> {
  return Object.fromEntries(regeneratedValues(field, result).map(([key, value]) => [DRAFT_FIELD_FOR_KEY[key], value]));
}
