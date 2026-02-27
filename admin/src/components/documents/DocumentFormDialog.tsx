import { useEffect, useMemo, useState, useRef } from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Stack,
  MenuItem,
  Tabs,
  Tab,
  Box,
  ToggleButtonGroup,
  ToggleButton,
  Typography,
  Alert,
} from '@mui/material';
import LinkIcon from '@mui/icons-material/Link';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { urlField, nonNegativeInt } from '@/utils/validation';
import type {
  DocumentResponse,
  DocumentFolder,
  Locale,
  CreateDocumentRequest,
  CreateDocumentLocalizationRequest,
} from '@/types/api';
import { useTranslation } from 'react-i18next';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10 MB

const DOCUMENT_TYPES = [
  { value: 'pdf', label: 'PDF' },
  { value: 'doc', label: 'Document (Word)' },
  { value: 'xlsx', label: 'Spreadsheet (Excel)' },
  { value: 'zip', label: 'Archive (ZIP)' },
  { value: 'link', label: 'External Link' },
  { value: 'other', label: 'Other' },
] as const;

const ACCEPTED_FILE_TYPES = '.pdf,.doc,.docx,.xlsx,.xls,.zip,.txt,.csv,.pptx,.ppt';

const localizationSchema = z.object({
  locale_id: z.string().min(1),
  name: z.string().max(255),
  description: z.string().max(2000),
});

const linkSchema = z.object({
  source_type: z.literal('link'),
  url: urlField,
  document_type: z.string().min(1, 'Required'),
  folder_id: z.string(),
  display_order: nonNegativeInt,
  localizations: z.array(localizationSchema),
});

const uploadSchema = z.object({
  source_type: z.literal('upload'),
  url: z.string().optional(),
  document_type: z.string().min(1, 'Required'),
  folder_id: z.string(),
  display_order: nonNegativeInt,
  localizations: z.array(localizationSchema),
});

const documentFormSchema = z.discriminatedUnion('source_type', [linkSchema, uploadSchema]);

type DocumentFormData = z.infer<typeof documentFormSchema>;

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

interface DocumentFormDialogProps {
  open: boolean;
  document?: DocumentResponse | null;
  folders: DocumentFolder[];
  locales: Locale[];
  onSubmit: (data: CreateDocumentRequest, localizations: CreateDocumentLocalizationRequest[]) => void;
  onClose: () => void;
  loading: boolean;
}

export default function DocumentFormDialog({
  open,
  document,
  folders,
  locales,
  onSubmit,
  onClose,
  loading,
}: DocumentFormDialogProps) {
  const { t } = useTranslation();
  const [activeTab, setActiveTab] = useState(0);
  const [sourceType, setSourceType] = useState<'link' | 'upload'>('link');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileError, setFileError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isEditing = !!document;

  const activeLocales = useMemo(() => locales.filter((l) => l.is_active), [locales]);

  const buildDefaults = useMemo((): DocumentFormData => {
    if (document) {
      const isFile = document.has_file;
      return {
        source_type: isFile ? 'upload' : 'link',
        url: document.url ?? '',
        document_type: document.document_type,
        folder_id: document.folder_id ?? '',
        display_order: document.display_order,
        localizations: activeLocales.map((locale) => {
          const existing = document.localizations.find((l) => l.locale_id === locale.id);
          return {
            locale_id: locale.id,
            name: existing?.name ?? '',
            description: existing?.description ?? '',
          };
        }),
      };
    }
    return {
      source_type: 'link',
      url: '',
      document_type: 'pdf',
      folder_id: '',
      display_order: 0,
      localizations: activeLocales.map((locale) => ({
        locale_id: locale.id,
        name: '',
        description: '',
      })),
    };
  }, [document, activeLocales]);

  const {
    register,
    handleSubmit,
    reset,
    control,
    setValue,
    formState: { errors, isValid },
  } = useForm<DocumentFormData>({
    resolver: zodResolver(documentFormSchema),
    defaultValues: buildDefaults,
    mode: 'onChange',
  });

  const { fields } = useFieldArray({ control, name: 'localizations' });

  useEffect(() => {
    if (open) {
      const defaults = buildDefaults;
      reset(defaults);
      setSourceType(defaults.source_type);
      setActiveTab(0);
      setSelectedFile(null);
      setFileError(null);
    }
  }, [open, reset, buildDefaults]);

  const handleSourceTypeChange = (_: React.MouseEvent<HTMLElement>, value: string | null) => {
    if (value === 'link' || value === 'upload') {
      setSourceType(value);
      setValue('source_type', value);
      setSelectedFile(null);
      setFileError(null);
    }
  };

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    setFileError(null);

    if (!file) {
      setSelectedFile(null);
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setFileError(`File too large (${formatFileSize(file.size)}). Maximum is ${formatFileSize(MAX_FILE_SIZE)}.`);
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
      return;
    }

    setSelectedFile(file);
  };

  const readFileAsBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const result = reader.result as string;
        // Remove the data URL prefix (e.g., "data:application/pdf;base64,")
        const base64 = result.split(',')[1];
        resolve(base64);
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const onFormSubmit = async (data: DocumentFormData) => {
    if (sourceType === 'upload' && !selectedFile && !isEditing) {
      setFileError('Please select a file to upload');
      return;
    }

    let request: CreateDocumentRequest;

    if (sourceType === 'upload' && selectedFile) {
      const base64Data = await readFileAsBase64(selectedFile);
      request = {
        document_type: data.document_type,
        folder_id: data.folder_id || undefined,
        display_order: data.display_order,
        file_data: base64Data,
        file_name: selectedFile.name,
        file_size: selectedFile.size,
        mime_type: selectedFile.type || 'application/octet-stream',
      };
    } else if (sourceType === 'upload' && isEditing && !selectedFile) {
      // Editing an uploaded doc without changing the file
      request = {
        document_type: data.document_type,
        folder_id: data.folder_id || undefined,
        display_order: data.display_order,
      };
    } else {
      request = {
        url: data.url,
        document_type: data.document_type,
        folder_id: data.folder_id || undefined,
        display_order: data.display_order,
      };
    }

    const localizations: CreateDocumentLocalizationRequest[] = data.localizations
      .filter((loc) => loc.name && loc.name.trim().length > 0)
      .map((loc) => ({
        locale_id: loc.locale_id,
        name: loc.name!,
        description: loc.description || undefined,
      }));

    onSubmit(request, localizations);
  };

  const sortedFolders = useMemo(
    () => [...folders].sort((a, b) => a.name.localeCompare(b.name)),
    [folders],
  );

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth aria-labelledby="document-form-title">
      <form onSubmit={handleSubmit(onFormSubmit)}>
        <DialogTitle id="document-form-title">
          {isEditing ? t('forms.document.editTitle') : t('forms.document.createTitle')}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
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
                {...register('url')}
                error={!!errors.url}
                helperText={errors.url?.message || 'Full URL to the document or resource'}
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

            <Controller
              name="document_type"
              control={control}
              render={({ field }) => (
                <TextField
                  select
                  label={t('forms.document.fields.documentType')}
                  fullWidth
                  required
                  {...field}
                  error={!!errors.document_type}
                  helperText={errors.document_type?.message}
                >
                  {DOCUMENT_TYPES.map((dt) => (
                    <MenuItem key={dt.value} value={dt.value}>
                      {dt.label}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            />

            <Controller
              name="folder_id"
              control={control}
              render={({ field }) => (
                <TextField
                  select
                  label={t('forms.mediaDetail.fields.folder')}
                  fullWidth
                  {...field}
                  error={!!errors.folder_id}
                  helperText={errors.folder_id?.message}
                >
                  <MenuItem value="">
                    <em>{t('forms.mediaDetail.fields.noFolder')}</em>
                  </MenuItem>
                  {sortedFolders.map((f) => (
                    <MenuItem key={f.id} value={f.id}>
                      {f.name}
                    </MenuItem>
                  ))}
                </TextField>
              )}
            />

            <TextField
              label={t('forms.section.fields.displayOrder')}
              type="number"
              fullWidth
              {...register('display_order')}
              error={!!errors.display_order}
              helperText={errors.display_order?.message}
            />

            {/* Locale tabs for name + description */}
            {activeLocales.length > 0 && (
              <Box sx={{ mt: 1 }}>
                <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                  <Tabs
                    value={activeTab}
                    onChange={(_, newValue: number) => setActiveTab(newValue)}
                    variant="scrollable"
                    scrollButtons="auto"
                    aria-label="Locale tabs"
                  >
                    {activeLocales.map((locale) => (
                      <Tab key={locale.id} label={locale.code.toUpperCase()} />
                    ))}
                  </Tabs>
                </Box>
                {fields.map((field, index) => {
                  const locale = activeLocales[index];
                  if (!locale) return null;
                  return (
                    <Box
                      key={field.id}
                      role="tabpanel"
                      hidden={activeTab !== index}
                      sx={{ px: 0, py: 2 }}
                    >
                      {activeTab === index && (
                        <Stack spacing={2}>
                          <TextField
                            label={`Name (${locale.code})`}
                            fullWidth
                            {...register(`localizations.${index}.name`)}
                            error={!!errors.localizations?.[index]?.name}
                            helperText={errors.localizations?.[index]?.name?.message}
                          />
                          <TextField
                            label={`Description (${locale.code})`}
                            fullWidth
                            multiline
                            minRows={2}
                            maxRows={4}
                            {...register(`localizations.${index}.description`)}
                            error={!!errors.localizations?.[index]?.description}
                            helperText={errors.localizations?.[index]?.description?.message}
                          />
                        </Stack>
                      )}
                    </Box>
                  );
                })}
              </Box>
            )}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={loading}>
            {t('common.actions.cancel')}
          </Button>
          <Button type="submit" variant="contained" disabled={loading || !isValid}>
            {loading ? t('common.actions.saving') : isEditing ? t('common.actions.save') : t('common.actions.create')}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
