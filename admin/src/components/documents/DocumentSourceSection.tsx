import { useRef } from 'react';
import {
  Alert,
  Box,
  Button,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';
import LinkIcon from '@mui/icons-material/Link';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import type { UseFormRegister, FieldErrors } from 'react-hook-form';
import type { DocumentResponse } from '@/types/api';

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB
const ACCEPTED_FILE_TYPES = '.pdf,.doc,.docx,.xlsx,.xls,.zip,.txt,.csv,.pptx,.ppt';

interface DocumentSourceSectionProps {
  sourceType: 'link' | 'upload';
  onSourceTypeChange: (value: 'link' | 'upload') => void;
  selectedFile: File | null;
  onFileSelect: (file: File | null) => void;
  fileError: string | null;
  onFileError: (error: string | null) => void;
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
  document,
  isEditing,
  register,
  errors,
}: DocumentSourceSectionProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleSourceTypeChange = (_: React.MouseEvent<HTMLElement>, value: string | null) => {
    if (value === 'link' || value === 'upload') {
      onSourceTypeChange(value);
      onFileSelect(null);
      onFileError(null);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    onFileError(null);

    if (!file) {
      onFileSelect(null);
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      onFileError(`File too large (${formatFileSize(file.size)}). Maximum is ${formatFileSize(MAX_FILE_SIZE)}.`);
      onFileSelect(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    onFileSelect(file);
  };

  return (
    <>
      {/* Source Type Toggle */}
      <Box>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
          Source Type
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
            Link
          </ToggleButton>
          <ToggleButton value="upload">
            <UploadFileIcon sx={{ mr: 0.5 }} fontSize="small" />
            Upload
          </ToggleButton>
        </ToggleButtonGroup>
      </Box>

      {/* Link mode: URL field */}
      {sourceType === 'link' && (
        <TextField
          label="URL"
          fullWidth
          required
          {...register('url' as never)}
          error={!!errors.url}
          helperText={(errors.url?.message as string) || 'Full URL to the document or resource'}
        />
      )}

      {/* Upload mode: file input */}
      {sourceType === 'upload' && (
        <Box>
          {isEditing && document?.has_file && document?.file_name && !selectedFile && (
            <Alert severity="info" sx={{ mb: 1 }}>
              Current file: <strong>{document.file_name}</strong>
              {document.file_size && ` (${formatFileSize(document.file_size)})`}
            </Alert>
          )}
          <Button
            variant="outlined"
            component="label"
            startIcon={<UploadFileIcon />}
            fullWidth
          >
            {selectedFile ? selectedFile.name : 'Choose File'}
            <input
              ref={fileInputRef}
              type="file"
              hidden
              accept={ACCEPTED_FILE_TYPES}
              onChange={handleFileSelect}
            />
          </Button>
          {selectedFile && (
            <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
              {formatFileSize(selectedFile.size)} &middot; {selectedFile.type || 'unknown type'}
            </Typography>
          )}
          {fileError && (
            <Typography variant="caption" color="error" sx={{ mt: 0.5, display: 'block' }}>
              {fileError}
            </Typography>
          )}
          <Typography variant="caption" color="text.secondary" sx={{ mt: 0.5, display: 'block' }}>
            Max {formatFileSize(MAX_FILE_SIZE)}. Accepted: PDF, Word, Excel, ZIP, and more.
          </Typography>
        </Box>
      )}
    </>
  );
}
