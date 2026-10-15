import { Box, Grid } from '@mui/material';
import ImageIcon from '@mui/icons-material/Image';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import VideoFileIcon from '@mui/icons-material/VideoFile';
import AudioFileIcon from '@mui/icons-material/AudioFile';
import { useTranslation } from 'react-i18next';
import type { MediaListItem } from '@/types/api';
import { useLocalizedFormat } from '@/utils/dateFnsLocale';
import EmptyState from '@/components/shared/EmptyState';
import DraggableMediaCard from '@/components/media/DraggableMediaCard';
import { M3IconButton } from '@/components/design-system';
import { LibraryCard } from '@/components/shared/library';
import { formatBytes } from '@/utils/formatBytes';

function getMimeIcon(mimeType: string, size = 56) {
  const sx = { fontSize: size, color: 'var(--on-surface-variant)' };
  if (mimeType.startsWith('image/')) return <ImageIcon sx={sx} />;
  if (mimeType.startsWith('video/')) return <VideoFileIcon sx={sx} />;
  if (mimeType.startsWith('audio/')) return <AudioFileIcon sx={sx} />;
  return <InsertDriveFileIcon sx={sx} />;
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
  selected?: Set<string>;
  onToggleSelect?: (id: string) => void;
  selectionMode?: boolean;
}

/**
 * M3 Expressive media grid. Each card leads with the preview (full-bleed,
 * 4:3) and hides secondary metadata (mime, dims, tags) behind the detail
 * view — cards used to surface up to eleven info points which read as
 * clutter. Actions appear on hover / focus-within via a tonal strip at
 * the bottom of the preview; keyboard users still see them.
 */
export default function MediaGrid({
  mediaFiles,
  hasActiveFilters,
  selectedFolderId,
  canWrite,
  isAdmin,
  onUploadClick,
  onEditFile,
  onDeleteFile,
  selected,
  onToggleSelect,
  selectionMode = false,
}: MediaGridProps) {
  const { t } = useTranslation();
  const fmt = useLocalizedFormat();

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

  const showActions = canWrite || isAdmin;

  return (
    <Grid container spacing={2}>
      {mediaFiles.map((file) => (
        <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }} key={file.id} sx={{ display: 'flex' }}>
          <DraggableMediaCard file={file}>
            <LibraryCard
              testId="media-item"
              selected={selected?.has(file.id) ?? false}
              onToggleSelect={onToggleSelect && (() => onToggleSelect(file.id))}
              onClick={selectionMode && onToggleSelect ? () => onToggleSelect(file.id) : undefined}
              cursor={selectionMode ? 'pointer' : 'default'}
              previewLayout="thumbnail"
              preview={<MediaThumbnail file={file} />}
              badge={file.has_alt_text ? <AltTextBadge /> : undefined}
              actions={
                showActions ? (
                  <MediaCardActions file={file} isAdmin={isAdmin} onEdit={onEditFile} onDelete={onDeleteFile} />
                ) : undefined
              }
              title={file.original_filename}
              subtitle={<>{formatBytes(file.file_size)} &middot; {fmt(file.created_at, 'PP')}</>}
            />
          </DraggableMediaCard>
        </Grid>
      ))}
    </Grid>
  );
}

/** Focal-point-aware image preview, or a mime-type icon for non-images. */
function MediaThumbnail({ file }: { file: MediaListItem }) {
  if (!file.public_url || !file.mime_type.startsWith('image/')) return getMimeIcon(file.mime_type);
  return (
    <Box
      component="img"
      src={file.public_url}
      alt={file.original_filename}
      sx={{
        width: '100%',
        height: '100%',
        objectFit: 'cover',
        objectPosition: `${(file.focal_x ?? 0.5) * 100}% ${(file.focal_y ?? 0.5) * 100}%`,
      }}
    />
  );
}

function AltTextBadge() {
  return (
    <Box
      aria-label="Has alt text"
      sx={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        minWidth: 26,
        height: 22,
        px: 0.75,
        bgcolor: 'color-mix(in oklch, var(--tertiary-container) 85%, transparent)',
        color: 'var(--on-tertiary-container)',
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: 0.5,
        borderRadius: '999px',
        backdropFilter: 'blur(6px)',
      }}
    >
      ALT
    </Box>
  );
}

interface MediaCardActionsProps {
  file: MediaListItem;
  isAdmin: boolean;
  onEdit: (file: MediaListItem) => void;
  onDelete: (file: MediaListItem) => void;
}

function MediaCardActions({ file, isAdmin, onEdit, onDelete }: MediaCardActionsProps) {
  const { t } = useTranslation();
  const publicUrl = file.public_url;

  return (
    <>
      <M3IconButton name="edit" size={34} tooltip={t('common.actions.edit')} onClick={() => onEdit(file)} />
      {publicUrl && (
        <>
          <M3IconButton
            name="content_copy"
            size={34}
            tooltip={t('media.copyUrl')}
            onClick={() => navigator.clipboard.writeText(publicUrl)}
          />
          <M3IconButton
            name="open_in_new"
            size={34}
            tooltip={t('media.openUrl')}
            onClick={() => window.open(publicUrl, '_blank')}
          />
        </>
      )}
      {isAdmin && (
        <M3IconButton
          name="delete"
          size={34}
          tooltip={t('common.actions.delete')}
          ariaLabel={t('common.actions.delete')}
          onClick={() => onDelete(file)}
        />
      )}
    </>
  );
}
