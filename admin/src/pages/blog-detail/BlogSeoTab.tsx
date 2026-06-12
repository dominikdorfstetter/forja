import { Box, Button, CircularProgress, Tooltip } from '@mui/material';
import { AutoAwesome as AiIcon } from '@mui/icons-material';
import type { Control, UseFormWatch, UseFormSetValue } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import type { BlogContentFormData } from './blogDetailSchema';
import SerpPreview from './SerpPreview';
import SocialPreview from './SocialPreview';
import SeoFieldsEditor from '@/components/locale-aware/SeoFieldsEditor';
import InlineEditField from '@/components/shared/InlineEditField';
import { updateBlog } from '@/services/blogs';
import { useAiAssist } from '@/hooks/useAiAssist';
import { useSiteContext } from '@/store/SiteContext';
import { queryKeys } from '@/lib/queryKeys';

interface BlogSeoTabProps {
  control: Control<BlogContentFormData>;
  watch: UseFormWatch<BlogContentFormData>;
  setValue: UseFormSetValue<BlogContentFormData>;
  onSnapshot: () => void;
  blogId: string;
  slug: string;
  canWrite: boolean;
}

export default function BlogSeoTab({
  control,
  watch,
  setValue,
  onSnapshot,
  blogId,
  slug,
  canWrite,
}: BlogSeoTabProps) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { selectedSite } = useSiteContext();
  const title = watch('title');
  const metaTitle = watch('meta_title');
  const metaDescription = watch('meta_description');
  const excerpt = watch('excerpt');
  const body = watch('body');
  const coverImageId = watch('cover_image_id');

  const { isConfigured, generate, isGenerating } = useAiAssist();
  const hasContent = (body?.length ?? 0) > 50;

  const handleGenerateSeo = async () => {
    if (!hasContent) return;
    const result = await generate('seo', body);
    if (result.meta_title) setValue('meta_title', result.meta_title, { shouldDirty: true });
    if (result.meta_description) setValue('meta_description', result.meta_description, { shouldDirty: true });
    onSnapshot();
  };

  const handleGenerateExcerpt = async () => {
    if (!hasContent) return;
    const result = await generate('excerpt', body);
    if (result.excerpt) setValue('excerpt', result.excerpt, { shouldDirty: true });
    onSnapshot();
  };

  const aiButton = (onClick: () => void, label: string) =>
    isConfigured ? (
      <Tooltip title={hasContent ? '' : t('blogDetail.ai.writeContentFirst')}>
        <span>
          <Button
            size="small"
            startIcon={isGenerating ? <CircularProgress size={14} /> : <AiIcon />}
            onClick={onClick}
            disabled={!hasContent || isGenerating}
          >
            {label}
          </Button>
        </span>
      </Tooltip>
    ) : null;

  return (
    <Box>
      {/* Blog SEO is edited only for the blog's own (default) locale here. */}
      <SeoFieldsEditor
        control={control}
        isDefault
        onDefaultBlur={onSnapshot}
        testIdPrefix="blog-seo"
        labels={{
          metaTitle: t('blogDetail.fields.metaTitle'),
          metaDescription: t('blogDetail.fields.metaDescription'),
          excerpt: t('blogDetail.fields.excerpt'),
        }}
        footerSlots={{
          meta_description: aiButton(handleGenerateSeo, t('blogDetail.ai.generateSeo')),
          excerpt: aiButton(handleGenerateExcerpt, t('blogDetail.ai.generateExcerpt')),
        }}
        locale={{ id: 'default', code: 'default' }}
        createLocalization={async () => undefined}
        updateLocalization={async () => undefined}
        invalidateKey={queryKeys.blogDetail(blogId)}
      />
      <Box sx={{ mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <strong>{t('blogDetail.metadata.slug')}</strong>
          <InlineEditField
            value={slug}
            variant="body2"
            disabled={!canWrite}
            onSave={async (newSlug) => {
              await updateBlog(blogId, { slug: newSlug });
              queryClient.invalidateQueries({ queryKey: queryKeys.blogDetail(blogId) });
            }}
          />
        </Box>
      </Box>
      <SerpPreview
        title={metaTitle || title}
        description={metaDescription || excerpt}
        slug={slug}
      />
      <SocialPreview
        title={metaTitle || title || ''}
        description={metaDescription || excerpt || ''}
        coverImageId={coverImageId}
        baseUrl={selectedSite?.base_url}
      />
    </Box>
  );
}
