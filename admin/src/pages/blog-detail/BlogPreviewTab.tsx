import { Box, Divider, Typography } from '@mui/material';
import type { UseFormGetValues } from 'react-hook-form';
import type { BlogContentFormData } from './blogDetailSchema';
import MarkdownPreview from '@/components/shared/MarkdownPreview';

interface BlogPreviewTabProps {
  getValues: UseFormGetValues<BlogContentFormData>;
}

export default function BlogPreviewTab({ getValues }: BlogPreviewTabProps) {
  const { title, subtitle, body } = getValues();

  return (
    <Box sx={{ maxWidth: 800 }}>
      <Typography variant="h3" gutterBottom>
        {title || 'Untitled'}
      </Typography>

      {subtitle && (
        <Typography variant="h5" color="text.secondary" gutterBottom>
          {subtitle}
        </Typography>
      )}

      <Divider sx={{ my: 3 }} />

      <MarkdownPreview content={body || ''} />
    </Box>
  );
}
