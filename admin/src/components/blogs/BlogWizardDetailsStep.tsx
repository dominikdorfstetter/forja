import type { ContentTemplate } from '@/types/api';
import { markdownUploadBindings, templateBrowserBindings } from '@/components/shared/contentWizard/wizardSourceState';
import BlogWizardScratchStep from './BlogWizardScratchStep';
import BlogWizardTemplateStep from './BlogWizardTemplateStep';
import BlogWizardImportStep from './BlogWizardImportStep';
import BlogWizardAiStep from './BlogWizardAiStep';
import type { BlogWizardController } from './useCreateBlogWizard';

interface BlogWizardDetailsStepProps {
  wizard: BlogWizardController;
  siteTemplates: ContentTemplate[];
  siteTemplatesLoading: boolean;
}

/** Second wizard step: the detail form for the chosen creation method. */
export default function BlogWizardDetailsStep({ wizard, siteTemplates, siteTemplatesLoading }: BlogWizardDetailsStepProps) {
  const { state, dispatch, scratch, ai, isCreating, defaultLocaleName } = wizard;

  switch (state.method) {
    case 'scratch':
      return <BlogWizardScratchStep register={scratch.register} errors={scratch.errors} onSlugEdited={scratch.markSlugEdited} />;
    case 'template':
      return (
        <BlogWizardTemplateStep
          {...templateBrowserBindings(state, dispatch)}
          siteTemplates={siteTemplates}
          siteTemplatesLoading={siteTemplatesLoading}
        />
      );
    case 'import':
      return (
        <BlogWizardImportStep
          importPhase={state.importPhase}
          upload={markdownUploadBindings(state, dispatch, (parsed) => dispatch({ type: 'FILE_PARSED', parsed, title: parsed.title, excerpt: parsed.excerpt, slug: parsed.slug }))}
          parsed={state.parsed}
          importTitle={state.importTitle}
          importExcerpt={state.importExcerpt}
          importSlug={state.importSlug}
          onImportTitleChange={(v) => dispatch({ type: 'SET_IMPORT_TITLE', value: v })}
          onImportExcerptChange={(v) => dispatch({ type: 'SET_IMPORT_EXCERPT', value: v })}
          onImportSlugChange={(v) => dispatch({ type: 'SET_IMPORT_SLUG', value: v })}
        />
      );
    case 'ai':
      return (
        <BlogWizardAiStep
          aiPhase={state.aiPhase} aiIdea={state.aiIdea} aiTitle={state.aiTitle} aiSubtitle={state.aiSubtitle}
          aiOutline={state.aiOutline} aiBody={state.aiBody} aiExcerpt={state.aiExcerpt}
          aiMetaTitle={state.aiMetaTitle} aiMetaDescription={state.aiMetaDescription}
          aiError={state.aiError} isGenerating={ai.isGenerating} isCreating={isCreating}
          regeneratingField={ai.regeneratingField}
          onIdeaChange={(v) => dispatch({ type: 'SET_AI_IDEA', value: v })}
          onTitleChange={(v) => dispatch({ type: 'SET_AI_TITLE', value: v })}
          onSubtitleChange={(v) => dispatch({ type: 'SET_AI_SUBTITLE', value: v })}
          onOutlineChange={(v) => dispatch({ type: 'SET_AI_OUTLINE', value: v })}
          onBodyChange={(v) => dispatch({ type: 'SET_AI_BODY', value: v })}
          onExcerptChange={(v) => dispatch({ type: 'SET_AI_EXCERPT', value: v })}
          onMetaTitleChange={(v) => dispatch({ type: 'SET_AI_META_TITLE', value: v })}
          onMetaDescriptionChange={(v) => dispatch({ type: 'SET_AI_META_DESCRIPTION', value: v })}
          onErrorDismiss={() => dispatch({ type: 'SET_AI_ERROR', value: null })}
          onAddOutlineItem={ai.appendOutlineItem}
          onInsertOutlineItem={ai.insertOutlineItem}
          onRegenerateOutline={ai.generateOutline}
          onRegenerate={ai.regenerate}
          defaultLocaleName={defaultLocaleName}
        />
      );
    default:
      return null;
  }
}
