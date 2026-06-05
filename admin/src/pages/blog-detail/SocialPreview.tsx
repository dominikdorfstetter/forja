import { Box, Paper, Stack, Typography } from '@mui/material';
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';
import { useTranslation } from 'react-i18next';
import { useMediaUrl } from '@/hooks/useMediaUrl';

const TITLE_LIMIT = 60;
const DESCRIPTION_LIMIT = 160;

interface SocialPreviewProps {
  title: string;
  description: string;
  coverImageId?: string | null;
  baseUrl?: string | null;
}

function truncate(value: string, limit: number): { display: string; overflowed: boolean } {
  if (value.length <= limit) return { display: value, overflowed: false };
  return { display: value.slice(0, limit) + '…', overflowed: true };
}

function formatDomain(baseUrl: string | null | undefined): string {
  if (!baseUrl) return 'example.com';
  return baseUrl.replace(/^https?:\/\//, '').replace(/\/+$/, '');
}

export default function SocialPreview({ title, description, coverImageId, baseUrl }: SocialPreviewProps) {
  const { t } = useTranslation();
  const imageUrl = useMediaUrl(coverImageId ?? undefined);

  const { display: displayTitle, overflowed: titleOverflowed } = truncate(title, TITLE_LIMIT);
  const { display: displayDesc, overflowed: descOverflowed } = truncate(description, DESCRIPTION_LIMIT);
  const displayDomain = formatDomain(baseUrl);

  return (
    <Paper variant="outlined" sx={{ mt: 2, overflow: 'hidden' }}>
      <Typography variant="caption" color="text.secondary" sx={{ px: 2, pt: 2, display: 'block' }}>
        {t('blogDetail.seo.socialPreview')}
      </Typography>

      <Box
        sx={{
          mt: 1,
          aspectRatio: '1.91 / 1',
          bgcolor: 'action.hover',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderBottom: '1px solid',
          borderColor: 'divider',
        }}
      >
        {coverImageId && imageUrl ? (
          <Box
            component="img"
            src={imageUrl}
            alt={title || 'cover'}
            sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <Stack
            spacing={0.5}
            sx={{ alignItems: 'center' }}
            data-testid="social-preview-placeholder"
          >
            <ImageOutlinedIcon sx={{ fontSize: 36, color: 'text.disabled' }} />
            <Typography variant="caption" color="text.secondary">
              {t('blogDetail.seo.socialPreviewNoCover')}
            </Typography>
          </Stack>
        )}
      </Box>

      <Box sx={{ p: 2, bgcolor: 'background.paper' }}>
        <Typography
          variant="caption"
          data-testid="social-preview-domain"
          sx={{ color: 'text.secondary', textTransform: 'uppercase', letterSpacing: 0.5, display: 'block' }}
        >
          {displayDomain}
        </Typography>
        <Typography
          variant="subtitle1"
          data-testid="social-preview-title"
          sx={{ fontWeight: 600, lineHeight: 1.3, mt: 0.5, wordBreak: 'break-word' }}
        >
          {displayTitle}
        </Typography>
        <Typography
          variant="body2"
          data-testid="social-preview-description"
          color="text.secondary"
          sx={{ mt: 0.5, wordBreak: 'break-word' }}
        >
          {displayDesc}
        </Typography>

        {(titleOverflowed || descOverflowed) && (
          <Stack spacing={0.5} sx={{ mt: 1.5 }}>
            {titleOverflowed && (
              <Stack
                spacing={0.5}
                data-testid="social-preview-title-warning"
                sx={{ flexDirection: 'row', alignItems: 'center', color: 'warning.main' }}
              >
                <WarningAmberRoundedIcon fontSize="small" />
                <Typography variant="caption">
                  {t('blogDetail.seo.socialPreviewTitleWarning')}
                </Typography>
              </Stack>
            )}
            {descOverflowed && (
              <Stack
                spacing={0.5}
                data-testid="social-preview-description-warning"
                sx={{ flexDirection: 'row', alignItems: 'center', color: 'warning.main' }}
              >
                <WarningAmberRoundedIcon fontSize="small" />
                <Typography variant="caption">
                  {t('blogDetail.seo.socialPreviewDescriptionWarning')}
                </Typography>
              </Stack>
            )}
          </Stack>
        )}

        <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 1.5 }}>
          {t('blogDetail.seo.socialPreviewApproximate')}
        </Typography>
      </Box>
    </Paper>
  );
}
