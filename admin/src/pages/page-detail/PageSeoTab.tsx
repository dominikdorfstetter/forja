import { Box, TextField } from '@mui/material';
import { Controller, type Control, type UseFormWatch } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type { PageDetailFormData } from './pageDetailSchema';
import CharCounter from '@/pages/blog-detail/CharCounter';
import SerpPreview from '@/pages/blog-detail/SerpPreview';

interface PageSeoTabProps {
  control: Control<PageDetailFormData>;
  watch: UseFormWatch<PageDetailFormData>;
  onSnapshot: () => void;
  route: string;
}

export default function PageSeoTab({ control, watch, onSnapshot, route }: PageSeoTabProps) {
  const { t } = useTranslation();
  const metaTitle = watch('meta_title');
  const metaDescription = watch('meta_description');
  const excerpt = watch('excerpt');
  const pageRoute = watch('route');

  return (
    <Box>
      <Controller
        name="meta_title"
        control={control}
        render={({ field }) => (
          <Box sx={{ mb: 2 }}>
            <TextField
              {...field}
              label={t('pageDetail.fields.metaTitle')}
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
              label={t('pageDetail.fields.metaDescription')}
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

      <Controller
        name="excerpt"
        control={control}
        render={({ field }) => (
          <Box sx={{ mb: 2 }}>
            <TextField
              {...field}
              label={t('pageDetail.fields.excerpt')}
              fullWidth
              multiline
              rows={2}
              onBlur={() => { field.onBlur(); onSnapshot(); }}
              inputProps={{ maxLength: 300 }}
            />
            <Box sx={{ display: 'flex', justifyContent: 'flex-end', mt: 0.5 }}>
              <CharCounter current={field.value?.length || 0} max={300} />
            </Box>
          </Box>
        )}
      />

      <SerpPreview
        title={metaTitle || pageRoute || route}
        description={metaDescription || excerpt}
        urlPath={route}
      />
    </Box>
  );
}
