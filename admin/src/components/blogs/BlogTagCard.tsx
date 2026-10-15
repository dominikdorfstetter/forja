import { useMemo, useState } from 'react';
import {
  Card,
  CardContent,
  Typography,
  Divider,
  Chip,
  Box,
  Autocomplete,
  TextField,
  Button,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { assignTagToContent, getTags, removeTagFromContent } from '@/services/taxonomy';
import { useSiteContext } from '@/store/SiteContext';
import { useReadOnly } from '@/hooks/useReadOnly';
import type { Tag } from '@/types/api';
import { useTranslation } from 'react-i18next';
import { queryKeys } from '@/lib/queryKeys';
import BlogTagCreateDialog from './BlogTagCreateDialog';
import BlogTagSuggestDialog from './BlogTagSuggestDialog';
import { countWords } from './blogTagUtils';
import { useBlogTagSuggestions } from './useBlogTagSuggestions';

interface BlogTagCardProps {
  contentId: string;
  tags: Tag[];
  /** Plain blog body — used as the prompt context for AI tag suggestions. */
  blogBody: string;
  /** Whether the AI module is enabled for this site. When false the Suggest
   * button is hidden entirely (AI invariant: opt-in per site). */
  aiAvailable: boolean;
}

/** Minimum body length (whitespace-split word count) before the Suggest
 * button enables. Matches the backend `MIN_BLOG_TAGS_WORDS` gate so the user
 * never gets `AI_CONTEXT_INSUFFICIENT` after clicking. */
const MIN_BODY_WORDS_FOR_SUGGEST = 30;

export default function BlogTagCard({
  contentId,
  tags,
  blogBody,
  aiAvailable,
}: BlogTagCardProps) {
  const { t } = useTranslation();
  const { canWrite, gate } = useReadOnly();
  const { selectedSiteId } = useSiteContext();
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();

  const [createOpen, setCreateOpen] = useState(false);

  const bodyWordCount = useMemo(() => countWords(blogBody), [blogBody]);
  const bodyTooShort = bodyWordCount < MIN_BODY_WORDS_FOR_SUGGEST;

  const { data: siteTagsData } = useQuery({
    queryKey: queryKeys.tags(selectedSiteId),
    queryFn: () => getTags(selectedSiteId),
    enabled: !!selectedSiteId,
  });
  const siteTags = siteTagsData?.data ?? [];

  const assignedIds = new Set(tags.map((tag) => tag.id));
  const availableTags = siteTags.filter((tag) => !assignedIds.has(tag.id));

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: queryKeys.blogDetail(contentId) });
    queryClient.invalidateQueries({ queryKey: queryKeys.tags(selectedSiteId) });
  };

  const assignMutation = useMutation({
    mutationFn: (tagId: string) =>
      assignTagToContent(contentId, { tag_id: tagId }),
    onSuccess: () => {
      invalidate();
      enqueueSnackbar(t('blogDetail.tags.assigned'), { variant: 'success' });
    },
    onError: () =>
      enqueueSnackbar(t('blogDetail.tags.assignFailed'), { variant: 'error' }),
  });

  const removeMutation = useMutation({
    mutationFn: (tagId: string) => removeTagFromContent(contentId, tagId),
    onSuccess: () => {
      invalidate();
      enqueueSnackbar(t('blogDetail.tags.removed'), { variant: 'success' });
    },
    onError: () =>
      enqueueSnackbar(t('blogDetail.tags.removeFailed'), { variant: 'error' }),
  });

  const suggestions = useBlogTagSuggestions({
    contentId,
    siteId: selectedSiteId,
    blogBody,
    siteTags,
    assignedIds,
    onApplied: invalidate,
  });
  const { ai } = suggestions;
  const showSuggestButton = canWrite && aiAvailable && ai.isConfigured;

  const handleCreated = (created: Tag) => {
    assignMutation.mutate(created.id);
    setCreateOpen(false);
  };

  return (
    <>
      <Card sx={{ mb: 2 }} data-testid="blog-tag-card">
        <CardContent>
          <Typography variant="subtitle1" gutterBottom sx={{ fontWeight: 600 }}>
            {t('blogDetail.fields.tags')}
          </Typography>
          <Divider sx={{ mb: 1.5 }} />

          <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap', mb: 2 }}>
            {tags.length === 0 && (
              <Typography variant="body2" color="text.secondary" data-testid="blog-tag-card.empty">
                {t('blogDetail.tags.empty')}
              </Typography>
            )}
            {tags.map((tag) => (
              <Chip
                key={tag.id}
                label={tag.slug}
                size="small"
                onDelete={gate(() => removeMutation.mutate(tag.id))}
                data-testid={`blog-tag-card.chip.${tag.slug}`}
              />
            ))}
          </Box>

          {selectedSiteId && canWrite && (
            <Autocomplete
              options={availableTags}
              getOptionLabel={(opt) => opt.slug}
              size="small"
              onChange={(_, value) => {
                if (value) {
                  assignMutation.mutate(value.id);
                }
              }}
              value={null}
              renderInput={(params) => (
                <TextField
                  {...params}
                  label={t('common.actions.add')}
                  placeholder={t('common.actions.search')}
                  slotProps={{
                    htmlInput: {
                      'data-testid': 'blog-tag-card.autocomplete',
                    },
                  }}
                />
              )}
              sx={{ mb: 1 }}
            />
          )}

          <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
            {canWrite && (
              <Button
                size="small"
                startIcon={<AddIcon />}
                onClick={() => setCreateOpen(true)}
                data-testid="blog-tag-card.btn.create"
              >
                {t('forms.tag.createTitle')}
              </Button>
            )}
            {showSuggestButton && (
              <Button
                size="small"
                startIcon={<AutoAwesomeIcon />}
                onClick={suggestions.suggest}
                disabled={bodyTooShort || ai.isGenerating}
                data-testid="blog-tag-card.btn.suggest"
              >
                {ai.isGenerating
                  ? t('blogDetail.tags.suggesting')
                  : t('blogDetail.tags.suggestTags')}
              </Button>
            )}
          </Box>
        </CardContent>
      </Card>

      <BlogTagSuggestDialog suggestions={suggestions} siteTags={siteTags} />

      <BlogTagCreateDialog
        open={createOpen}
        siteId={selectedSiteId}
        onClose={() => setCreateOpen(false)}
        onCreated={handleCreated}
      />
    </>
  );
}
