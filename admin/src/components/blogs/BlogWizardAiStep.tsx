import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  IconButton,
  LinearProgress,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import DeleteIcon from '@mui/icons-material/Delete';
import RefreshIcon from '@mui/icons-material/Refresh';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import { useTranslation } from 'react-i18next';

type AiPhase = 'idea' | 'outline' | 'post';
type OutlineItem = { id: number; value: string };
export type RegenerateField = 'body' | 'excerpt' | 'seo' | 'all';

/** Field max lengths aligned with backend validation */
const MAX = {
  title: 500,
  subtitle: 500,
  excerpt: 300,
  body: 200_000,
  metaTitle: 60,
  metaDescription: 160,
} as const;

function charCounter(value: string, max: number) {
  const len = value.length;
  const ratio = len / max;
  return {
    text: `${len} / ${max}`,
    color: ratio > 0.9 ? 'error.main' : 'text.secondary',
  };
}

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
  onRegenerate: (field: RegenerateField) => void;
}

export default function BlogWizardAiStep({
  aiPhase,
  aiIdea,
  aiTitle,
  aiSubtitle,
  aiOutline,
  aiBody,
  aiExcerpt,
  aiMetaTitle,
  aiMetaDescription,
  aiError,
  isGenerating,
  isCreating,
  regeneratingField,
  onIdeaChange,
  onTitleChange,
  onSubtitleChange,
  onOutlineChange,
  onBodyChange,
  onExcerptChange,
  onMetaTitleChange,
  onMetaDescriptionChange,
  onErrorDismiss,
  onAddOutlineItem,
  onRegenerate,
}: BlogWizardAiStepProps) {
  const { t } = useTranslation();
  const busy = isCreating || isGenerating || !!regeneratingField;

  const regenButton = (field: RegenerateField, loading: boolean) => (
    <Tooltip title={t('quickPost.ai.regenerate', 'Regenerate')} arrow>
      <span>
        <IconButton
          size="small"
          onClick={() => onRegenerate(field)}
          disabled={busy}
          aria-label={t('quickPost.ai.regenerate', 'Regenerate')}
        >
          {loading ? <CircularProgress size={16} /> : <RefreshIcon fontSize="small" />}
        </IconButton>
      </span>
    </Tooltip>
  );

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
      {(isGenerating || regeneratingField === 'all') && <LinearProgress />}
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
            slotProps={{ htmlInput: { maxLength: MAX.title } }}
            helperText={<Typography variant="caption" sx={{ color: charCounter(aiTitle, MAX.title).color }}>{charCounter(aiTitle, MAX.title).text}</Typography>}
          />
          <TextField
            label={t('quickPost.ai.subtitleLabel')}
            fullWidth
            value={aiSubtitle}
            onChange={(e) => onSubtitleChange(e.target.value)}
            disabled={isGenerating}
            slotProps={{ htmlInput: { maxLength: MAX.subtitle } }}
            helperText={<Typography variant="caption" sx={{ color: charCounter(aiSubtitle, MAX.subtitle).color }}>{charCounter(aiSubtitle, MAX.subtitle).text}</Typography>}
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
                    multiline
                    maxRows={4}
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
            disabled={busy}
            slotProps={{ htmlInput: { maxLength: MAX.title } }}
            helperText={<Typography variant="caption" sx={{ color: charCounter(aiTitle, MAX.title).color }}>{charCounter(aiTitle, MAX.title).text}</Typography>}
          />

          <Box>
            <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mb: 0.5 }}>
              <Typography variant="caption" color="text.secondary">{t('blogDetail.fields.body')}</Typography>
              {regenButton('body', regeneratingField === 'body')}
            </Stack>
            <TextField
              fullWidth
              multiline
              minRows={6}
              maxRows={12}
              value={aiBody}
              onChange={(e) => onBodyChange(e.target.value)}
              disabled={busy && regeneratingField !== 'seo' && regeneratingField !== 'excerpt'}
              slotProps={{
                htmlInput: { maxLength: MAX.body },
                input: { sx: { fontFamily: 'monospace', fontSize: '0.875rem' } },
              }}
              helperText={<Typography variant="caption" sx={{ color: charCounter(aiBody, MAX.body).color }}>{charCounter(aiBody, MAX.body).text}</Typography>}
            />
          </Box>

          <Box>
            <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mb: 0.5 }}>
              <Typography variant="caption" color="text.secondary">{t('blogDetail.fields.excerpt')}</Typography>
              {regenButton('excerpt', regeneratingField === 'excerpt')}
            </Stack>
            <TextField
              fullWidth
              multiline
              rows={2}
              value={aiExcerpt}
              onChange={(e) => onExcerptChange(e.target.value)}
              disabled={busy && regeneratingField !== 'body' && regeneratingField !== 'seo'}
              slotProps={{ htmlInput: { maxLength: MAX.excerpt } }}
              helperText={<Typography variant="caption" sx={{ color: charCounter(aiExcerpt, MAX.excerpt).color }}>{charCounter(aiExcerpt, MAX.excerpt).text}</Typography>}
            />
          </Box>

          <Box>
            <Stack direction="row" alignItems="center" spacing={0.5} sx={{ mb: 0.5 }}>
              <Typography variant="caption" color="text.secondary">{t('blogDetail.fields.seo', 'SEO')}</Typography>
              {regenButton('seo', regeneratingField === 'seo')}
            </Stack>
            <Stack spacing={2}>
              <TextField
                label={t('blogDetail.fields.metaTitle')}
                fullWidth
                value={aiMetaTitle}
                onChange={(e) => onMetaTitleChange(e.target.value)}
                disabled={busy && regeneratingField !== 'body' && regeneratingField !== 'excerpt'}
                slotProps={{ htmlInput: { maxLength: MAX.metaTitle } }}
                helperText={<Typography variant="caption" sx={{ color: charCounter(aiMetaTitle, MAX.metaTitle).color }}>{charCounter(aiMetaTitle, MAX.metaTitle).text}</Typography>}
              />
              <TextField
                label={t('blogDetail.fields.metaDescription')}
                fullWidth
                multiline
                rows={2}
                value={aiMetaDescription}
                onChange={(e) => onMetaDescriptionChange(e.target.value)}
                disabled={busy && regeneratingField !== 'body' && regeneratingField !== 'excerpt'}
                slotProps={{ htmlInput: { maxLength: MAX.metaDescription } }}
                helperText={<Typography variant="caption" sx={{ color: charCounter(aiMetaDescription, MAX.metaDescription).color }}>{charCounter(aiMetaDescription, MAX.metaDescription).text}</Typography>}
              />
            </Stack>
          </Box>

          <Button
            variant="outlined"
            size="small"
            startIcon={regeneratingField === 'all' ? <CircularProgress size={16} /> : <AutoAwesomeIcon />}
            onClick={() => onRegenerate('all')}
            disabled={busy}
          >
            {t('quickPost.ai.regenerateAll', 'Regenerate All')}
          </Button>
        </>
      )}
    </Box>
  );
}
