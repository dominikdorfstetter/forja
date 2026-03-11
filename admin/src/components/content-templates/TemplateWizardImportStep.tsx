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

interface TemplateWizardImportStepProps {
  parsed: MarkdownParseResult | null;
  editName: string;
  editSlugPrefix: string;
  editBody: string;
  importError: string | null;
  fileName: string;
  dragOver: boolean;
  fileSize: number;
  onParsed: (result: MarkdownParseResult) => void;
  onEditNameChange: (value: string) => void;
  onEditSlugPrefixChange: (value: string) => void;
  onImportError: (error: string | null) => void;
  onFileName: (name: string) => void;
  onFileSize: (size: number) => void;
  onDragOver: (value: boolean) => void;
}

export default function TemplateWizardImportStep({
  parsed,
  editName,
  editSlugPrefix,
  editBody,
  importError,
  fileName,
  dragOver,
  fileSize,
  onParsed,
  onEditNameChange,
  onEditSlugPrefixChange,
  onImportError,
  onFileName,
  onFileSize,
  onDragOver,
}: TemplateWizardImportStepProps) {
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
      onParsed(result);
    }
  }, [t, onImportError, onFileName, onFileSize, onParsed]);

  return (
    <>
      {!parsed ? (
        <>
          <Box
            onDragOver={(e) => { e.preventDefault(); onDragOver(true); }}
            onDragLeave={() => onDragOver(false)}
            onDrop={(e) => { e.preventDefault(); onDragOver(false); const file = e.dataTransfer.files[0]; if (file) processFile(file); }}
            onClick={() => fileInputRef.current?.click()}
            sx={{
              border: '2px dashed',
              borderColor: dragOver ? 'primary.main' : 'divider',
              borderRadius: 2, p: 4, textAlign: 'center', cursor: 'pointer',
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
          <input ref={fileInputRef} type="file" accept=".md,.markdown" hidden onChange={(e) => { const file = e.target.files?.[0]; if (file) processFile(file); }} />
          {fileName && !importError && (
            <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
              {fileName} ({(fileSize / 1024).toFixed(1)} KB)
            </Typography>
          )}
        </>
      ) : (
        <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <TextField autoFocus label={t('forms.contentTemplate.fields.name')} value={editName} onChange={(e) => onEditNameChange(e.target.value)} fullWidth required />
          <TextField label={t('forms.contentTemplate.fields.slugPrefix')} value={editSlugPrefix} onChange={(e) => onEditSlugPrefixChange(e.target.value)} fullWidth InputProps={{ sx: { fontFamily: 'monospace' } }} />
          <TextField
            label={t('forms.contentTemplate.fields.body')}
            value={editBody}
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
