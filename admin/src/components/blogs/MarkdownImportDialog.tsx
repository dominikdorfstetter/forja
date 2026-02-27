import { useRef, useState, useCallback } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Typography,
  Alert,
} from '@mui/material';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import {
  validateMarkdownFile,
  parseMarkdown,
  type MarkdownParseResult,
} from '@/utils/markdownImport';

interface MarkdownImportDialogProps {
  open: boolean;
  onImport: (parsed: MarkdownParseResult) => void;
  onClose: () => void;
  loading?: boolean;
}

type Phase = 'upload' | 'preview';

export default function MarkdownImportDialog({ open, onImport, onClose, loading }: MarkdownImportDialogProps) {
  const { t } = useTranslation();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [phase, setPhase] = useState<Phase>('upload');
  const [dragOver, setDragOver] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState('');
  const [fileSize, setFileSize] = useState(0);
  const [parsed, setParsed] = useState<MarkdownParseResult | null>(null);

  // Editable fields
  const [title, setTitle] = useState('');
  const [excerpt, setExcerpt] = useState('');
  const [slug, setSlug] = useState('');

  const reset = useCallback(() => {
    setPhase('upload');
    setDragOver(false);
    setError(null);
    setFileName('');
    setFileSize(0);
    setParsed(null);
    setTitle('');
    setExcerpt('');
    setSlug('');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  }, []);

  const handleClose = () => {
    reset();
    onClose();
  };

  const processFile = async (file: File) => {
    setError(null);

    const validationError = validateMarkdownFile(file);
    if (validationError) {
      setError(t(validationError));
      return;
    }

    setFileName(file.name);
    setFileSize(file.size);

    let content: string;
    try {
      content = await file.text();
    } catch {
      setError(t('markdownImport.errors.readFailed'));
      return;
    }

    const { result, error: parseError } = parseMarkdown(content);
    if (parseError) {
      setError(t(parseError, { max: parseError.includes('title') ? 500 : 200000 }));
      return;
    }

    if (result) {
      setParsed(result);
      setTitle(result.title);
      setExcerpt(result.excerpt);
      setSlug(result.slug);
      setPhase('preview');
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) processFile(file);
  };

  const handleImport = () => {
    if (!parsed) return;
    onImport({
      ...parsed,
      title,
      excerpt,
      slug,
      meta_title: title.slice(0, 200),
    });
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle>{t('markdownImport.dialogTitle')}</DialogTitle>
      <DialogContent>
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          {t('markdownImport.dialogSubtitle')}
        </Typography>

        {phase === 'upload' && (
          <>
            <Box
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              onDrop={handleDrop}
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
              onChange={handleFileChange}
            />
            {fileName && !error && (
              <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
                {fileName} ({(fileSize / 1024).toFixed(1)} KB)
              </Typography>
            )}
          </>
        )}

        {phase === 'preview' && (
          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            <TextField
              label={t('markdownImport.titleLabel')}
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              fullWidth
            />
            <TextField
              label={t('markdownImport.excerptLabel')}
              value={excerpt}
              onChange={(e) => setExcerpt(e.target.value)}
              fullWidth
              multiline
              rows={2}
            />
            <TextField
              label={t('markdownImport.slugLabel')}
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              fullWidth
              InputProps={{ sx: { fontFamily: 'monospace' } }}
            />
            <TextField
              label={t('markdownImport.bodyPreview')}
              value={parsed?.body || ''}
              fullWidth
              multiline
              InputProps={{
                readOnly: true,
                sx: { fontFamily: 'monospace', maxHeight: 200, overflow: 'auto' },
              }}
            />
          </Box>
        )}

        {error && (
          <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>
        )}
      </DialogContent>
      <DialogActions>
        {phase === 'preview' && (
          <Button onClick={() => { setPhase('upload'); setError(null); }}>
            {t('markdownImport.back')}
          </Button>
        )}
        <Button onClick={handleClose}>{t('common.actions.cancel')}</Button>
        {phase === 'preview' && (
          <Button
            variant="contained"
            onClick={handleImport}
            disabled={loading || !title.trim() || !slug.trim()}
          >
            {loading ? t('markdownImport.importing') : t('markdownImport.import')}
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}
