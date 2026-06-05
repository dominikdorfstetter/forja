import { useCallback, useEffect, useMemo, useRef } from 'react';
import {
  Alert,
  Box,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import LinkIcon from '@mui/icons-material/Link';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import type { UseFormRegister, FieldErrors } from 'react-hook-form';
import type { DocumentResponse } from '@/types/api';
import { useTranslation } from 'react-i18next';

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

interface DocumentSourceSectionProps {
  sourceType: 'link' | 'upload';
  onSourceTypeChange: (value: 'link' | 'upload') => void;
  selectedFile: File | null;
  onFileSelect: (file: File | null) => void;
  fileError: string | null;
  onFileError: (error: string | null) => void;
  dragOver: boolean;
  onDragOver: (value: boolean) => void;
  document?: DocumentResponse | null;
  isEditing: boolean;
  register: UseFormRegister<never>;
  errors: FieldErrors;
}

export default function DocumentSourceSection({
  sourceType,
  onSourceTypeChange,
  selectedFile,
  onFileSelect,
  fileError,
  onFileError,
  dragOver,
  onDragOver,
  document,
  isEditing,
  register,
  errors,
}: DocumentSourceSectionProps) {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const preview = useMemo(
    () => selectedFile?.type.startsWith('image/') ? URL.createObjectURL(selectedFile) : null,
    [selectedFile],
  );
  useEffect(() => {
    return () => { if (preview) URL.revokeObjectURL(preview); };
  }, [preview]);

  const handleSourceTypeChange = (_: React.MouseEvent<HTMLElement>, value: string | null) => {
    if (value === 'link' || value === 'upload') {
      onSourceTypeChange(value);
      onFileSelect(null);
      onFileError(null);
    }
  };

  const validateAndSelect = useCallback((file: File) => {
    onFileError(null);
    if (file.size > MAX_FILE_SIZE) {
      onFileError(t('media.upload.tooLarge', { maxSize: formatFileSize(MAX_FILE_SIZE) }));
      onFileSelect(null);
      return;
    }
    onFileSelect(file);
  }, [onFileSelect, onFileError, t]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onDragOver(true);
  }, [onDragOver]);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onDragOver(false);
  }, [onDragOver]);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    onDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) validateAndSelect(file);
  }, [validateAndSelect, onDragOver]);

  const handleInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) validateAndSelect(file);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [validateAndSelect]);

  return (
    <>
      <Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          {t('forms.document.fields.sourceType')}
        </Typography>
        <ToggleButtonGroup
          value={sourceType}
          exclusive
          onChange={handleSourceTypeChange}
          size="small"
          fullWidth
        >
          <ToggleButton value="link">
            <LinkIcon sx={{ mr: 0.5 }} fontSize="small" />
            {t('forms.document.source.link')}
          </ToggleButton>
          <ToggleButton value="upload">
            <UploadFileIcon sx={{ mr: 0.5 }} fontSize="small" />
            {t('forms.document.source.upload')}
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {sourceType === 'link' && (
        <TextField
          label="URL"
          fullWidth
          required
          {...register('url' as never)}
          error={!!errors.url}
          helperText={(errors.url?.message as string) || t('forms.document.fields.urlHelp')}
        />
      )}

      {sourceType === 'upload' && (
        <Box>
          {isEditing && document?.has_file && document?.file_name && !selectedFile && (
            <Alert severity="info" sx={{ mb: 1 }}>
              {t('forms.document.currentFile')}: <strong>{document.file_name}</strong>
              {document.file_size && ` (${formatFileSize(document.file_size)})`}
            </Alert>
          )}

          <Box
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            onClick={() => fileInputRef.current?.click()}
            sx={{
              border: '2px dashed',
              borderColor: dragOver ? 'primary.main' : fileError ? 'error.main' : 'divider',
              borderRadius: 2,
              p: 3,
              textAlign: 'center',
              cursor: 'pointer',
              bgcolor: dragOver ? 'action.hover' : 'background.default',
              transition: 'all 0.2s ease',
              '&:hover': { borderColor: 'primary.main', bgcolor: 'action.hover' },
            }}
          >
            {selectedFile ? (
              <Stack spacing={1} sx={{ alignItems: "center" }}>
                {preview ? (
                  <Box
                    component="img"
                    src={preview}
                    alt={selectedFile.name}
                    sx={{ maxWidth: 200, maxHeight: 120, objectFit: 'contain', borderRadius: 1 }}
                  />
                ) : (
                  <InsertDriveFileIcon sx={{ fontSize: 48 }} color="action" />
                )}
                <Typography variant="body2" sx={{ fontWeight: 500 }}>{selectedFile.name}</Typography>
                <Typography variant="caption" color="text.secondary">
                  {formatFileSize(selectedFile.size)} &middot; {selectedFile.type || 'unknown type'}
                </Typography>
              </Stack>
            ) : (
              <Stack spacing={1} sx={{ alignItems: "center" }}>
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
            style={{ display: 'none' }}
            onChange={handleInputChange}
            aria-label={t('common.actions.selectFile')}
            data-testid="document-upload-input"
          />

          {fileError && (
            <Typography variant="body2" color="error" sx={{ mt: 1 }}>
              {fileError}
            </Typography>
          )}
        </Box>
      )}
    </>
  );
}
