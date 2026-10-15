import { useCallback } from 'react';
import {
  Alert,
  Box,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import LinkIcon from '@mui/icons-material/Link';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import type { UseFormRegister, FieldErrors } from 'react-hook-form';
import type { DocumentResponse } from '@/types/api';
import FileDropZone, { DropZoneFileContent } from '@/components/shared/FileDropZone';
import { formatBytes } from '@/utils/formatBytes';
import { useTranslation } from 'react-i18next';

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

  const handleSourceTypeChange = (_: React.MouseEvent<HTMLElement>, value: string | null) => {
    if (value === 'link' || value === 'upload') {
      onSourceTypeChange(value);
      onFileSelect(null);
      onFileError(null);
    }
  };

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
        <DocumentUploadField
          selectedFile={selectedFile}
          onFileSelect={onFileSelect}
          fileError={fileError}
          onFileError={onFileError}
          dragOver={dragOver}
          onDragOver={onDragOver}
          currentFile={isEditing && !selectedFile ? storedFileOf(document) : null}
        />
      )}
    </>
  );
}

/** The already-stored file of a document, when it has one with a name. */
function storedFileOf(document: DocumentResponse | null | undefined): { name: string; size?: number | null } | null {
  if (!document?.has_file || !document.file_name) return null;
  return { name: document.file_name, size: document.file_size };
}

type DocumentUploadFieldProps = Pick<
  DocumentSourceSectionProps,
  'selectedFile' | 'onFileSelect' | 'fileError' | 'onFileError' | 'dragOver' | 'onDragOver'
> & {
  /** File already stored on the document being edited (shown until replaced). */
  currentFile: { name: string; size?: number | null } | null;
};

function DocumentUploadField({
  selectedFile,
  onFileSelect,
  fileError,
  onFileError,
  dragOver,
  onDragOver,
  currentFile,
}: DocumentUploadFieldProps) {
  const { t } = useTranslation();

  const validateAndSelect = useCallback((file: File) => {
    onFileError(null);
    if (file.size > MAX_FILE_SIZE) {
      onFileError(t('media.upload.tooLarge', { maxSize: formatBytes(MAX_FILE_SIZE) }));
      onFileSelect(null);
      return;
    }
    onFileSelect(file);
  }, [onFileSelect, onFileError, t]);

  return (
    <Box>
      {currentFile && (
        <Alert severity="info" sx={{ mb: 1 }}>
          {t('forms.document.currentFile')}: <strong>{currentFile.name}</strong>
          {currentFile.size && ` (${formatBytes(currentFile.size)})`}
        </Alert>
      )}

      <FileDropZone
        onFile={validateAndSelect}
        dragOver={dragOver}
        onDragOverChange={onDragOver}
        hasError={!!fileError}
        padding={3}
        inputTestId="document-upload-input"
      >
        <DropZoneFileContent file={selectedFile} dragOver={dragOver} previewMaxHeight={120} />
      </FileDropZone>

      {fileError && (
        <Typography variant="body2" color="error" sx={{ mt: 1 }}>
          {fileError}
        </Typography>
      )}
    </Box>
  );
}
