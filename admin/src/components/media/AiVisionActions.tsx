import { Box, Button, CircularProgress, Stack, Typography } from '@mui/material';
import AutoFixHighIcon from '@mui/icons-material/AutoFixHigh';
import LabelIcon from '@mui/icons-material/Label';
import { useMutation } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { useTranslation } from 'react-i18next';
import { generateAiContent } from '@/services/ai';
interface AiVisionActionsProps {
  siteId: string;
  imageUrl: string;
  currentTags?: string[];
  onAltTextGenerated: (altText: string) => void;
  onTagsGenerated: (tags: string[]) => void;
  onAddSuggestedTag?: (tag: string) => void;
  disabled?: boolean;
}

export default function AiVisionActions({
  siteId,
  imageUrl,
  onTagsGenerated,
  disabled = false,
}: AiVisionActionsProps) {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();

  const tagsMutation = useMutation({
    mutationFn: () =>
      generateAiContent(siteId, {
        action: 'auto_tag',
        content: '',
        image_url: imageUrl,
      }),
    onSuccess: (result) => {
      if (result.tags) {
        onTagsGenerated(result.tags);
        enqueueSnackbar(t('media.ai.tagsGenerated', 'Tags generated'), { variant: 'success' });
      }
    },
    onError: () => {
      enqueueSnackbar(t('media.ai.generationFailed', 'AI generation failed'), { variant: 'error' });
    },
  });

  return (
    <Box data-testid="media-ai-vision-actions">
      <Typography variant="subtitle2" sx={{ mb: 1, display: 'flex', alignItems: 'center', gap: 0.5 }}>
        <AutoFixHighIcon fontSize="small" color="primary" />
        {t('media.ai.title', 'AI Vision')}
      </Typography>

      <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
        <Button
          size="small"
          variant="outlined"
          startIcon={tagsMutation.isPending ? <CircularProgress size={14} /> : <LabelIcon />}
          onClick={() => tagsMutation.mutate()}
          disabled={disabled || tagsMutation.isPending}
          data-testid="media-ai-generate-tags"
        >
          {t('media.ai.suggestTags', 'Suggest Tags')}
        </Button>
      </Stack>

    </Box>
  );
}
