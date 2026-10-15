import { Box, FormControl, InputLabel, MenuItem, Select, Typography } from '@mui/material';
import ImageIcon from '@mui/icons-material/Image';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import { useSnackbar } from 'notistack';
import { useTranslation } from 'react-i18next';
import { M3IconButton } from '@/components/design-system';
import type { MediaFolder, MediaListItem } from '@/types/api';
import { formatBytes } from '@/utils/formatBytes';
import FocalPointPicker from '../FocalPointPicker';
import { useMediaFolderSelection } from './useMediaFileSettings';

interface MediaPreviewProps {
  media: MediaListItem;
  isImage: boolean;
  focalSaving: boolean;
  onFocalPointSave: (x: number, y: number) => void;
}

/** Focal-point picker for hosted images, otherwise a type icon. */
function MediaPreview({ media, isImage, focalSaving, onFocalPointSave }: MediaPreviewProps) {
  if (media.public_url && isImage) {
    return (
      <FocalPointPicker
        key={`${media.focal_x}-${media.focal_y}`}
        src={media.public_url}
        focalX={media.focal_x}
        focalY={media.focal_y}
        saving={focalSaving}
        onSave={onFocalPointSave}
      />
    );
  }
  return isImage
    ? <ImageIcon sx={{ fontSize: 80 }} color="primary" />
    : <InsertDriveFileIcon sx={{ fontSize: 80 }} color="action" />;
}

/** File info — definition list rendered as tokenised rows. */
function MediaFileInfo({ media }: { media: MediaListItem }) {
  const { t } = useTranslation();
  const rows = [
    { label: t('forms.mediaDetail.info.filename', 'Filename'), value: media.original_filename, wrap: true },
    { label: t('forms.mediaDetail.info.type', 'Type'), value: media.mime_type },
    { label: t('forms.mediaDetail.info.size', 'Size'), value: formatBytes(media.file_size) },
    ...(media.width && media.height
      ? [{ label: t('forms.mediaDetail.info.dimensions', 'Dimensions'), value: `${media.width} × ${media.height}` }]
      : []),
  ];

  return (
    <Box
      sx={{
        mt: 2,
        bgcolor: 'var(--surface-container)',
        border: '1px solid var(--outline-variant)',
        borderRadius: '16px',
        px: 1.5,
        py: 0.5,
      }}
    >
      {rows.map((row, i, arr) => (
        <Box
          key={row.label}
          sx={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            gap: 1.5,
            py: 1,
            borderBottom: i === arr.length - 1 ? 'none' : '1px solid var(--outline-variant)',
          }}
        >
          <Box component="span" sx={{ fontSize: 12, color: 'var(--on-surface-variant)' }}>
            {row.label}
          </Box>
          <Box
            component="span"
            sx={{
              fontSize: 13,
              color: 'var(--on-surface)',
              textAlign: 'right',
              wordBreak: row.wrap ? 'break-all' : 'normal',
              fontVariationSettings: '"wght" 500, "opsz" 13',
            }}
          >
            {row.value}
          </Box>
        </Box>
      ))}
    </Box>
  );
}

/** Public URL — click to copy. */
function MediaPublicUrl({ url }: { url: string }) {
  const { t } = useTranslation();
  const { enqueueSnackbar } = useSnackbar();

  return (
    <Box
      sx={{
        mt: 1.5,
        display: 'flex',
        alignItems: 'center',
        gap: 0.5,
        px: 1,
        py: 0.5,
        bgcolor: 'var(--surface-container-high)',
        border: '1px solid var(--outline-variant)',
        borderRadius: '10px',
      }}
    >
      <Typography
        variant="caption"
        sx={{
          flexGrow: 1,
          color: 'var(--on-surface-variant)',
          wordBreak: 'break-all',
          fontSize: 11,
        }}
      >
        {url}
      </Typography>
      <M3IconButton
        name="content_copy"
        size={28}
        tooltip={t('media.copyUrl')}
        onClick={() => {
          navigator.clipboard.writeText(url);
          enqueueSnackbar(t('media.urlCopied', 'URL copied'), { variant: 'success' });
        }}
      />
    </Box>
  );
}

interface MediaFolderSelectProps {
  media: MediaListItem;
  folders: MediaFolder[];
  siteId: string;
}

/** Folder selector — moves the file as soon as a folder is picked. */
function MediaFolderSelect({ media, folders, siteId }: MediaFolderSelectProps) {
  const { t } = useTranslation();
  const { selectedFolderId, handleFolderChange } = useMediaFolderSelection(media, siteId);

  return (
    <FormControl fullWidth size="small" sx={{ mt: 2 }}>
      <InputLabel>{t('forms.mediaDetail.fields.folder')}</InputLabel>
      <Select
        value={folders.some((f) => f.id === selectedFolderId) ? selectedFolderId : ''}
        label={t('forms.mediaDetail.fields.folder')}
        onChange={(e) => handleFolderChange(e.target.value)}
      >
        <MenuItem value="">{t('forms.mediaDetail.fields.noFolder')}</MenuItem>
        {folders.map((f) => (
          <MenuItem key={f.id} value={f.id}>{f.name}</MenuItem>
        ))}
      </Select>
    </FormControl>
  );
}

type MediaDetailSidebarProps = MediaPreviewProps & MediaFolderSelectProps;

/** Left column of the media detail dialog: preview, file info, folder, URL. */
export default function MediaDetailSidebar({
  media,
  isImage,
  focalSaving,
  onFocalPointSave,
  folders,
  siteId,
}: MediaDetailSidebarProps) {
  return (
    <Box sx={{ width: 280, flexShrink: 0 }}>
      <MediaPreview media={media} isImage={isImage} focalSaving={focalSaving} onFocalPointSave={onFocalPointSave} />

      <MediaFileInfo media={media} />

      <MediaFolderSelect media={media} folders={folders} siteId={siteId} />

      {media.public_url && <MediaPublicUrl url={media.public_url} />}
    </Box>
  );
}
