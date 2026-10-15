import { Alert, Box, LinearProgress } from '@mui/material';
import { isAiSectionLocked, type AiPhase, type OutlineItem, type RegenerateField } from './blogWizardAiFields';
import { AiMarkdownBodyField } from './BlogWizardAiControls';
import BlogWizardAiIdeaPhase from './BlogWizardAiIdeaPhase';
import BlogWizardAiOutlinePhase from './BlogWizardAiOutlinePhase';
import BlogWizardAiPostPhase from './BlogWizardAiPostPhase';

export type { RegenerateField } from './blogWizardAiFields';

interface BlogWizardAiStepProps {
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
  isGenerating: boolean;
  isCreating: boolean;
  regeneratingField: RegenerateField | null;
  onIdeaChange: (value: string) => void;
  onTitleChange: (value: string) => void;
  onSubtitleChange: (value: string) => void;
  onOutlineChange: (value: OutlineItem[]) => void;
  onBodyChange: (value: string) => void;
  onExcerptChange: (value: string) => void;
  onMetaTitleChange: (value: string) => void;
  onMetaDescriptionChange: (value: string) => void;
  onErrorDismiss: () => void;
  onAddOutlineItem: () => void;
  onInsertOutlineItem: (afterIndex: number) => void;
  onRegenerateOutline: () => void;
  onRegenerate: (field: RegenerateField) => void;
  defaultLocaleName?: string;
}

export default function BlogWizardAiStep({
  aiPhase,
  aiIdea,
  aiError,
  isGenerating,
  isCreating,
  regeneratingField,
  onIdeaChange,
  onErrorDismiss,
  defaultLocaleName,
  ...phaseProps
}: BlogWizardAiStepProps) {
  const busy = isCreating || isGenerating || !!regeneratingField;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {(isGenerating || regeneratingField === 'all') && <LinearProgress />}
      {aiError && (
        <Alert severity="error" onClose={onErrorDismiss}>
          {aiError}
        </Alert>
      )}

      {aiPhase === 'idea' && (
        <BlogWizardAiIdeaPhase aiIdea={aiIdea} isGenerating={isGenerating} defaultLocaleName={defaultLocaleName} onIdeaChange={onIdeaChange} />
      )}
      {aiPhase === 'outline' && <BlogWizardAiOutlinePhase isGenerating={isGenerating} {...phaseProps} />}
      {aiPhase === 'post' && (
        <BlogWizardAiPostPhase
          busy={busy}
          regeneratingField={regeneratingField}
          {...phaseProps}
          body={<AiMarkdownBodyField value={phaseProps.aiBody} onChange={phaseProps.onBodyChange} disabled={isAiSectionLocked('body', busy, regeneratingField)} />}
        />
      )}
    </Box>
  );
}
