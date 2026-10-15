import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useSnackbar } from 'notistack';
import { assignTagToContent, createTag } from '@/services/taxonomy';
import { useAiAssist } from '@/hooks/useAiAssist';
import type { Tag } from '@/types/api';
import { findTagBySlug } from './blogTagUtils';

/** UI-side cap on how many AI suggestions are rendered. Backend also caps. */
export const MAX_RENDERED_SUGGESTIONS = 8;

interface UseBlogTagSuggestionsOptions {
  contentId: string;
  siteId: string;
  blogBody: string;
  siteTags: Tag[];
  assignedIds: Set<string>;
  /** Called once every accepted suggestion has been processed. */
  onApplied: () => void;
}

/** Resolve a suggested slug to a tag id (creating a site tag when it does not
 * exist yet) and assign it to the content unless it is already assigned. */
async function ensureTagAssigned(
  slug: string,
  { contentId, siteId, siteTags, assignedIds }: Omit<UseBlogTagSuggestionsOptions, 'blogBody' | 'onApplied'>,
): Promise<void> {
  const existing = findTagBySlug(siteTags, slug);
  const tagId = existing?.id ?? (await createTag({ slug, is_global: false, site_id: siteId })).id;
  if (!assignedIds.has(tagId)) {
    await assignTagToContent(contentId, { tag_id: tagId });
  }
}

/** AI tag-suggestion flow for a blog: fetch suggestions, let the user pick a
 * subset, then create-or-reuse and assign each accepted tag. */
export function useBlogTagSuggestions(options: UseBlogTagSuggestionsOptions) {
  const { blogBody, siteTags, onApplied } = options;
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();
  const ai = useAiAssist();

  const [open, setOpen] = useState(false);
  const [suggested, setSuggested] = useState<string[]>([]);
  const [accepted, setAccepted] = useState<Set<string>>(new Set());
  const [truncated, setTruncated] = useState(false);

  const suggest = async () => {
    setOpen(true);
    setSuggested([]);
    setAccepted(new Set());
    setTruncated(false);
    try {
      const existingTagSlugs = siteTags.map((tag) => tag.slug);
      const result = await ai.generate('blog_tags', blogBody, {
        blogTagContext: { existing_tags: existingTagSlugs },
      });
      const all = result.tags ?? [];
      setSuggested(all.slice(0, MAX_RENDERED_SUGGESTIONS));
      setTruncated(all.length > MAX_RENDERED_SUGGESTIONS);
    } catch {
      // Error surfaces via ai.generateError — keep dialog open.
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

  const apply = async () => {
    for (const slug of accepted) {
      try {
        await ensureTagAssigned(slug, options);
      } catch {
        enqueueSnackbar(t('blogDetail.tags.suggestApplyFailed', { slug }), {
          variant: 'error',
        });
      }
    }
    onApplied();
    enqueueSnackbar(t('blogDetail.tags.suggestApplied'), { variant: 'success' });
    setOpen(false);
    setSuggested([]);
    setAccepted(new Set());
  };

  return {
    ai,
    open,
    close: () => setOpen(false),
    suggested,
    accepted,
    truncated,
    suggest,
    toggleAccept,
    apply,
  };
}

export type BlogTagSuggestions = ReturnType<typeof useBlogTagSuggestions>;
