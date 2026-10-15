import type { Dispatch } from 'react';
import { Button, Stack, Tooltip } from '@mui/material';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import RefreshIcon from '@mui/icons-material/Refresh';
import { useTranslation } from 'react-i18next';
import BlogWizardAiOutlinePhase from './BlogWizardAiOutlinePhase';
import type { QuickPostAction, QuickPostState } from './quickPostState';
import type { QuickPostAi } from './useQuickPostAi';

interface QuickPostOutlineStepProps {
  state: QuickPostState;
  dispatch: Dispatch<QuickPostAction>;
  ai: QuickPostAi;
}

/** AI step 2: edit the generated title/subtitle/outline, then draft the post. */
export default function QuickPostOutlineStep({ state, dispatch, ai }: QuickPostOutlineStepProps) {
  const { t } = useTranslation();
  const { isGenerating } = ai;
  const canGeneratePost = !!state.title.trim() && state.outline.length > 0;

  return (
    <>
      <BlogWizardAiOutlinePhase
        aiTitle={state.title}
        aiSubtitle={state.subtitle}
        aiOutline={state.outline}
        isGenerating={isGenerating}
        onTitleChange={(value) => dispatch({ type: 'SET_TITLE', value })}
        onSubtitleChange={(value) => dispatch({ type: 'SET_SUBTITLE', value })}
        onOutlineChange={(value) => dispatch({ type: 'SET_OUTLINE', value })}
        onAddOutlineItem={ai.appendOutlineItem}
        onInsertOutlineItem={ai.insertOutlineItem}
        onRegenerateOutline={ai.generateOutline}
      />
      <Stack direction="row" spacing={1} sx={{ justifyContent: "flex-end" }}>
        <Tooltip title={t('quickPost.ai.regenerateOutline')} arrow>
          <Button startIcon={<RefreshIcon />} onClick={() => dispatch({ type: 'REGENERATE_OUTLINE' })} disabled={isGenerating} aria-label={t('quickPost.ai.regenerateOutline')}>{t('quickPost.ai.startOver')}</Button>
        </Tooltip>
        <Button variant="contained" startIcon={<AutoAwesomeIcon />} onClick={ai.generatePost} disabled={isGenerating || !canGeneratePost}>
          {isGenerating ? t('quickPost.ai.generating') : t('quickPost.ai.generatePost')}
        </Button>
      </Stack>
    </>
  );
}
