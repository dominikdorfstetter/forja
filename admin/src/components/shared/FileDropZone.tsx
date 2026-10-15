import type { ReactNode } from 'react';
import { Box, Stack, Typography } from '@mui/material';
import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import { useTranslation } from 'react-i18next';
import { useFileDropZone } from '@/hooks/useFileDropZone';
import { useImagePreviewUrl } from '@/hooks/useImagePreviewUrl';
import { formatBytes } from '@/utils/formatBytes';

interface FileDropZoneProps {
  onFile: (file: File) => void;
  dragOver: boolean;
  onDragOverChange: (dragOver: boolean) => void;
  /** Paints the dashed border in the error colour (unless hovering). */
  hasError: boolean;
  /** Blocks picking and hover affordances (e.g. while uploading). */
  disabled?: boolean;
  /** Inner padding (theme spacing units). */
  padding: number;
  accept?: string;
  inputTestId: string;
  dropZoneTestId?: string;
  children: ReactNode;
}

function borderColorFor(dragOver: boolean, hasError: boolean): string {
  if (dragOver) return 'primary.main';
  return hasError ? 'error.main' : 'divider';
}

/**
 * Dashed drag-and-drop area plus its hidden file input. Content (prompt,
 * selected-file summary, progress) is supplied by the caller as children.
 */
export default function FileDropZone({
  onFile,
  dragOver,
  onDragOverChange,
  hasError,
  disabled = false,
  padding,
  accept,
  inputTestId,
  dropZoneTestId,
  children,
}: FileDropZoneProps) {
  const { t } = useTranslation();
  const { dropZoneProps, inputProps } = useFileDropZone({ onFile, onDragOverChange, disabled });

  return (
    <>
      <Box
        {...dropZoneProps}
        data-testid={dropZoneTestId}
        sx={{
          border: '2px dashed',
          borderColor: borderColorFor(dragOver, hasError),
          borderRadius: 2,
          p: padding,
          textAlign: 'center',
          cursor: disabled ? 'default' : 'pointer',
          bgcolor: dragOver ? 'action.hover' : 'background.default',
          transition: 'all 0.2s ease',
          '&:hover': disabled ? {} : { borderColor: 'primary.main', bgcolor: 'action.hover' },
        }}
      >
        {children}
      </Box>

      <input
        {...inputProps}
        type="file"
        accept={accept}
        style={{ display: 'none' }}
        aria-label={t('common.actions.selectFile')}
        data-testid={inputTestId}
      />
    </>
  );
}

interface DropZoneFileContentProps {
  file: File | null;
  dragOver: boolean;
  /** Max height of the image preview thumbnail in px. */
  previewMaxHeight: number;
}

/**
 * Standard drop-zone body: the picked file's preview/name/size once chosen,
 * otherwise the "drag & drop" prompt.
 */
export function DropZoneFileContent({ file, dragOver, previewMaxHeight }: DropZoneFileContentProps) {
  const { t } = useTranslation();
  const preview = useImagePreviewUrl(file);

  if (!file) {
    return (
      <Stack spacing={1} sx={{ alignItems: "center" }}>
        <CloudUploadIcon sx={{ fontSize: 48 }} color={dragOver ? 'primary' : 'action'} />
        <Typography variant="body1" color="text.secondary">
          {t('media.upload.dragDrop')}
        </Typography>
      </Stack>
    );
  }

  return (
    <Stack spacing={1} sx={{ alignItems: "center" }}>
      {preview ? (
        <Box
          component="img"
          src={preview}
          alt={file.name}
          sx={{ maxWidth: 200, maxHeight: previewMaxHeight, objectFit: 'contain', borderRadius: 1 }}
        />
      ) : (
        <InsertDriveFileIcon sx={{ fontSize: 48 }} color="action" />
      )}
      <Typography variant="body2" sx={{ fontWeight: 500 }}>{file.name}</Typography>
      <Typography variant="caption" color="text.secondary">
        {formatBytes(file.size)} &middot; {file.type || 'unknown type'}
      </Typography>
    </Stack>
  );
}
