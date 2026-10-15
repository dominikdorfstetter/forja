import { useCallback, useRef, useState, type Dispatch, type RefObject } from 'react';
import { useTranslation } from 'react-i18next';
import type { AiGenerateResponse } from '@/types/api';
import { useAiAssist } from '@/hooks/useAiAssist';
import type { OutlineItem, RegenerateField } from './blogWizardAiFields';
import { draftPostContent, regenerateRequest, type AiDraftSource } from './aiDraftRequests';

/** Reducer actions every AI drafting host (blog wizard, quick post) handles with the same shape. */
export type AiDraftAction =
  | { type: 'SET_AI_ERROR'; value: string | null }
  | { type: 'OUTLINE_GENERATED'; title: string; subtitle: string; outline: OutlineItem[] }
  | { type: 'POST_GENERATED'; body: string; excerpt: string; metaTitle: string; metaDescription: string };

/**
 * Host-specific glue between the shared drafting flow and a host's reducer.
 * Declare it at module level so its identity is stable across renders.
 */
export interface AiDraftAdapter<S, A> {
  idea: (state: S) => string;
  draft: (state: S) => AiDraftSource;
  setOutline: (outline: OutlineItem[]) => A;
  regenerated: (field: RegenerateField, result: AiGenerateResponse) => A[];
}

/** Outline → post AI drafting, per-field regeneration, and outline item bookkeeping. */
export function useAiDraftFlow<S, A>(
  stateRef: RefObject<S>,
  dispatch: Dispatch<NoInfer<A> | AiDraftAction>,
  localeCode: string,
  adapter: AiDraftAdapter<S, A>,
) {
  const { t } = useTranslation();
  const { isConfigured, generate, isGenerating } = useAiAssist();
  const [regeneratingField, setRegeneratingField] = useState<RegenerateField | null>(null);
  const outlineIdCounter = useRef(0);

  /** Wrap outline strings as items with flow-unique ids. */
  const toOutline = useCallback(
    (values: string[]): OutlineItem[] => values.map((value) => ({ id: outlineIdCounter.current++, value })),
    [],
  );

  const generateOutline = useCallback(async () => {
    dispatch({ type: 'SET_AI_ERROR', value: null });
    try {
      const result = await generate('draft_outline', adapter.idea(stateRef.current), localeCode);
      dispatch({
        type: 'OUTLINE_GENERATED',
        title: result.title || '',
        subtitle: result.subtitle || '',
        outline: toOutline(result.outline || []),
      });
    } catch {
      dispatch({ type: 'SET_AI_ERROR', value: t('quickPost.ai.outlineError') });
    }
  }, [adapter, dispatch, generate, localeCode, stateRef, t, toOutline]);

  const generatePost = async () => {
    dispatch({ type: 'SET_AI_ERROR', value: null });
    try {
      const result = await generate('draft_post', draftPostContent(adapter.draft(stateRef.current)), localeCode);
      dispatch({ type: 'POST_GENERATED', body: result.body || '', excerpt: result.excerpt || '', metaTitle: result.meta_title || '', metaDescription: result.meta_description || '' });
    } catch {
      dispatch({ type: 'SET_AI_ERROR', value: t('quickPost.ai.postError') });
    }
  };

  const regenerate = useCallback(async (field: RegenerateField) => {
    const { action, content } = regenerateRequest(field, adapter.draft(stateRef.current));
    dispatch({ type: 'SET_AI_ERROR', value: null });
    setRegeneratingField(field);
    try {
      const result = await generate(action, content, localeCode);
      adapter.regenerated(field, result).forEach(dispatch);
    } catch {
      dispatch({ type: 'SET_AI_ERROR', value: t('quickPost.ai.regenerateError', 'Regeneration failed. Please try again.') });
    } finally {
      setRegeneratingField(null);
    }
  }, [adapter, dispatch, generate, localeCode, stateRef, t]);

  const insertOutlineItem = useCallback((afterIndex: number) => {
    const updated = [...adapter.draft(stateRef.current).outline];
    updated.splice(afterIndex + 1, 0, ...toOutline(['']));
    dispatch(adapter.setOutline(updated));
  }, [adapter, dispatch, stateRef, toOutline]);

  const appendOutlineItem = () => {
    dispatch(adapter.setOutline([...adapter.draft(stateRef.current).outline, ...toOutline([''])]));
  };

  const reset = useCallback(() => {
    outlineIdCounter.current = 0;
    setRegeneratingField(null);
  }, []);

  return {
    aiAvailable: isConfigured,
    isGenerating,
    regeneratingField,
    generateOutline,
    generatePost,
    regenerate,
    insertOutlineItem,
    appendOutlineItem,
    reset,
  };
}
