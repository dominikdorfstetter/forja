import { Box, Divider, Typography } from '@mui/material';
import { useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import type { Site } from '@/types/api';
import { useLocalizedFormat } from '@/utils/dateFnsLocale';
import CopyableId from '@/components/shared/CopyableId';
import { M3Button } from '@/components/design-system';
import SiteDetailSection from './SiteDetailSection';

/** Read-only identifiers + timestamps, plus quick links into the site's content. */
export default function SiteMetadataCard({ site }: { site: Site }) {
  const { t } = useTranslation();
  const fmt = useLocalizedFormat();
  const navigate = useNavigate();

  return (
    <SiteDetailSection title={t('siteDetail.metadata')} mb={3}>
      <Typography variant="caption" sx={{ color: 'var(--on-surface-variant)' }}>
        {t('siteDetail.fields.id')}
      </Typography>
      <Box sx={{ mb: 1.5 }}>
        <CopyableId value={site.id} />
      </Box>

      <Typography variant="caption" sx={{ color: 'var(--on-surface-variant)' }}>
        {t('siteDetail.fields.created')}
      </Typography>
      <Typography variant="body2" sx={{ mb: 1.5 }}>
        {fmt(site.created_at, 'PPpp')}
      </Typography>

      <Typography variant="caption" sx={{ color: 'var(--on-surface-variant)' }}>
        {t('siteDetail.fields.updated')}
      </Typography>
      <Typography variant="body2" sx={{ mb: 2 }}>
        {fmt(site.updated_at, 'PPpp')}
      </Typography>

      <Divider sx={{ borderColor: 'var(--outline-variant)', mb: 2 }} />

      <Typography
        component="div"
        sx={{ fontSize: 12, fontWeight: 600, color: 'var(--on-surface-variant)', letterSpacing: 0.3, textTransform: 'uppercase', mb: 1 }}
      >
        {t('siteDetail.quickLinks')}
      </Typography>
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 0.5 }}>
        <M3Button variant="text" size="sm" icon="article" onClick={() => navigate('/blogs')}>
          {t('layout.sidebar.blogs')}
        </M3Button>
        <M3Button variant="text" size="sm" icon="perm_media" onClick={() => navigate('/media')}>
          {t('layout.sidebar.media')}
        </M3Button>
        <M3Button variant="text" size="sm" icon="sell" onClick={() => navigate('/taxonomy')}>
          {t('layout.sidebar.taxonomy')}
        </M3Button>
      </Box>
    </SiteDetailSection>
  );
}
