import { Alert, Box, Chip, CircularProgress, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import FormDialog from '@/components/shared/FormDialog';
import type { Tag } from '@/types/api';
import { findTagBySlug } from './blogTagUtils';
import { MAX_RENDERED_SUGGESTIONS, type BlogTagSuggestions } from './useBlogTagSuggestions';

interface BlogTagSuggestDialogProps {
  suggestions: BlogTagSuggestions;
  siteTags: Tag[];
}

interface SuggestionChipsProps {
  suggested: string[];
  accepted: Set<string>;
  truncated: boolean;
  siteTags: Tag[];
  onToggle: (slug: string) => void;
}

function SuggestionChips({ suggested, accepted, truncated, siteTags, onToggle }: SuggestionChipsProps) {
  const { t } = useTranslation();
  return (
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
          const isExisting = !!findTagBySlug(siteTags, slug);
          return (
            <Chip
              key={slug}
              label={isExisting ? slug : `+ ${slug}`}
              size="small"
              color={isSelected ? 'primary' : 'default'}
              variant={isSelected ? 'filled' : 'outlined'}
              onClick={() => onToggle(slug)}
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
  );
}

/** Dialog listing AI tag suggestions; the user toggles chips and applies. */
export default function BlogTagSuggestDialog({ suggestions, siteTags }: BlogTagSuggestDialogProps) {
  const { t } = useTranslation();
  const { ai, open, close, suggested, accepted, truncated, toggleAccept, apply } = suggestions;
  const isEmpty = !ai.isGenerating && suggested.length === 0 && !ai.generateError;

  return (
    <FormDialog
      open={open}
      onClose={close}
      onSubmit={apply}
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
      {isEmpty && (
        <Typography variant="body2" color="text.secondary">
          {t('blogDetail.tags.suggestEmpty')}
        </Typography>
      )}
      {suggested.length > 0 && (
        <SuggestionChips
          suggested={suggested}
          accepted={accepted}
          truncated={truncated}
          siteTags={siteTags}
          onToggle={toggleAccept}
        />
      )}
    </FormDialog>
  );
}
