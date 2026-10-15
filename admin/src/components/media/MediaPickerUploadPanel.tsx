import { CircularProgress, LinearProgress, Stack, Typography } from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import { useTranslation } from 'react-i18next';
import FileDropZone from '@/components/shared/FileDropZone';
import { ACCEPTED_IMAGE_TYPES } from './mediaFileValidation';

interface MediaPickerUploadPanelProps {
  dragOver: boolean;
  onDragOverChange: (dragOver: boolean) => void;
  uploading: boolean;
  uploadError: string | null;
  onFile: (file: File) => void;
}

/** Upload tab of the media picker: image drop zone with progress and errors. */
export default function MediaPickerUploadPanel({
  dragOver,
  onDragOverChange,
  uploading,
  uploadError,
  onFile,
}: MediaPickerUploadPanelProps) {
  const { t } = useTranslation();

  return (
    <Stack spacing={2}>
      <FileDropZone
        onFile={onFile}
        dragOver={dragOver}
        onDragOverChange={onDragOverChange}
        hasError={!!uploadError}
        disabled={uploading}
        padding={6}
        accept={ACCEPTED_IMAGE_TYPES.join(',')}
        inputTestId="media-picker.upload.input"
        dropZoneTestId="media-picker.upload.dropzone"
      >
        {uploading ? (
          <Stack spacing={1.5} sx={{ alignItems: "center" }}>
            <CircularProgress size={48} />
            <Typography variant="body1" color="text.secondary">
              {t('editor.mediaPicker.upload.uploading')}
            </Typography>
          </Stack>
        ) : (
          <Stack spacing={1} sx={{ alignItems: "center" }}>
            <CloudUploadIcon sx={{ fontSize: 48 }} color={dragOver ? 'primary' : 'action'} />
            <Typography variant="body1" color="text.secondary">
              {t('editor.mediaPicker.upload.dragDrop')}
            </Typography>
            <Typography variant="caption" color="text.disabled">
              JPEG, PNG, GIF, WebP, AVIF, SVG
            </Typography>
          </Stack>
        )}
      </FileDropZone>

      {uploading && <LinearProgress />}

      {uploadError && (
        <Typography variant="body2" color="error" data-testid="media-picker.upload.error">
          {uploadError}
        </Typography>
      )}
    </Stack>
  );
}
