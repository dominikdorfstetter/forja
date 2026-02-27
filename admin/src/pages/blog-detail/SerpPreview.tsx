import { Box, Paper, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';

interface SerpPreviewProps {
  title: string;
  description: string;
  slug?: string;
}

export default function SerpPreview({ title, description, slug }: SerpPreviewProps) {
  const { t } = useTranslation();
  const displayTitle = title || 'Untitled';
  const displayDesc = description || 'No description provided.';
  const displayUrl = slug ? `example.com/blog/${slug}` : 'example.com/blog/...';

  return (
    <Paper variant="outlined" sx={{ p: 2, mt: 2 }}>
      <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
        {t('blogDetail.seo.serpPreview')}
      </Typography>
      <Box sx={{ fontFamily: 'Arial, sans-serif' }}>
        <Typography
          sx={{
            color: '#1a0dab',
            fontSize: '1.1rem',
            lineHeight: 1.3,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {displayTitle}
        </Typography>
        <Typography
          sx={{
            color: '#006621',
            fontSize: '0.8rem',
            lineHeight: 1.4,
          }}
        >
          {displayUrl}
        </Typography>
        <Typography
          sx={{
            color: '#545454',
            fontSize: '0.85rem',
            lineHeight: 1.5,
            display: '-webkit-box',
            WebkitLineClamp: 2,
            WebkitBoxOrient: 'vertical',
            overflow: 'hidden',
          }}
        >
          {displayDesc}
        </Typography>
      </Box>
    </Paper>
  );
}
