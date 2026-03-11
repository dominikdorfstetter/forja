import {
  Alert,
  Box,
  Button,
  Chip,
  IconButton,
  LinearProgress,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import { useTranslation } from 'react-i18next';

type AiPhase = 'idea' | 'outline' | 'post';
type OutlineItem = { id: number; value: string };

interface BlogWizardAiStepProps {
  aiPhase: AiPhase;
  aiIdea: string;
  aiTitle: string;
  aiSubtitle: string;
  aiOutline: OutlineItem[];
  aiBody: string;
  aiExcerpt: string;
  aiError: string | null;
  isGenerating: boolean;
  isCreating: boolean;
  onIdeaChange: (value: string) => void;
  onTitleChange: (value: string) => void;
  onSubtitleChange: (value: string) => void;
  onOutlineChange: (value: OutlineItem[]) => void;
  onBodyChange: (value: string) => void;
  onExcerptChange: (value: string) => void;
  onErrorDismiss: () => void;
  onAddOutlineItem: () => void;
}

export default function BlogWizardAiStep({
  aiPhase,
  aiIdea,
  aiTitle,
  aiSubtitle,
  aiOutline,
  aiBody,
  aiExcerpt,
  aiError,
  isGenerating,
  isCreating,
  onIdeaChange,
  onTitleChange,
  onSubtitleChange,
  onOutlineChange,
  onBodyChange,
  onExcerptChange,
  onErrorDismiss,
  onAddOutlineItem,
}: BlogWizardAiStepProps) {
  const { t } = useTranslation();

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {isGenerating && <LinearProgress />}
      {aiError && (
        <Alert severity="error" onClose={onErrorDismiss}>
          {aiError}
        </Alert>
      )}

      {/* AI Phase 1: Idea */}
      {aiPhase === 'idea' && (
        <>
          <Typography variant="subtitle1" fontWeight={600}>
            {t('quickPost.ai.ideaTitle')}
          </Typography>
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
      )}

      {/* AI Phase 2: Outline Review */}
      {aiPhase === 'outline' && (
        <>
          <TextField
            label={t('quickPost.ai.titleLabel')}
            fullWidth
            value={aiTitle}
            onChange={(e) => onTitleChange(e.target.value)}
            disabled={isGenerating}
          />
          <TextField
            label={t('quickPost.ai.subtitleLabel')}
            fullWidth
            value={aiSubtitle}
            onChange={(e) => onSubtitleChange(e.target.value)}
            disabled={isGenerating}
          />
          <Box>
            <Typography variant="subtitle2" sx={{ mb: 1 }}>
              {t('quickPost.ai.outlineLabel')}
            </Typography>
            <Stack spacing={1}>
              {aiOutline.map((item, index) => (
                <Stack key={item.id} direction="row" spacing={1} alignItems="center">
                  <Chip label={index + 1} size="small" variant="outlined" />
                  <TextField
                    fullWidth
                    size="small"
                    value={item.value}
                    onChange={(e) => onOutlineChange(aiOutline.map((v) => (v.id === item.id ? { ...v, value: e.target.value } : v)))}
                    disabled={isGenerating}
                  />
                  <Tooltip title={t('common.actions.delete')} arrow>
                    <IconButton
                      size="small"
                      onClick={() => onOutlineChange(aiOutline.filter((v) => v.id !== item.id))}
                      disabled={isGenerating}
                      aria-label={t('common.actions.delete')}
                    >
                      <DeleteIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Stack>
              ))}
              <Button size="small" onClick={onAddOutlineItem} disabled={isGenerating}>
                {t('quickPost.ai.addPoint')}
              </Button>
            </Stack>
          </Box>
        </>
      )}

      {/* AI Phase 3: Post Preview */}
      {aiPhase === 'post' && (
        <>
          <TextField
            label={t('quickPost.ai.titleLabel')}
            fullWidth
            value={aiTitle}
            onChange={(e) => onTitleChange(e.target.value)}
            disabled={isCreating}
          />
          <TextField
            label={t('blogDetail.fields.body')}
            fullWidth
            multiline
            minRows={6}
            maxRows={12}
            value={aiBody}
            onChange={(e) => onBodyChange(e.target.value)}
            disabled={isCreating}
            InputProps={{ sx: { fontFamily: 'monospace', fontSize: '0.875rem' } }}
          />
          <TextField
            label={t('blogDetail.fields.excerpt')}
            fullWidth
            multiline
            rows={2}
            value={aiExcerpt}
            onChange={(e) => onExcerptChange(e.target.value)}
            disabled={isCreating}
          />
        </>
      )}
    </Box>
  );
}
