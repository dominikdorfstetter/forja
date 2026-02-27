import { Box, TextField } from '@mui/material';
import { Controller, type Control, type UseFormWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import { useQueryClient } from '@tanstack/react-query';
import type { BlogContentFormData } from './blogDetailSchema';
import CharCounter from './CharCounter';
import SerpPreview from './SerpPreview';
import InlineEditField from '@/components/shared/InlineEditField';
import apiService from '@/services/api';

interface BlogSeoTabProps {
  control: Control<BlogContentFormData>;
  watch: UseFormWatch<BlogContentFormData>;
  onSnapshot: () => void;
  blogId: string;
  slug: string;
  canWrite: boolean;
}

export default function BlogSeoTab({
  control,
  watch,
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
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 0.5 }}>
              <CharCounter current={field.value?.length || 0} max={160} />
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
