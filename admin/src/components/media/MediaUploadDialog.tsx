import { useCallback, useEffect, useReducer, useRef } from 'react';
import {
  Box,
  FormControlLabel,
  LinearProgress,
  Stack,
  Switch,
  Typography,
} from '@mui/material';
import FormDialog from '@/components/shared/FormDialog';
import FileDropZone, { DropZoneFileContent } from '@/components/shared/FileDropZone';
import { useTranslation } from 'react-i18next';
import type { MediaResponse } from '@/types/api';
import { formatBytes } from '@/utils/formatBytes';
import { ACCEPTED_MEDIA_TYPES, MAX_MEDIA_FILE_SIZE, checkMediaFile } from './mediaFileValidation';

interface MediaUploadDialogProps {
  open: boolean;
  onSubmit: (file: File, isGlobal: boolean) => Promise<MediaResponse | void>;
  onClose: () => void;
  loading?: boolean;
}

// --- Reducer ---

interface UploadState {
  selectedFile: File | null;
  dragOver: boolean;
  isGlobal: boolean;
  uploadProgress: number | null;
  validationError: string | null;
}

type UploadAction =
  | { type: 'RESET' }
  | { type: 'SET_FILE'; file: File }
  | { type: 'SET_DRAG_OVER'; value: boolean }
  | { type: 'SET_IS_GLOBAL'; value: boolean }
  | { type: 'SET_UPLOAD_PROGRESS'; value: number | null }
  | { type: 'SET_VALIDATION_ERROR'; error: string };

const initialUploadState: UploadState = {
  selectedFile: null,
  dragOver: false,
  isGlobal: false,
  uploadProgress: null,
  validationError: null,
};

function uploadReducer(state: UploadState, action: UploadAction): UploadState {
  switch (action.type) {
    case 'RESET':
      return initialUploadState;
    case 'SET_FILE':
      return { ...state, selectedFile: action.file, validationError: null };
    case 'SET_DRAG_OVER':
      return { ...state, dragOver: action.value };
    case 'SET_IS_GLOBAL':
      return { ...state, isGlobal: action.value };
    case 'SET_UPLOAD_PROGRESS':
      return { ...state, uploadProgress: action.value };
    case 'SET_VALIDATION_ERROR':
      return { ...state, validationError: action.error, selectedFile: null };
  }
}

function UploadProgress({ progress }: { progress: number | null }) {
  const { t } = useTranslation();
  const hasProgress = progress !== null && progress > 0;

  return (
    <Box>
      <LinearProgress
        variant={hasProgress ? 'determinate' : 'indeterminate'}
        value={progress ?? 0}
      />
      <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block', textAlign: 'center' }}>
        {hasProgress
          ? t('media.upload.progress', { percent: Math.round(progress) })
          : t('media.upload.uploading')}
      </Typography>
    </Box>
  );
}

export default function MediaUploadDialog({ open, onSubmit, onClose, loading }: MediaUploadDialogProps) {
  const { t } = useTranslation();
  const [state, dispatch] = useReducer(uploadReducer, initialUploadState);

  // Reset state when dialog opens
  const prevOpenRef = useRef(false);
  useEffect(() => {
    if (open && !prevOpenRef.current) {
      dispatch({ type: 'RESET' });
    }
    prevOpenRef.current = open;
  });

  const handleFileSelect = useCallback((file: File) => {
    const issue = checkMediaFile(file, ACCEPTED_MEDIA_TYPES);
    if (issue === 'tooLarge') {
      dispatch({ type: 'SET_VALIDATION_ERROR', error: t('media.upload.tooLarge', { maxSize: formatBytes(MAX_MEDIA_FILE_SIZE) }) });
    } else if (issue === 'invalidType') {
      dispatch({ type: 'SET_VALIDATION_ERROR', error: t('media.upload.invalidType') });
    } else {
      dispatch({ type: 'SET_FILE', file });
    }
  }, [t]);

  const handleDragOverChange = useCallback((value: boolean) => {
    dispatch({ type: 'SET_DRAG_OVER', value });
  }, []);

  const handleSubmit = async () => {
    if (!state.selectedFile) return;
    dispatch({ type: 'SET_UPLOAD_PROGRESS', value: 0 });
    await onSubmit(state.selectedFile, state.isGlobal);
    dispatch({ type: 'SET_UPLOAD_PROGRESS', value: null });
  };

  const isUploading = loading || state.uploadProgress !== null;

  return (
    <FormDialog
      open={open}
      onClose={isUploading ? () => {} : onClose}
      onSubmit={handleSubmit}
      icon="cloud_upload"
      title={t('forms.mediaUpload.title')}
      submitLabel={isUploading ? t('media.upload.uploading') : t('common.actions.upload')}
      submitDisabled={!state.selectedFile}
      loading={isUploading}
    >
        <Stack spacing={2}>
          <FileDropZone
            onFile={handleFileSelect}
            dragOver={state.dragOver}
            onDragOverChange={handleDragOverChange}
            hasError={!!state.validationError}
            disabled={isUploading}
            padding={4}
            accept={ACCEPTED_MEDIA_TYPES.join(',')}
            inputTestId="media-upload-input"
          >
            <DropZoneFileContent file={state.selectedFile} dragOver={state.dragOver} previewMaxHeight={150} />
          </FileDropZone>

          {state.validationError && (
            <Typography variant="body2" color="error">{state.validationError}</Typography>
          )}

          {isUploading && <UploadProgress progress={state.uploadProgress} />}

          <FormControlLabel
            control={<Switch checked={state.isGlobal} onChange={(e) => dispatch({ type: 'SET_IS_GLOBAL', value: e.target.checked })} disabled={isUploading} />}
            label={t('common.labels.global')}
          />
        </Stack>
    </FormDialog>
  );
}
