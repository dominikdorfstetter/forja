import { Box } from '@mui/material';
import { useTranslation } from 'react-i18next';
import type { MediaResponse } from '@/types/api';
import { formatBytes } from '@/utils/formatBytes';
import MediaDetailList from './MediaDetailList';

type MediaVariant = MediaResponse['variants'][number];

function VariantRow({ variant }: { variant: MediaVariant }) {
  return (
    <>
      <Box
        component="span"
        sx={{
          flexGrow: 1,
          fontSize: 13,
          fontWeight: 600,
          color: 'var(--on-surface)',
          fontVariationSettings: '"wght" 600, "opsz" 13',
        }}
      >
        {variant.variant_name}
      </Box>
      <Box component="span" sx={{ fontSize: 12, color: 'var(--on-surface-variant)' }}>
        {variant.width} × {variant.height}
      </Box>
      <Box
        component="span"
        sx={{
          fontSize: 12,
          color: 'var(--on-surface-variant)',
          minWidth: 64,
          textAlign: 'right',
        }}
      >
        {formatBytes(variant.file_size)}
      </Box>
    </>
  );
}

/** Generated image variants (name, dimensions, size). */
export default function MediaVariantsTab({ variants }: { variants: MediaVariant[] | undefined }) {
  const { t } = useTranslation();
  return (
    <MediaDetailList
      items={variants}
      getKey={(v) => v.id}
      rowSx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1.25 }}
      renderRow={(v) => <VariantRow variant={v} />}
      emptyLabel={t('media.variants.none', 'No variants available')}
    />
  );
}
