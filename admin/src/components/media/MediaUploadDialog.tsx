import { useCallback, useEffect, useRef, useState } from 'react';
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

export default function MediaUploadDialog({ open, onSubmit, onClose, loading }: MediaUploadDialogProps) {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const [isGlobal, setIsGlobal] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Reset state when dialog opens/closes
  useEffect(() => {
    if (open) {
      setSelectedFile(null);
      setPreview(null);
      setDragOver(false);
      setIsGlobal(false);
      setUploadProgress(null);
      setValidationError(null);
    }
  }, [open]);

  // Generate image preview
  useEffect(() => {
    if (!selectedFile) {
      setPreview(null);
      return;
    }
    if (!selectedFile.type.startsWith('image/')) {
      setPreview(null);
      return;
    }
    const url = URL.createObjectURL(selectedFile);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [selectedFile]);

  const validateFile = useCallback((file: File): boolean => {
    setValidationError(null);
    if (file.size > MAX_FILE_SIZE) {
      setValidationError(t('media.upload.tooLarge', { maxSize: formatFileSize(MAX_FILE_SIZE) }));
      return false;
    }
    if (ACCEPTED_TYPES.length > 0 && !ACCEPTED_TYPES.includes(file.type)) {
      // Allow files with no MIME type (will be detected server-side)
      if (file.type) {
        setValidationError(t('media.upload.invalidType'));
        return false;
      }
    }
    return true;
  }, [t]);

  const handleFileSelect = useCallback((file: File) => {
    if (validateFile(file)) {
      setSelectedFile(file);
    }
  }, [validateFile]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragOver(false);
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
    if (!selectedFile) return;
    setUploadProgress(0);
    await onSubmit(selectedFile, isGlobal);
    setUploadProgress(null);
  };

  const isUploading = loading || uploadProgress !== null;

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
              borderColor: dragOver ? 'primary.main' : validationError ? 'error.main' : 'divider',
              borderRadius: 2,
              p: 4,
              textAlign: 'center',
              cursor: isUploading ? 'default' : 'pointer',
              bgcolor: dragOver ? 'action.hover' : 'background.default',
              transition: 'all 0.2s ease',
              '&:hover': !isUploading ? { borderColor: 'primary.main', bgcolor: 'action.hover' } : {},
            }}
          >
            {selectedFile ? (
              <Stack spacing={1} alignItems="center">
                {preview ? (
                  <Box
                    component="img"
                    src={preview}
                    alt={selectedFile.name}
                    sx={{ maxWidth: 200, maxHeight: 150, objectFit: 'contain', borderRadius: 1 }}
                  />
                ) : (
                  <InsertDriveFileIcon sx={{ fontSize: 48 }} color="action" />
                )}
                <Typography variant="body2" fontWeight={500}>{selectedFile.name}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {formatFileSize(selectedFile.size)} &middot; {selectedFile.type || 'unknown type'}
                </Typography>
              </Stack>
            ) : (
              <Stack spacing={1} alignItems="center">
                <CloudUploadIcon sx={{ fontSize: 48 }} color={dragOver ? 'primary' : 'action'} />
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

          {validationError && (
            <Typography variant="body2" color="error">{validationError}</Typography>
          )}

          {/* Upload progress */}
          {isUploading && (
            <Box>
              <LinearProgress
                variant={uploadProgress !== null && uploadProgress > 0 ? 'determinate' : 'indeterminate'}
                value={uploadProgress ?? 0}
              />
              <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block', textAlign: 'center' }}>
                {uploadProgress !== null && uploadProgress > 0
                  ? t('media.upload.progress', { percent: Math.round(uploadProgress) })
                  : t('media.upload.uploading')}
              </Typography>
            </Box>
          )}

          <FormControlLabel
            control={<Switch checked={isGlobal} onChange={(e) => setIsGlobal(e.target.checked)} disabled={isUploading} />}
            label={t('common.labels.global')}
          />
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={isUploading}>{t('common.actions.cancel')}</Button>
        <Button
          variant="contained"
          onClick={handleSubmit}
          disabled={!selectedFile || isUploading}
          startIcon={<CloudUploadIcon />}
        >
          {isUploading ? t('media.upload.uploading') : t('common.actions.upload')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
