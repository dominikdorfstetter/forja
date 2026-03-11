import { Paper, Typography } from '@mui/material';
import ImageIcon from '@mui/icons-material/Image';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import VideoFileIcon from '@mui/icons-material/VideoFile';
import AudioFileIcon from '@mui/icons-material/AudioFile';
import type { MediaListItem } from '@/types/api';

function getMimeSmallIcon(mimeType: string) {
  if (mimeType.startsWith('image/')) return <ImageIcon fontSize="small" color="primary" />;
  if (mimeType.startsWith('video/')) return <VideoFileIcon fontSize="small" color="secondary" />;
  if (mimeType.startsWith('audio/')) return <AudioFileIcon fontSize="small" color="info" />;
  return <InsertDriveFileIcon fontSize="small" color="action" />;
}

interface MediaDragOverlayProps {
  file: MediaListItem;
}

export default function MediaDragOverlay({ file }: MediaDragOverlayProps) {
  return (
    <Paper
      elevation={12}
      sx={{
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        px: 2,
        py: 1,
        borderRadius: 2,
        bgcolor: 'background.paper',
        border: '1px solid',
        borderColor: 'primary.main',
        maxWidth: 220,
        pointerEvents: 'none',
      }}
    >
      {getMimeSmallIcon(file.mime_type)}
      <Typography variant="body2" fontWeight={500} noWrap>{file.original_filename}</Typography>
    </Paper>
  );
}
