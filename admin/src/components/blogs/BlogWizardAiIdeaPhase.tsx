import { Alert, TextField, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';

interface BlogWizardAiIdeaPhaseProps {
  aiIdea: string;
  isGenerating: boolean;
  defaultLocaleName?: string;
  onIdeaChange: (value: string) => void;
}

export default function BlogWizardAiIdeaPhase({ aiIdea, isGenerating, defaultLocaleName, onIdeaChange }: BlogWizardAiIdeaPhaseProps) {
  const { t } = useTranslation();
  return (
    <>
      <Typography variant="subtitle1" sx={{ fontWeight: 600 }}>
        {t('quickPost.ai.ideaTitle')}
      </Typography>
      {defaultLocaleName && (
        <Alert severity="info" icon={false} data-testid="ai-language-notice">
          {t('quickPost.ai.languageNotice', { language: defaultLocaleName })}
        </Alert>
      )}
      <TextField
        placeholder={t('quickPost.ai.ideaPlaceholder')}
        fullWidth
        multiline
        minRows={3}
        maxRows={8}
        value={aiIdea}
        onChange={(e) => onIdeaChange(e.target.value)}
        disabled={isGenerating}
        autoFocus
      />
    </>
  );
}
