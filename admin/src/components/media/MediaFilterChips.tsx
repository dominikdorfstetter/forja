import { Stack } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { Chip } from '@/components/design-system';
import type { MediaCategoryCounts } from '@/types/api';

const MIME_CATEGORIES = [
  { key: 'image', labelKey: 'media.categories.images', icon: 'image' },
  { key: 'video', labelKey: 'media.categories.videos', icon: 'movie' },
  { key: 'audio', labelKey: 'media.categories.audio', icon: 'graphic_eq' },
] as const;

interface MediaFilterChipsProps {
  mimeCategory: string | null;
  onToggleCategory: (key: string) => void;
  counts?: MediaCategoryCounts;
}

/**
 * MIME category filter chips (Bilder / Videos / Audio). Use the
 * design-system Chip so they share the canonical pill vocabulary with
 * the workbench focus-feed filters and list-page status filters — 34px
 * pill, --primary-tinted active state, --on-surface inactive.
 *
 * When counts are provided, each pill renders its per-category total
 * alongside the label so the user can see bucket sizes before clicking.
 */
export default function MediaFilterChips({ mimeCategory, onToggleCategory, counts }: MediaFilterChipsProps) {
  const { t } = useTranslation();

  return (
    <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
      {MIME_CATEGORIES.map((cat) => (
        <Chip
          key={cat.key}
          icon={cat.icon}
          active={mimeCategory === cat.key}
          count={counts?.[cat.key]}
          onClick={() => onToggleCategory(cat.key)}
        >
          {t(cat.labelKey)}
        </Chip>
      ))}
    </Stack>
  );
}
