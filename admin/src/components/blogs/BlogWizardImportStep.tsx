import { useCallback, useRef } from 'react';
import {
  Alert,
  Box,
  TextField,
  Typography,
} from '@mui/material';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import { useTranslation } from 'react-i18next';
import { validateMarkdownFile, parseMarkdown, type MarkdownParseResult } from '@/utils/markdownImport';

interface BlogWizardImportStepProps {
  importPhase: 'upload' | 'preview';
  dragOver: boolean;
  importError: string | null;
  fileName: string;
  fileSize: number;
  parsed: MarkdownParseResult | null;
  importTitle: string;
  importExcerpt: string;
  importSlug: string;
  onDragOver: (value: boolean) => void;
  onImportError: (error: string | null) => void;
  onFileName: (name: string) => void;
  onFileSize: (size: number) => void;
  onParsed: (result: MarkdownParseResult, title: string, excerpt: string, slug: string) => void;
  onImportTitleChange: (value: string) => void;
  onImportExcerptChange: (value: string) => void;
  onImportSlugChange: (value: string) => void;
}

export default function BlogWizardImportStep({
  importPhase,
  dragOver,
  importError,
  fileName,
  fileSize,
  parsed,
  importTitle,
  importExcerpt,
  importSlug,
  onDragOver,
  onImportError,
  onFileName,
  onFileSize,
  onParsed,
  onImportTitleChange,
  onImportExcerptChange,
  onImportSlugChange,
}: BlogWizardImportStepProps) {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const processFile = useCallback(async (file: File) => {
    onImportError(null);
    const validationError = validateMarkdownFile(file);
    if (validationError) {
      onImportError(t(validationError));
      return;
    }
    onFileName(file.name);
    onFileSize(file.size);
    let content: string;
    try {
      content = await file.text();
    } catch {
      onImportError(t('markdownImport.errors.readFailed'));
      return;
    }
    const { result, error: parseError } = parseMarkdown(content);
    if (parseError) {
      onImportError(t(parseError, { max: parseError.includes('title') ? 500 : 200000 }));
      return;
    }
    if (result) {
      onParsed(result, result.title, result.excerpt, result.slug);
    }
  }, [t, onImportError, onFileName, onFileSize, onParsed]);

  return (
    <>
      {importPhase === 'upload' && (
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
            onChange={(e) => { const file = e.target.files?.[0]; if (file) processFile(file); }}
          />
          {fileName && !importError && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              {fileName} ({(fileSize / 1024).toFixed(1)} KB)
            </Typography>
          )}
        </>
      )}
      {importPhase === 'preview' && (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField label={t('markdownImport.titleLabel')} value={importTitle} onChange={(e) => onImportTitleChange(e.target.value)} fullWidth />
          <TextField label={t('markdownImport.excerptLabel')} value={importExcerpt} onChange={(e) => onImportExcerptChange(e.target.value)} fullWidth multiline rows={2} />
          <TextField label={t('markdownImport.slugLabel')} value={importSlug} onChange={(e) => onImportSlugChange(e.target.value)} fullWidth InputProps={{ sx: { fontFamily: 'monospace' } }} />
          <TextField
            label={t('markdownImport.bodyPreview')}
            value={parsed?.body || ''}
            fullWidth
            multiline
            InputProps={{ readOnly: true, sx: { fontFamily: 'monospace', maxHeight: 200, overflow: 'auto' } }}
          />
        </Box>
      )}
      {importError && <Alert severity="error" sx={{ mt: 2 }}>{importError}</Alert>}
    </>
  );
}
