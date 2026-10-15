import type { Dispatch, RefObject } from 'react';
import type { BlogWizardAction, BlogWizardState } from './blogWizardState';
import { regeneratedFields } from './blogWizardFlow';
import { useAiDraftFlow, type AiDraftAdapter } from './useAiDraftFlow';

interface UseBlogWizardAiOptions {
  stateRef: RefObject<BlogWizardState>;
  dispatch: Dispatch<BlogWizardAction>;
  localeCode: string;
}

const BLOG_WIZARD_AI: AiDraftAdapter<BlogWizardState, BlogWizardAction> = {
  idea: (state) => state.aiIdea,
  draft: (state) => ({ title: state.aiTitle, subtitle: state.aiSubtitle, outline: state.aiOutline, body: state.aiBody }),
  setOutline: (value) => ({ type: 'SET_AI_OUTLINE', value }),
  regenerated: (field, result) => [{ type: 'AI_FIELDS_REGENERATED', fields: regeneratedFields(field, result) }],
};

/** AI-assist handlers for the blog wizard: outline → post generation, per-section regeneration, outline editing. */
export function useBlogWizardAi({ stateRef, dispatch, localeCode }: UseBlogWizardAiOptions) {
  return useAiDraftFlow(stateRef, dispatch, localeCode, BLOG_WIZARD_AI);
}
