import { Box, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import type { MediaUsageResponse } from '@/types/api';
import MediaDetailList from './MediaDetailList';

type MediaReference = MediaUsageResponse['references'][number];

const pillSx = {
  fontSize: 11,
  px: 1,
  py: 0.25,
  borderRadius: '999px',
  fontVariationSettings: '"wght" 600, "opsz" 11',
  letterSpacing: 0.3,
} as const;

function ReferenceRow({ reference }: { reference: MediaReference }) {
  return (
    <>
      <Typography variant="body2" sx={{ color: 'var(--on-surface)', fontWeight: 500 }}>
        {reference.title}
      </Typography>
      <Box sx={{ display: 'flex', gap: 0.75 }}>
        <Box
          component="span"
          sx={{
            ...pillSx,
            bgcolor: 'transparent',
            border: '1px solid var(--outline-variant)',
            color: 'var(--on-surface-variant)',
          }}
        >
          {reference.content_type}
        </Box>
        <Box
          component="span"
          sx={{
            ...pillSx,
            bgcolor: 'var(--primary-container)',
            color: 'var(--on-primary-container)',
          }}
        >
          {reference.usage}
        </Box>
      </Box>
    </>
  );
}

/** Content items that reference this media file. */
export default function MediaUsageTab({ references }: { references: MediaReference[] | undefined }) {
  const { t } = useTranslation();
  return (
    <MediaDetailList
      items={references}
      getKey={(r) => `${r.content_type}:${r.content_id}`}
      rowSx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 1, px: 2, py: 1.25 }}
      renderRow={(r) => <ReferenceRow reference={r} />}
      emptyLabel={t('media.usage.none', 'Not referenced by any content')}
    />
  );
}
