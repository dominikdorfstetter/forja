import { useRef } from 'react';
import { Box, Typography } from '@mui/material';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import { useTranslation } from 'react-i18next';
import { useMarkdownFileProcessor, type MarkdownFileCallbacks } from './useMarkdownFileProcessor';

interface MarkdownUploadDropzoneProps extends MarkdownFileCallbacks {
  dragOver: boolean;
  fileName: string;
  fileSize: number;
  importError: string | null;
  onDragOver: (value: boolean) => void;
}

/** Drag-and-drop / click-to-browse markdown picker shared by the blog and content-template wizards. */
export default function MarkdownUploadDropzone({
  dragOver,
  fileName,
  fileSize,
  importError,
  onDragOver,
  ...callbacks
}: MarkdownUploadDropzoneProps) {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const processFile = useMarkdownFileProcessor(callbacks);

  return (
    <>
      <Box
        onDragOver={(e) => { e.preventDefault(); onDragOver(true); }}
        onDragLeave={() => onDragOver(false)}
        onDrop={(e) => { e.preventDefault(); onDragOver(false); const file = e.dataTransfer.files[0]; if (file) processFile(file); }}
        onClick={() => fileInputRef.current?.click()}
        sx={{
          border: '2px dashed',
          borderColor: dragOver ? 'primary.main' : 'divider',
          borderRadius: 2,
          p: 4,
          textAlign: 'center',
          cursor: 'pointer',
          bgcolor: dragOver ? 'action.hover' : 'transparent',
          transition: 'all 0.2s',
          '&:hover': { borderColor: 'primary.light', bgcolor: 'action.hover' },
        }}
      >
        <UploadFileIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 1 }} />
        <Typography variant="body1">
          {dragOver ? t('markdownImport.dropZoneActive') : t('markdownImport.dropZone')}
        </Typography>
      </Box>
      <input
        ref={fileInputRef}
        type="file"
        accept=".md,.markdown"
        hidden
        aria-label={t('common.actions.selectFile')}
        onChange={(e) => { const file = e.target.files?.[0]; if (file) processFile(file); }}
      />
      {fileName && !importError && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          {fileName} ({(fileSize / 1024).toFixed(1)} KB)
        </Typography>
      )}
    </>
  );
}
