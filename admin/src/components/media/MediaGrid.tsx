import {
  Box,
  Grid,
  Card,
  CardContent,
  CardActions,
  Typography,
  Chip,
  IconButton,
  Tooltip,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import OpenInNewIcon from '@mui/icons-material/OpenInNew';
import ImageIcon from '@mui/icons-material/Image';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import VideoFileIcon from '@mui/icons-material/VideoFile';
import AudioFileIcon from '@mui/icons-material/AudioFile';
import { useTranslation } from 'react-i18next';
import { format } from 'date-fns';
import type { MediaListItem } from '@/types/api';
import EmptyState from '@/components/shared/EmptyState';
import DraggableMediaCard from '@/components/media/DraggableMediaCard';

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function getMimeIcon(mimeType: string) {
  if (mimeType.startsWith('image/')) return <ImageIcon sx={{ fontSize: 48 }} color="primary" />;
  if (mimeType.startsWith('video/')) return <VideoFileIcon sx={{ fontSize: 48 }} color="secondary" />;
  if (mimeType.startsWith('audio/')) return <AudioFileIcon sx={{ fontSize: 48 }} color="info" />;
  return <InsertDriveFileIcon sx={{ fontSize: 48 }} color="action" />;
}

function getMimeChipColor(mimeType: string): 'primary' | 'secondary' | 'info' | 'warning' | 'default' {
  if (mimeType.startsWith('image/')) return 'primary';
  if (mimeType.startsWith('video/')) return 'secondary';
  if (mimeType.startsWith('audio/')) return 'info';
  if (mimeType.startsWith('application/')) return 'warning';
  return 'default';
}

interface MediaGridProps {
  mediaFiles: MediaListItem[];
  hasActiveFilters: boolean;
  selectedFolderId: string | null;
  canWrite: boolean;
  isAdmin: boolean;
  onUploadClick: () => void;
  onEditFile: (file: MediaListItem) => void;
  onDeleteFile: (file: MediaListItem) => void;
}

export default function MediaGrid({
  mediaFiles,
  hasActiveFilters,
  selectedFolderId,
  canWrite,
  isAdmin,
  onUploadClick,
  onEditFile,
  onDeleteFile,
}: MediaGridProps) {
  const { t } = useTranslation();

  if (mediaFiles.length === 0) {
    return (
      <EmptyState
        icon={<ImageIcon sx={{ fontSize: 64 }} />}
        title={hasActiveFilters ? t('media.empty.noMatch') : t('media.empty.title')}
        description={
          hasActiveFilters
            ? t('media.empty.noMatchDescription')
            : selectedFolderId
              ? t('media.empty.noFilesInFolder')
              : t('media.empty.description')
        }
        action={!hasActiveFilters && !selectedFolderId && canWrite ? { label: t('media.uploadButton'), onClick: onUploadClick } : undefined}
      />
    );
  }

  return (
    <Grid container spacing={2}>
      {mediaFiles.map((file) => (
        <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }} key={file.id}>
          <DraggableMediaCard file={file}>
            <Card
              sx={{
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                transition: 'box-shadow 0.2s, transform 0.2s',
                '&:hover': {
                  boxShadow: 6,
                  transform: 'translateY(-2px)',
                },
                '&:hover .media-actions': { opacity: 1 },
              }}
            >
              <Box
                sx={{
                  display: 'flex',
                  justifyContent: 'center',
                  alignItems: 'center',
                  pt: 2,
                }}
              >
                {file.public_url && file.mime_type.startsWith('image/') ? (
                  <Box component="img" src={file.public_url} alt={file.filename} sx={{ width: 80, height: 80, objectFit: 'cover', borderRadius: 1 }} />
                ) : (
                  getMimeIcon(file.mime_type)
                )}
              </Box>
              <CardContent sx={{ pb: 0, flexGrow: 1 }}>
                <Typography variant="body2" noWrap title={file.original_filename}>{file.original_filename}</Typography>
                <Typography variant="caption" color="text.secondary" display="block" noWrap sx={{ mt: 0.5 }}>
                  {formatFileSize(file.file_size)}
                </Typography>
                <Box sx={{ display: 'flex', gap: 0.5, mt: 1, flexWrap: 'wrap' }}>
                  <Chip
                    label={file.mime_type.split('/')[1]}
                    size="small"
                    variant="outlined"
                    color={getMimeChipColor(file.mime_type)}
                  />
                  {file.width && file.height && (
                    <Chip
                      label={`${file.width}x${file.height}`}
                      size="small"
                      variant="outlined"
                    />
                  )}
                </Box>
                <Typography variant="caption" color="text.disabled" display="block" sx={{ mt: 0.5 }}>{format(new Date(file.created_at), 'PP')}</Typography>
              </CardContent>
              {(canWrite || isAdmin) && (
                <CardActions
                  className="media-actions"
                  sx={{
                    justifyContent: 'flex-end',
                    pt: 0,
                    opacity: 0,
                    transition: 'opacity 0.15s',
                  }}
                >
                  <Tooltip title={t('common.actions.edit')}>
                    <IconButton size="small" aria-label={t('common.actions.edit')} onClick={() => onEditFile(file)}>
                      <EditIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                  {file.public_url && (
                    <Tooltip title={t('media.openUrl')}>
                      <IconButton size="small" aria-label={t('media.openUrl')} color="primary" onClick={() => window.open(file.public_url!, '_blank')}>
                        <OpenInNewIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                  {isAdmin && (
                    <Tooltip title={t('common.actions.delete')}>
                      <IconButton size="small" aria-label={t('common.actions.delete')} color="error" onClick={() => onDeleteFile(file)}>
                        <DeleteIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  )}
                </CardActions>
              )}
            </Card>
          </DraggableMediaCard>
        </Grid>
      ))}
    </Grid>
  );
}
