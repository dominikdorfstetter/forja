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
  FormControlLabel,
  Switch,
  Alert,
  CircularProgress,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import AutoAwesomeIcon from '@mui/icons-material/AutoAwesome';
import FormDialog from '@/components/shared/FormDialog';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { assignTagToContent, createTag, getTags, removeTagFromContent } from '@/services/taxonomy';
import { useSiteContext } from '@/store/SiteContext';
import { useReadOnly } from '@/hooks/useReadOnly';
import { useAiAssist } from '@/hooks/useAiAssist';
import type { Tag, CreateTagRequest } from '@/types/api';
import { useTranslation } from 'react-i18next';
import { queryKeys } from '@/lib/queryKeys';

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
/** UI-side cap on how many AI suggestions are rendered. Backend also caps. */
const MAX_RENDERED_SUGGESTIONS = 8;

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
  const [newSlug, setNewSlug] = useState('');
  const [newIsGlobal, setNewIsGlobal] = useState(false);

  // AI suggestion state
  const ai = useAiAssist();
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [suggested, setSuggested] = useState<string[]>([]);
  const [accepted, setAccepted] = useState<Set<string>>(new Set());
  const [truncated, setTruncated] = useState(false);

  const bodyWordCount = useMemo(
    () => (blogBody ? blogBody.split(/\s+/).filter(Boolean).length : 0),
    [blogBody],
  );
  const bodyTooShort = bodyWordCount < MIN_BODY_WORDS_FOR_SUGGEST;
  const showSuggestButton = aiAvailable && ai.isConfigured;

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

  const createMutation = useMutation({
    mutationFn: (data: CreateTagRequest) => createTag(data),
    onSuccess: (created) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.tags(selectedSiteId) });
      assignMutation.mutate(created.id);
      setCreateOpen(false);
      setNewSlug('');
      setNewIsGlobal(false);
    },
    onError: () =>
      enqueueSnackbar(t('blogDetail.tags.createFailed'), { variant: 'error' }),
  });

  const handleCreateAndAssign = () => {
    const slug = newSlug.trim();
    if (!slug) return;
    createMutation.mutate({
      slug,
      is_global: newIsGlobal,
      site_id: newIsGlobal ? undefined : selectedSiteId,
    });
  };

  const findExistingTagBySlug = (slug: string): Tag | undefined => {
    const lower = slug.toLowerCase();
    return siteTags.find((tag) => tag.slug.toLowerCase() === lower);
  };

  const handleSuggest = async () => {
    setSuggestOpen(true);
    setSuggested([]);
    setAccepted(new Set());
    setTruncated(false);
    try {
      const existingTagSlugs = siteTags.map((t) => t.slug);
      const result = await ai.generate('blog_tags', blogBody, {
        blogTagContext: { existing_tags: existingTagSlugs },
      });
      const all = result.tags ?? [];
      const visible = all.slice(0, MAX_RENDERED_SUGGESTIONS);
      setSuggested(visible);
      setTruncated(all.length > MAX_RENDERED_SUGGESTIONS);
    } catch {
      // Error surfaces via ai.generateError below — keep dialog open.
    }
  };

  const toggleAccept = (slug: string) => {
    setAccepted((prev) => {
      const next = new Set(prev);
      if (next.has(slug)) next.delete(slug);
      else next.add(slug);
      return next;
    });
  };

  const applySuggestions = async () => {
    for (const slug of accepted) {
      const existing = findExistingTagBySlug(slug);
      try {
        let tagId = existing?.id;
        if (!tagId) {
          const created = await createTag({
            slug,
            is_global: false,
            site_id: selectedSiteId,
          });
          tagId = created.id;
        }
        if (!assignedIds.has(tagId)) {
          await assignTagToContent(contentId, { tag_id: tagId });
        }
      } catch {
        enqueueSnackbar(t('blogDetail.tags.suggestApplyFailed', { slug }), {
          variant: 'error',
        });
      }
    }
    invalidate();
    enqueueSnackbar(t('blogDetail.tags.suggestApplied'), { variant: 'success' });
    setSuggestOpen(false);
    setSuggested([]);
    setAccepted(new Set());
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
            {canWrite && showSuggestButton && (
              <Button
                size="small"
                startIcon={<AutoAwesomeIcon />}
                onClick={handleSuggest}
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

      <FormDialog
        open={suggestOpen}
        onClose={() => setSuggestOpen(false)}
        onSubmit={applySuggestions}
        icon="auto_awesome"
        title={t('blogDetail.tags.suggestTitle')}
        subtitle={t('blogDetail.tags.suggestSubtitle')}
        submitLabel={t('blogDetail.tags.suggestApply', { count: accepted.size })}
        submitDisabled={accepted.size === 0 || ai.isGenerating}
        submitTestId="blog-tag-suggest.btn.apply"
        cancelTestId="blog-tag-suggest.btn.cancel"
        loading={ai.isGenerating}
        maxWidth="sm"
        data-testid="blog-tag-suggest.dialog"
      >
        {ai.isGenerating && (
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, py: 2 }}>
            <CircularProgress size={20} />
            <Typography variant="body2">{t('blogDetail.tags.suggesting')}</Typography>
          </Box>
        )}
        {ai.generateError && (
          <Alert severity="error" sx={{ mb: 2 }}>
            {ai.generateError.message}
          </Alert>
        )}
        {!ai.isGenerating && suggested.length === 0 && !ai.generateError && (
          <Typography variant="body2" color="text.secondary">
            {t('blogDetail.tags.suggestEmpty')}
          </Typography>
        )}
        {suggested.length > 0 && (
          <>
            <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
              {t('blogDetail.tags.suggestPickHint')}
            </Typography>
            <Box
              sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}
              data-testid="blog-tag-suggest.chips"
            >
              {suggested.map((slug) => {
                const isSelected = accepted.has(slug);
                const isExisting = !!findExistingTagBySlug(slug);
                return (
                  <Chip
                    key={slug}
                    label={isExisting ? slug : `+ ${slug}`}
                    size="small"
                    color={isSelected ? 'primary' : 'default'}
                    variant={isSelected ? 'filled' : 'outlined'}
                    onClick={() => toggleAccept(slug)}
                    data-testid={`blog-tag-suggest.chip.${slug}`}
                  />
                );
              })}
            </Box>
            {truncated && (
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: 'block', mt: 1 }}
              >
                {t('blogDetail.tags.suggestTruncated', { max: MAX_RENDERED_SUGGESTIONS })}
              </Typography>
            )}
          </>
        )}
      </FormDialog>

      <FormDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSubmit={handleCreateAndAssign}
        icon="sell"
        title={t('forms.tag.createTitle')}
        submitLabel={t('common.actions.create')}
        submitDisabled={!newSlug.trim()}
        submitTestId="blog-tag-create.btn.submit"
        cancelTestId="blog-tag-create.btn.cancel"
        loading={createMutation.isPending}
        maxWidth="xs"
        data-testid="blog-tag-create.dialog"
      >
        <TextField
          label={t('forms.tag.fields.slug')}
          fullWidth
          size="small"
          value={newSlug}
          onChange={(e) => setNewSlug(e.target.value)}
          helperText={t('forms.tag.fields.slugHelper')}
        />
        <FormControlLabel
          control={
            <Switch
              checked={newIsGlobal}
              onChange={(e) => setNewIsGlobal(e.target.checked)}
            />
          }
          label={t('forms.tag.fields.global')}
        />
      </FormDialog>
    </>
  );
}
