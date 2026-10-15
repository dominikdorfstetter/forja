import ImageIcon from '@mui/icons-material/Image';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import VideoFileIcon from '@mui/icons-material/VideoFile';
import AudioFileIcon from '@mui/icons-material/AudioFile';
import type { MediaListItem } from '@/types/api';
import { DragPreviewCard } from '@/components/shared/listPageV2';

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
    <DragPreviewCard icon={getMimeSmallIcon(file.mime_type)} maxWidth={220}>
      {file.original_filename}
    </DragPreviewCard>
  );
}
