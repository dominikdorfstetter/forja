import { Box, Button, Chip, CircularProgress, IconButton, Stack, TextField, Tooltip, Typography } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/Delete';
import RefreshIcon from '@mui/icons-material/Refresh';
import { useTranslation } from 'react-i18next';
import { MAX, type OutlineItem } from './blogWizardAiFields';
import { CharCountHelper } from './BlogWizardAiControls';

interface BlogWizardAiOutlinePhaseProps {
  aiTitle: string;
  aiSubtitle: string;
  aiOutline: OutlineItem[];
  isGenerating: boolean;
  onTitleChange: (value: string) => void;
  onSubtitleChange: (value: string) => void;
  onOutlineChange: (value: OutlineItem[]) => void;
  onAddOutlineItem: () => void;
  onInsertOutlineItem: (afterIndex: number) => void;
  onRegenerateOutline: () => void;
}

export default function BlogWizardAiOutlinePhase({
  aiTitle,
  aiSubtitle,
  aiOutline,
  isGenerating,
  onTitleChange,
  onSubtitleChange,
  onOutlineChange,
  onAddOutlineItem,
  onInsertOutlineItem,
  onRegenerateOutline,
}: BlogWizardAiOutlinePhaseProps) {
  const { t } = useTranslation();
  return (
    <>
      <TextField
        label={t('quickPost.ai.titleLabel')}
        fullWidth
        value={aiTitle}
        onChange={(e) => onTitleChange(e.target.value)}
        disabled={isGenerating}
        slotProps={{ htmlInput: { maxLength: MAX.title } }}
        helperText={<CharCountHelper value={aiTitle} max={MAX.title} />}
      />
      <TextField
        label={t('quickPost.ai.subtitleLabel')}
        fullWidth
        value={aiSubtitle}
        onChange={(e) => onSubtitleChange(e.target.value)}
        disabled={isGenerating}
        slotProps={{ htmlInput: { maxLength: MAX.subtitle } }}
        helperText={<CharCountHelper value={aiSubtitle} max={MAX.subtitle} />}
      />
      <Box>
        <Typography variant="subtitle2" sx={{ mb: 1 }}>
          {t('quickPost.ai.outlineLabel')}
        </Typography>
        <Stack spacing={1}>
          {aiOutline.map((item, index) => (
            <Stack key={item.id} direction="row" spacing={1} sx={{ alignItems: "center" }}>
              <Chip label={index + 1} size="small" variant="outlined" />
              <TextField
                fullWidth
                size="small"
                multiline
                maxRows={4}
                value={item.value}
                onChange={(e) => onOutlineChange(aiOutline.map((v) => (v.id === item.id ? { ...v, value: e.target.value } : v)))}
                disabled={isGenerating}
              />
              <Tooltip title={t('quickPost.ai.insertPoint', 'Insert point below')} arrow>
                <IconButton
                  size="small"
                  onClick={() => onInsertOutlineItem(index)}
                  disabled={isGenerating}
                  aria-label={t('quickPost.ai.insertPoint', 'Insert point below')}
                  data-testid={`outline-insert-${index}`}
                >
                  <AddIcon fontSize="small" />
                </IconButton>
              </Tooltip>
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
          <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
            <Button size="small" onClick={onAddOutlineItem} disabled={isGenerating}>
              {t('quickPost.ai.addPoint')}
            </Button>
            <Button
              size="small"
              startIcon={isGenerating ? <CircularProgress size={16} /> : <RefreshIcon />}
              onClick={onRegenerateOutline}
              disabled={isGenerating}
              data-testid="regenerate-outline-btn"
            >
              {t('quickPost.ai.regenerateOutlineBtn', 'Regenerate Outline')}
            </Button>
          </Stack>
        </Stack>
      </Box>
    </>
  );
}
