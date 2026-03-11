import { useCallback, useEffect, useMemo, useReducer, useRef } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  LinearProgress,
  Stack,
  Switch,
  Typography,
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import { useTranslation } from 'react-i18next';
import type { MediaResponse } from '@/types/api';

interface MediaUploadDialogProps {
  open: boolean;
  onSubmit: (file: File, isGlobal: boolean) => Promise<MediaResponse | void>;
  onClose: () => void;
  loading?: boolean;
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

const ACCEPTED_TYPES = [
  'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/avif', 'image/svg+xml',
  'application/pdf', 'text/plain', 'text/markdown',
  'video/mp4', 'video/webm',
  'audio/mpeg', 'audio/wav', 'audio/ogg',
];

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

export default function MediaUploadDialog({ open, onSubmit, onClose, loading }: MediaUploadDialogProps) {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [state, dispatch] = useReducer(uploadReducer, initialUploadState);

  // Reset state when dialog opens
  const prevOpenRef = useRef(false);
  if (open && !prevOpenRef.current) {
    dispatch({ type: 'RESET' });
  }
  prevOpenRef.current = open;

  // Derive image preview URL from selected file (with cleanup for object URLs)
  const preview = useMemo(
    () => state.selectedFile?.type.startsWith('image/') ? URL.createObjectURL(state.selectedFile) : null,
    [state.selectedFile],
  );
  useEffect(() => {
    return () => { if (preview) URL.revokeObjectURL(preview); };
  }, [preview]);

  const validateFile = useCallback((file: File): boolean => {
    if (file.size > MAX_FILE_SIZE) {
      dispatch({ type: 'SET_VALIDATION_ERROR', error: t('media.upload.tooLarge', { maxSize: formatFileSize(MAX_FILE_SIZE) }) });
      return false;
    }
    if (ACCEPTED_TYPES.length > 0 && !ACCEPTED_TYPES.includes(file.type)) {
      // Allow files with no MIME type (will be detected server-side)
      if (file.type) {
        dispatch({ type: 'SET_VALIDATION_ERROR', error: t('media.upload.invalidType') });
        return false;
      }
    }
    return true;
  }, [t]);

  const handleFileSelect = useCallback((file: File) => {
    if (validateFile(file)) {
      dispatch({ type: 'SET_FILE', file });
    }
  }, [validateFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dispatch({ type: 'SET_DRAG_OVER', value: true });
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dispatch({ type: 'SET_DRAG_OVER', value: false });
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dispatch({ type: 'SET_DRAG_OVER', value: false });
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }, [handleFileSelect]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
    // Reset input so re-selecting the same file triggers onChange
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [handleFileSelect]);

  const handleSubmit = async () => {
    if (!state.selectedFile) return;
    dispatch({ type: 'SET_UPLOAD_PROGRESS', value: 0 });
    await onSubmit(state.selectedFile, state.isGlobal);
    dispatch({ type: 'SET_UPLOAD_PROGRESS', value: null });
  };

  const isUploading = loading || state.uploadProgress !== null;

  return (
    <Dialog open={open} onClose={isUploading ? undefined : onClose} maxWidth="sm" fullWidth aria-labelledby="media-upload-title">
      <DialogTitle id="media-upload-title">{t('forms.mediaUpload.title')}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {/* Drop zone */}
          <Box
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => !isUploading && fileInputRef.current?.click()}
            sx={{
              border: '2px dashed',
              borderColor: state.dragOver ? 'primary.main' : state.validationError ? 'error.main' : 'divider',
              borderRadius: 2,
              p: 4,
              textAlign: 'center',
              cursor: isUploading ? 'default' : 'pointer',
              bgcolor: state.dragOver ? 'action.hover' : 'background.default',
              transition: 'all 0.2s ease',
              '&:hover': !isUploading ? { borderColor: 'primary.main', bgcolor: 'action.hover' } : {},
            }}
          >
            {state.selectedFile ? (
              <Stack spacing={1} alignItems="center">
                {preview ? (
                  <Box
                    component="img"
                    src={preview}
                    alt={state.selectedFile.name}
                    sx={{ maxWidth: 200, maxHeight: 150, objectFit: 'contain', borderRadius: 1 }}
                  />
                ) : (
                  <InsertDriveFileIcon sx={{ fontSize: 48 }} color="action" />
                )}
                <Typography variant="body2" fontWeight={500}>{state.selectedFile.name}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {formatFileSize(state.selectedFile.size)} &middot; {state.selectedFile.type || 'unknown type'}
                </Typography>
              </Stack>
            ) : (
              <Stack spacing={1} alignItems="center">
                <CloudUploadIcon sx={{ fontSize: 48 }} color={state.dragOver ? 'primary' : 'action'} />
                <Typography variant="body1" color="text.secondary">
                  {t('media.upload.dragDrop')}
                </Typography>
              </Stack>
            )}
          </Box>

          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_TYPES.join(',')}
            style={{ display: 'none' }}
            onChange={handleInputChange}
          />

          {state.validationError && (
            <Typography variant="body2" color="error">{state.validationError}</Typography>
          )}

          {/* Upload progress */}
          {isUploading && (
            <Box>
              <LinearProgress
                variant={state.uploadProgress !== null && state.uploadProgress > 0 ? 'determinate' : 'indeterminate'}
                value={state.uploadProgress ?? 0}
              />
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block', textAlign: 'center' }}>
                {state.uploadProgress !== null && state.uploadProgress > 0
                  ? t('media.upload.progress', { percent: Math.round(state.uploadProgress) })
                  : t('media.upload.uploading')}
              </Typography>
            </Box>
          )}

          <FormControlLabel
            control={<Switch checked={state.isGlobal} onChange={(e) => dispatch({ type: 'SET_IS_GLOBAL', value: e.target.checked })} disabled={isUploading} />}
            label={t('common.labels.global')}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={isUploading}>{t('common.actions.cancel')}</Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={!state.selectedFile || isUploading}
          startIcon={<CloudUploadIcon />}
        >
          {isUploading ? t('media.upload.uploading') : t('common.actions.upload')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
