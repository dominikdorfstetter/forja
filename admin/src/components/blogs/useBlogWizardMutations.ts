import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useTranslation } from 'react-i18next';
import apiService from '@/services/api';
import { useSiteContext } from '@/store/SiteContext';
import { useAuth } from '@/store/AuthContext';
import { useErrorSnackbar } from '@/hooks/useErrorSnackbar';
import { slugify } from '@/utils/slugify';
import type { MarkdownParseResult } from '@/utils/markdownImport';
import type { ContentTemplate, SiteLocaleResponse } from '@/types/api';

interface ScratchFormData {
  slug: string;
  author: string;
}

interface AiState {
  aiTitle: string;
  aiSubtitle: string;
  aiBody: string;
  aiExcerpt: string;
  aiMetaTitle: string;
  aiMetaDescription: string;
}

interface UseBlogWizardMutationsOptions {
  siteLocales: SiteLocaleResponse[] | undefined;
  onClose: () => void;
  onCreated: (blogId: string) => void;
  getAiState: () => AiState;
}

export function useBlogWizardMutations({ siteLocales, onClose, onCreated, getAiState }: UseBlogWizardMutationsOptions) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { selectedSiteId } = useSiteContext();
  const { userFullName } = useAuth();
  const { showError, showSuccess } = useErrorSnackbar();

  const onMutationSuccess = (blog: { id: string }) => {
    queryClient.invalidateQueries({ queryKey: ['blogs'] });
    showSuccess(t('blogs.messages.created'));
    onClose();
    onCreated(blog.id);
  };

  const scratchMutation = useMutation({
    mutationFn: (data: ScratchFormData) =>
      apiService.createBlog({
        slug: data.slug,
        author: data.author,
        published_date: new Date().toISOString().split('T')[0],
        is_featured: false,
        allow_comments: true,
        status: 'Draft',
        site_ids: [selectedSiteId],
      }),
    onSuccess: onMutationSuccess,
    onError: showError,
  });

  const templateMutation = useMutation({
    mutationFn: async ({ template, source }: { template: unknown; source: 'builtin' | 'custom' }) => {
      let slug: string;
      let is_featured: boolean;
      let allow_comments: boolean;
      let content: { title: string; subtitle: string; excerpt: string; body: string; meta_title: string; meta_description: string };

      if (source === 'builtin') {
        const bt = template as { defaults: { slug: string; is_featured: boolean; allow_comments: boolean }; content: typeof content };
        slug = `${bt.defaults.slug}-${Date.now()}`;
        is_featured = bt.defaults.is_featured;
        allow_comments = bt.defaults.allow_comments;
        content = bt.content;
      } else {
        const ct = template as ContentTemplate;
        slug = `${ct.slug_prefix}-${Date.now()}`;
        is_featured = ct.is_featured;
        allow_comments = ct.allow_comments;
        content = {
          title: ct.title,
          subtitle: ct.subtitle,
          excerpt: ct.excerpt,
          body: ct.body,
          meta_title: ct.meta_title,
          meta_description: ct.meta_description,
        };
      }

      const blog = await apiService.createBlog({
        slug,
        author: userFullName || 'Author',
        published_date: new Date().toISOString().split('T')[0],
        is_featured,
        allow_comments,
        status: 'Draft',
        site_ids: [selectedSiteId],
      });
      const defaultLocale = siteLocales?.find((l) => l.is_default);
      if (defaultLocale) {
        await apiService.createBlogLocalization(blog.id, {
          locale_id: defaultLocale.locale_id,
          title: content.title,
          subtitle: content.subtitle,
          excerpt: content.excerpt,
          body: content.body,
          meta_title: content.meta_title,
          meta_description: content.meta_description,
        });
      }
      return blog;
    },
    onSuccess: onMutationSuccess,
    onError: showError,
  });

  const importMutation = useMutation({
    mutationFn: async (result: MarkdownParseResult) => {
      const blog = await apiService.createBlog({
        slug: result.slug,
        author: userFullName || 'Author',
        published_date: new Date().toISOString().split('T')[0],
        is_featured: false,
        allow_comments: true,
        status: 'Draft',
        site_ids: [selectedSiteId],
      });
      const defaultLocale = siteLocales?.find((l) => l.is_default);
      if (defaultLocale) {
        await apiService.createBlogLocalization(blog.id, {
          locale_id: defaultLocale.locale_id,
          title: result.title,
          excerpt: result.excerpt,
          body: result.body,
          meta_title: result.meta_title,
        });
      }
      return blog;
    },
    onSuccess: onMutationSuccess,
    onError: showError,
  });

  const aiMutation = useMutation({
    mutationFn: async () => {
      const aiState = getAiState();
      const slug = slugify(aiState.aiTitle) || `ai-post-${Date.now()}`;
      const blog = await apiService.createBlog({
        slug,
        author: userFullName || 'Author',
        published_date: new Date().toISOString().split('T')[0],
        is_featured: false,
        allow_comments: true,
        status: 'Draft',
        site_ids: [selectedSiteId],
      });
      const defaultLocale = siteLocales?.find((l) => l.is_default);
      if (defaultLocale) {
        await apiService.createBlogLocalization(blog.id, {
          locale_id: defaultLocale.locale_id,
          title: aiState.aiTitle,
          subtitle: aiState.aiSubtitle || undefined,
          excerpt: aiState.aiExcerpt || undefined,
          body: aiState.aiBody || undefined,
          meta_title: aiState.aiMetaTitle || undefined,
          meta_description: aiState.aiMetaDescription || undefined,
        });
      }
      return blog;
    },
    onSuccess: onMutationSuccess,
    onError: showError,
  });

  const isCreating = scratchMutation.isPending || templateMutation.isPending || importMutation.isPending || aiMutation.isPending;

  return {
    scratchMutation,
    templateMutation,
    importMutation,
    aiMutation,
    isCreating,
  };
}
