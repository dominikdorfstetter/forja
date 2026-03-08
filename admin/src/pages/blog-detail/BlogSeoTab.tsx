import { Box, Button, CircularProgress, TextField, Tooltip } from '@mui/material';
import { AutoAwesome as AiIcon } from '@mui/icons-material';
import { Controller, type Control, type UseFormWatch, type UseFormSetValue } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import type { BlogContentFormData } from './blogDetailSchema';
import CharCounter from './CharCounter';
import SerpPreview from './SerpPreview';
import InlineEditField from '@/components/shared/InlineEditField';
import apiService from '@/services/api';
import { useAiAssist } from '@/hooks/useAiAssist';

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
  const title = watch('title');
  const metaTitle = watch('meta_title');
  const metaDescription = watch('meta_description');
  const excerpt = watch('excerpt');
  const body = watch('body');

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

  return (
    <Box>
      <Controller
        name="meta_title"
        control={control}
        render={({ field }) => (
          <Box sx={{ mb: 2 }}>
            <TextField
              {...field}
              label={t('blogDetail.fields.metaTitle')}
              fullWidth
              onBlur={() => { field.onBlur(); onSnapshot(); }}
              inputProps={{ maxLength: 70 }}
            />
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 0.5 }}>
              <CharCounter current={field.value?.length || 0} max={60} />
            </Box>
          </Box>
        )}
      />

      <Controller
        name="meta_description"
        control={control}
        render={({ field }) => (
          <Box sx={{ mb: 2 }}>
            <TextField
              {...field}
              label={t('blogDetail.fields.metaDescription')}
              fullWidth
              multiline
              rows={3}
              onBlur={() => { field.onBlur(); onSnapshot(); }}
              inputProps={{ maxLength: 200 }}
            />
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 0.5 }}>
              {isConfigured && (
                <Tooltip title={hasContent ? '' : t('blogDetail.ai.writeContentFirst')}>
                  <span>
                    <Button
                      size="small"
                      startIcon={isGenerating ? <CircularProgress size={14} /> : <AiIcon />}
                      onClick={handleGenerateSeo}
                      disabled={!hasContent || isGenerating}
                    >
                      {t('blogDetail.ai.generateSeo')}
                    </Button>
                  </span>
                </Tooltip>
              )}
              <CharCounter current={field.value?.length || 0} max={160} />
            </Box>
          </Box>
        )}
      />

      <Controller
        name="excerpt"
        control={control}
        render={({ field }) => (
          <Box sx={{ mb: 2 }}>
            <TextField
              {...field}
              label={t('blogDetail.fields.excerpt')}
              fullWidth
              multiline
              rows={2}
              onBlur={() => { field.onBlur(); onSnapshot(); }}
              inputProps={{ maxLength: 300 }}
            />
            <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mt: 0.5 }}>
              {isConfigured && (
                <Tooltip title={hasContent ? '' : t('blogDetail.ai.writeContentFirst')}>
                  <span>
                    <Button
                      size="small"
                      startIcon={isGenerating ? <CircularProgress size={14} /> : <AiIcon />}
                      onClick={handleGenerateExcerpt}
                      disabled={!hasContent || isGenerating}
                    >
                      {t('blogDetail.ai.generateExcerpt')}
                    </Button>
                  </span>
                </Tooltip>
              )}
              <CharCounter current={field.value?.length || 0} max={300} />
            </Box>
          </Box>
        )}
      />

      <Box sx={{ mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <strong>{t('blogDetail.metadata.slug')}</strong>
          <InlineEditField
            value={slug}
            variant="body2"
            fontFamily="monospace"
            disabled={!canWrite}
            onSave={async (newSlug) => {
              await apiService.updateBlog(blogId, { slug: newSlug });
              queryClient.invalidateQueries({ queryKey: ['blog-detail', blogId] });
            }}
          />
        </Box>
      </Box>

      <SerpPreview
        title={metaTitle || title}
        description={metaDescription || excerpt}
        slug={slug}
      />
    </Box>
  );
}
