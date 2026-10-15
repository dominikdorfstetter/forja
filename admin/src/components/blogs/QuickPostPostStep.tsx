import type { Dispatch } from 'react';
import { useTranslation } from 'react-i18next';
import { ForjaEditor } from '@/components/editor';
import BlogWizardAiPostPhase from './BlogWizardAiPostPhase';
import type { QuickPostAction, QuickPostState } from './quickPostState';
import type { QuickPostAi } from './useQuickPostAi';

interface QuickPostPostStepProps {
  state: QuickPostState;
  dispatch: Dispatch<QuickPostAction>;
  ai: QuickPostAi;
  busy: boolean;
  siteId: string;
}

/** AI step 3: review/edit the drafted post with per-field regeneration (rich body editor). */
export default function QuickPostPostStep({ state, dispatch, ai, busy, siteId }: QuickPostPostStepProps) {
  const { t } = useTranslation();

  return (
    <BlogWizardAiPostPhase
      aiTitle={state.title}
      aiExcerpt={state.excerpt}
      aiMetaTitle={state.metaTitle}
      aiMetaDescription={state.metaDescription}
      busy={busy}
      regeneratingField={ai.regeneratingField}
      onTitleChange={(value) => dispatch({ type: 'SET_TITLE', value })}
      onExcerptChange={(value) => dispatch({ type: 'SET_EXCERPT', value })}
      onMetaTitleChange={(value) => dispatch({ type: 'SET_META_TITLE', value })}
      onMetaDescriptionChange={(value) => dispatch({ type: 'SET_META_DESCRIPTION', value })}
      onRegenerate={ai.regenerate}
      body={<ForjaEditor value={state.body} onChange={(value) => dispatch({ type: 'SET_BODY', value })} height={300} placeholder={t('quickPost.bodyPlaceholder')} siteId={siteId} />}
    />
  );
}
