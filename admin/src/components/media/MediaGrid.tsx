import { Box, Grid, Checkbox } from '@mui/material';
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

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

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

  return (
    <Grid container spacing={2}>
      {mediaFiles.map((file) => {
        const isSelected = selected?.has(file.id) ?? false;
        const showCheckbox = !!onToggleSelect;
        const isImage = file.public_url && file.mime_type.startsWith('image/');

        return (
          <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }} key={file.id} sx={{ display: 'flex' }}>
            <DraggableMediaCard file={file}>
              <Box
                data-testid="media-item"
                onClick={selectionMode && onToggleSelect ? () => onToggleSelect(file.id) : undefined}
                sx={{
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  bgcolor: 'var(--surface-container)',
                  borderRadius: '20px',
                  border: '1px solid var(--outline-variant)',
                  overflow: 'hidden',
                  cursor: selectionMode ? 'pointer' : 'default',
                  position: 'relative',
                  outline: isSelected ? '2px solid var(--primary)' : 'none',
                  outlineOffset: isSelected ? -1 : 0,
                  transition:
                    'border-color 200ms cubic-bezier(0.2, 0, 0, 1), transform 200ms cubic-bezier(0.2, 0, 0, 1)',
                  '&:hover': {
                    borderColor: 'var(--outline)',
                    transform: 'translateY(-2px)',
                  },
                  '&:hover .media-actions, &:focus-within .media-actions': { opacity: 1, pointerEvents: 'auto' },
                  '&:hover .media-checkbox, &:focus-within .media-checkbox': { opacity: 1 },
                }}
              >
                <Box
                  sx={{
                    position: 'relative',
                    aspectRatio: '4 / 3',
                    bgcolor: 'var(--surface-container-high)',
                    display: 'flex',
                    justifyContent: 'center',
                    alignItems: 'center',
                    overflow: 'hidden',
                    flexShrink: 0,
                  }}
                >
                  {isImage ? (
                    <Box
                      component="img"
                      src={file.public_url!}
                      alt={file.original_filename}
                      sx={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        objectPosition: `${(file.focal_x ?? 0.5) * 100}% ${(file.focal_y ?? 0.5) * 100}%`,
                      }}
                    />
                  ) : (
                    getMimeIcon(file.mime_type)
                  )}

                  {file.has_alt_text && (
                    <Box
                      aria-label="Has alt text"
                      sx={{
                        position: 'absolute',
                        top: 10,
                        right: 10,
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
                  )}

                  {showCheckbox && (
                    <Checkbox
                      className="media-checkbox"
                      checked={isSelected}
                      onClick={(e) => e.stopPropagation()}
                      onChange={() => onToggleSelect?.(file.id)}
                      size="small"
                      sx={{
                        position: 'absolute',
                        top: 6,
                        left: 6,
                        opacity: isSelected ? 1 : 0,
                        transition: 'opacity 160ms cubic-bezier(0.2, 0, 0, 1)',
                        bgcolor: 'rgba(255,255,255,0.9)',
                        borderRadius: '8px',
                        p: 0.25,
                        '&:hover': { bgcolor: 'rgba(255,255,255,1)' },
                      }}
                    />
                  )}

                  {(canWrite || isAdmin) && (
                    <Box
                      className="media-actions"
                      onClick={(e) => e.stopPropagation()}
                      sx={{
                        position: 'absolute',
                        left: 10,
                        right: 10,
                        bottom: 10,
                        display: 'flex',
                        gap: 0.5,
                        justifyContent: 'flex-end',
                        alignItems: 'center',
                        p: 0.5,
                        bgcolor: 'color-mix(in oklch, var(--surface-container) 85%, transparent)',
                        color: 'var(--on-surface)',
                        borderRadius: '14px',
                        backdropFilter: 'blur(12px)',
                        border: '1px solid var(--outline-variant)',
                        opacity: 0,
                        pointerEvents: 'none',
                        transition: 'opacity 180ms cubic-bezier(0.2, 0, 0, 1)',
                      }}
                    >
                      <M3IconButton
                        name="edit"
                        size={34}
                        tooltip={t('common.actions.edit')}
                        onClick={() => onEditFile(file)}
                      />
                      {file.public_url && (
                        <>
                          <M3IconButton
                            name="content_copy"
                            size={34}
                            tooltip={t('media.copyUrl')}
                            onClick={() => navigator.clipboard.writeText(file.public_url!)}
                          />
                          <M3IconButton
                            name="open_in_new"
                            size={34}
                            tooltip={t('media.openUrl')}
                            onClick={() => window.open(file.public_url!, '_blank')}
                          />
                        </>
                      )}
                      {isAdmin && (
                        <M3IconButton
                          name="delete"
                          size={34}
                          tooltip={t('common.actions.delete')}
                          ariaLabel={t('common.actions.delete')}
                          onClick={() => onDeleteFile(file)}
                        />
                      )}
                    </Box>
                  )}
                </Box>

                <Box sx={{ px: 2, py: 1.5, minWidth: 0 }}>
                  <Box
                    component="span"
                    title={file.original_filename}
                    sx={{
                      display: 'block',
                      fontSize: 14,
                      fontWeight: 600,
                      color: 'var(--on-surface)',
                      fontVariationSettings: '"wght" 600, "opsz" 14',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {file.original_filename}
                  </Box>
                  <Box
                    component="span"
                    sx={{
                      display: 'block',
                      mt: 0.25,
                      fontSize: 12,
                      color: 'var(--on-surface-variant)',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {formatFileSize(file.file_size)} &middot; {fmt(file.created_at, 'PP')}
                  </Box>
                </Box>
              </Box>
            </DraggableMediaCard>
          </Grid>
        );
      })}
    </Grid>
  );
}
