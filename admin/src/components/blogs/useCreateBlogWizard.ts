import { useEffect, useReducer, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { useAuth } from '@/store/AuthContext';
import type { ContentTemplate, SiteLocaleResponse } from '@/types/api';
import { buildMergedTemplates } from './BlogWizardTemplateStep';
import { useBlogWizardMutations } from './useBlogWizardMutations';
import { useBlogScratchForm } from './useBlogScratchForm';
import { useBlogWizardAi } from './useBlogWizardAi';
import { blogWizardReducer, initialBlogWizardState } from './blogWizardState';
import {
  canManageTemplates,
  isPrimaryActionDisabled,
  primaryActionId,
  wizardDialogWidth,
  type PrimaryActionId,
} from './blogWizardFlow';
import { defaultLocaleInfo } from './aiDraftRequests';

export interface BlogWizardPrimaryAction {
  id: PrimaryActionId;
  disabled: boolean;
  onClick: () => void;
}

interface UseCreateBlogWizardOptions {
  open: boolean;
  onClose: () => void;
  onCreated: (blogId: string) => void;
  siteLocales: SiteLocaleResponse[] | undefined;
  siteTemplates: ContentTemplate[];
}

/** State, AI/form/mutation wiring and footer action resolution for CreateBlogWizard. */
export function useCreateBlogWizard({ open, onClose, onCreated, siteLocales, siteTemplates }: UseCreateBlogWizardOptions) {
  const { t } = useTranslation();
  const { userFullName, isAdmin } = useAuth();

  const [state, dispatch] = useReducer(blogWizardReducer, initialBlogWizardState);
  const stateRef = useRef(state);
  useEffect(() => {
    stateRef.current = state;
  });

  const locale = defaultLocaleInfo(siteLocales);
  const scratch = useBlogScratchForm(userFullName);
  const ai = useBlogWizardAi({ stateRef, dispatch, localeCode: locale.code });
  const { scratchMutation, templateMutation, importMutation, aiMutation, isCreating } =
    useBlogWizardMutations({
      siteLocales,
      onClose,
      onCreated,
      getAiState: () => stateRef.current,
    });

  // Reset when dialog opens
  const { resetScratch } = scratch;
  const { reset: resetAi } = ai;
  const prevOpenRef = useRef(false);
  useEffect(() => {
    if (open && !prevOpenRef.current) {
      dispatch({ type: 'RESET' });
      resetAi();
      resetScratch();
    }
    prevOpenRef.current = open;
  }, [open, resetAi, resetScratch]);

  const confirmTemplate = () => {
    const tpl = buildMergedTemplates(t, siteTemplates).find((mt) => mt.id === state.selectedTemplate);
    if (!tpl) return;
    if (tpl.source === 'builtin' && tpl.builtin) templateMutation.mutate({ template: tpl.builtin, source: 'builtin' });
    else if (tpl.source === 'custom' && tpl.custom) templateMutation.mutate({ template: tpl.custom, source: 'custom' });
  };

  const confirmImport = () => {
    if (!state.parsed) return;
    importMutation.mutate({ ...state.parsed, title: state.importTitle, excerpt: state.importExcerpt, slug: state.importSlug, meta_title: state.importTitle.slice(0, 200) });
  };

  const primaryHandlers: Record<PrimaryActionId, () => void> = {
    scratch: scratch.handleSubmit((data) => scratchMutation.mutate(data)),
    template: confirmTemplate,
    import: confirmImport,
    aiOutline: ai.generateOutline,
    aiPost: ai.generatePost,
    aiCreate: () => aiMutation.mutate(),
  };

  const primaryId = primaryActionId(state);
  const primary: BlogWizardPrimaryAction | null = primaryId
    ? {
        id: primaryId,
        disabled: isPrimaryActionDisabled(primaryId, state, { isCreating, isGenerating: ai.isGenerating }),
        onClick: primaryHandlers[primaryId],
      }
    : null;

  return {
    state,
    dispatch,
    scratch,
    ai,
    isCreating,
    defaultLocaleName: locale.name,
    dialogWidth: wizardDialogWidth(state, ai.aiAvailable),
    showManageTemplates: canManageTemplates(state, isAdmin),
    primary,
    back: () => dispatch({ type: 'BACK' }),
  };
}

export type BlogWizardController = ReturnType<typeof useCreateBlogWizard>;
