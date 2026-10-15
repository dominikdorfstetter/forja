import { Box } from '@mui/material';
import { useTranslation } from 'react-i18next';
import { M3Button } from '@/components/design-system';
import MediaSearchBar from '@/components/media/MediaSearchBar';

interface MediaLibraryToolbarProps {
  searchInput: string;
  onSearchChange: (value: string) => void;
  canWrite: boolean;
  onUploadClick: () => void;
}

/** Search field plus (for writers) the upload button above the media grid. */
export default function MediaLibraryToolbar({ searchInput, onSearchChange, canWrite, onUploadClick }: MediaLibraryToolbarProps) {
  const { t } = useTranslation();

  return (
    <Box sx={{ display: 'flex', gap: 1.5, alignItems: 'center', mb: 2 }}>
      <Box sx={{ flex: '1 1 auto', maxWidth: 520 }}>
        <MediaSearchBar searchInput={searchInput} onSearchChange={onSearchChange} />
      </Box>
      <Box sx={{ flexGrow: 1 }} />
      {canWrite && (
        <M3Button variant="filled" icon="add" onClick={onUploadClick}>
          {t('media.uploadButton')}
        </M3Button>
      )}
    </Box>
  );
}
