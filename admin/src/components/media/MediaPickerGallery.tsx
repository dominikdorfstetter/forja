import { useMemo } from 'react';
import { Box, CardMedia, Grid, Typography } from '@mui/material';
import ImageIcon from '@mui/icons-material/Image';
import { useTranslation } from 'react-i18next';
import type { MediaListItem } from '@/types/api';
import { PickerCard, PickerSearchResults } from '@/components/shared/library';

/** Case-insensitive filename filter; a blank query keeps everything. */
export function filterMediaByFilename<T extends { original_filename: string }>(list: T[], search: string): T[] {
  if (!search.trim()) return list;
  const lower = search.toLowerCase();
  return list.filter((m) => m.original_filename.toLowerCase().includes(lower));
}

interface MediaPickerCardProps {
  media: MediaListItem;
  selected: boolean;
  onSelect: (mediaId: string) => void;
}

function MediaPickerCard({ media, selected, onSelect }: MediaPickerCardProps) {
  return (
    <PickerCard selected={selected} onClick={() => onSelect(media.id)}>
      {media.public_url ? (
        <CardMedia
          component="img"
          height={100}
          image={media.public_url}
          alt={media.original_filename}
          sx={{ objectFit: 'cover' }}
        />
      ) : (
        <Box
          sx={{
            height: 100,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: 'action.hover',
          }}
        >
          <ImageIcon sx={{ fontSize: 40, color: 'text.disabled' }} />
        </Box>
      )}
      <Box sx={{ px: 1, py: 0.5 }}>
        <Typography variant="caption" noWrap sx={{ display: "block" }}>
          {media.original_filename}
        </Typography>
        {media.width && media.height && (
          <Typography variant="caption" color="text.secondary">
            {media.width} x {media.height}
          </Typography>
        )}
      </Box>
    </PickerCard>
  );
}

interface MediaPickerGalleryProps {
  search: string;
  onSearchChange: (search: string) => void;
  isLoading: boolean;
  /** Unfiltered picker results; the gallery applies the search itself. */
  media: MediaListItem[] | undefined;
  selectedId: string | null;
  onSelect: (mediaId: string) => void;
}

/** Gallery tab of the media picker: filename search + selectable image grid. */
export default function MediaPickerGallery({
  search,
  onSearchChange,
  isLoading,
  media,
  selectedId,
  onSelect,
}: MediaPickerGalleryProps) {
  const { t } = useTranslation();
  const filteredMedia = useMemo(() => filterMediaByFilename(media ?? [], search), [media, search]);

  return (
    <PickerSearchResults
      search={search}
      onSearchChange={onSearchChange}
      placeholder={t('media.picker.search')}
      searchSx={{ mb: 2 }}
      isLoading={isLoading}
      isEmpty={filteredMedia.length === 0}
      emptyMessage={t('media.picker.noResults')}
    >
      {filteredMedia.map((item) => (
        <Grid size={{ xs: 6, sm: 4, md: 3 }} key={item.id}>
          <MediaPickerCard media={item} selected={selectedId === item.id} onSelect={onSelect} />
        </Grid>
      ))}
    </PickerSearchResults>
  );
}
