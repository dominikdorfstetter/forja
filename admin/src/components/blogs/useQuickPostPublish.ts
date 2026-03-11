import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import apiService from '@/services/api';
import { useAuth } from '@/store/AuthContext';
import { useSiteContext } from '@/store/SiteContext';
import { useErrorSnackbar } from '@/hooks/useErrorSnackbar';
import { slugify } from '@/utils/slugify';
import type { ContentStatus } from '@/types/api';

interface PostData {
  title: string;
  subtitle: string;
  body: string;
}

interface UseQuickPostPublishOptions {
  open: boolean;
  getPostData: () => PostData;
  onClose: () => void;
}

export function useQuickPostPublish({ open, getPostData, onClose }: UseQuickPostPublishOptions) {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { showError, showSuccess } = useErrorSnackbar();
  const { userFullName } = useAuth();
  const { selectedSiteId } = useSiteContext();

  const { data: siteLocales } = useQuery({
    queryKey: ['site-locales', selectedSiteId],
    queryFn: () => apiService.getSiteLocales(selectedSiteId),
    enabled: open && !!selectedSiteId,
  });

  const publishMutation = useMutation({
    mutationFn: async (status: ContentStatus) => {
      const postData = getPostData();
      const slug = slugify(postData.title) || `post-${Date.now()}`;
      const blog = await apiService.createBlog({
        slug,
        author: userFullName || 'Author',
        published_date: new Date().toISOString().split('T')[0],
        is_featured: false,
        allow_comments: false,
        status,
        site_ids: [selectedSiteId],
      });

      const defaultLocale = siteLocales?.find((l) => l.is_default);
      if (defaultLocale) {
        await apiService.createBlogLocalization(blog.id, {
          locale_id: defaultLocale.locale_id,
          title: postData.title,
          subtitle: postData.subtitle || undefined,
          body: postData.body || undefined,
        });
      }

      return blog;
    },
    onSuccess: (blog) => {
      queryClient.invalidateQueries({ queryKey: ['blogs'] });
      showSuccess(t('quickPost.success'));
      onClose();
      navigate(`/blogs/${blog.id}`);
    },
    onError: showError,
  });

  return publishMutation;
}
