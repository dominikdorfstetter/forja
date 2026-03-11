import { Chip, Stack } from '@mui/material';
import ImageIcon from '@mui/icons-material/Image';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import VideoFileIcon from '@mui/icons-material/VideoFile';
import AudioFileIcon from '@mui/icons-material/AudioFile';
import { useTranslation } from 'react-i18next';

const MIME_CATEGORIES = [
  { key: 'image', labelKey: 'media.categories.images', icon: <ImageIcon fontSize="small" /> },
  { key: 'video', labelKey: 'media.categories.videos', icon: <VideoFileIcon fontSize="small" /> },
  { key: 'audio', labelKey: 'media.categories.audio', icon: <AudioFileIcon fontSize="small" /> },
  { key: 'document', labelKey: 'media.categories.documents', icon: <InsertDriveFileIcon fontSize="small" /> },
] as const;

interface MediaFilterChipsProps {
  mimeCategory: string | null;
  onToggleCategory: (key: string) => void;
}

export default function MediaFilterChips({ mimeCategory, onToggleCategory }: MediaFilterChipsProps) {
  const { t } = useTranslation();

  return (
    <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
      {MIME_CATEGORIES.map((cat) => (
        <Chip
          key={cat.key}
          icon={cat.icon}
          label={t(cat.labelKey)}
          variant={mimeCategory === cat.key ? 'filled' : 'outlined'}
          color={mimeCategory === cat.key ? 'primary' : 'default'}
          onClick={() => onToggleCategory(cat.key)}
          size="small"
        />
      ))}
    </Stack>
  );
}
