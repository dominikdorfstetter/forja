import type { Dispatch } from 'react';
import { Button } from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import { useTranslation } from 'react-i18next';
import BlogWizardAiIdeaPhase from './BlogWizardAiIdeaPhase';
import type { QuickPostAction } from './quickPostState';
import type { QuickPostAi } from './useQuickPostAi';

interface QuickPostIdeaStepProps {
  idea: string;
  dispatch: Dispatch<QuickPostAction>;
  ai: QuickPostAi;
}

/** AI step 1: describe the post idea and generate an outline. */
export default function QuickPostIdeaStep({ idea, dispatch, ai }: QuickPostIdeaStepProps) {
  const { t } = useTranslation();
  const { isGenerating, defaultLocaleName } = ai;

  return (
    <>
      <BlogWizardAiIdeaPhase aiIdea={idea} isGenerating={isGenerating} defaultLocaleName={defaultLocaleName} onIdeaChange={(value) => dispatch({ type: 'SET_IDEA', value })} />
      <Button variant="contained" startIcon={<AutoAwesomeIcon />} onClick={ai.generateOutline} disabled={isGenerating || !idea.trim()}>
        {isGenerating ? t('quickPost.ai.generating') : t('quickPost.ai.generateOutline')}
      </Button>
    </>
  );
}
