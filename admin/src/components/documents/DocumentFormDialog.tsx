import { useEffect, useMemo, useReducer, useRef } from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  FormControlLabel,
  IconButton,
  InputAdornment,
  MenuItem,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import AutorenewIcon from '@mui/icons-material/Autorenew';
import LockIcon from '@mui/icons-material/Lock';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { z } from 'zod';
import { urlField, formResolver} from '@/utils/validation';
import type {
  DocumentResponse,
  DocumentFolder,
  Locale,
  CreateDocumentRequest,
  CreateDocumentLocalizationRequest,
} from '@/types/api';
import { useTranslation } from 'react-i18next';
import DocumentSourceSection from './DocumentSourceSection';
import DocumentLocaleSection from './DocumentLocaleSection';
import { generatePassword, validatePassword, type PasswordPolicy } from './passwordUtils';

/** Derive document_type from a file extension or MIME type. */
function deriveDocumentType(fileName: string, mimeType?: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  const extMap: Record<string, string> = {
    pdf: 'pdf',
    doc: 'doc', docx: 'doc',
    xls: 'xlsx', xlsx: 'xlsx', csv: 'xlsx',
    ppt: 'doc', pptx: 'doc',
    zip: 'zip', rar: 'zip', '7z': 'zip', tar: 'zip', gz: 'zip',
    txt: 'other', md: 'other', json: 'other', xml: 'other',
  };
  if (extMap[ext]) return extMap[ext];
  if (mimeType?.includes('pdf')) return 'pdf';
  if (mimeType?.includes('word') || mimeType?.includes('document')) return 'doc';
  if (mimeType?.includes('sheet') || mimeType?.includes('excel')) return 'xlsx';
  if (mimeType?.includes('zip') || mimeType?.includes('compressed')) return 'zip';
  return 'other';
}

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
  localizations: z.array(localizationSchema),
});

const uploadSchema = z.object({
  source_type: z.literal('upload'),
  url: z.string().optional(),
  document_type: z.string().min(1, 'Required'),
  folder_id: z.string(),
  localizations: z.array(localizationSchema),
});

const documentFormSchema = z.discriminatedUnion('source_type', [linkSchema, uploadSchema]);

type DocumentFormData = z.infer<typeof documentFormSchema>;

interface DocFormState {
  activeTab: number;
  sourceType: 'link' | 'upload';
  selectedFile: File | null;
  fileError: string | null;
  dragOver: boolean;
  isPrivate: boolean;
  password: string;
  confirmPassword: string;
  showPassword: boolean;
}

type DocFormAction =
  | { type: 'RESET'; sourceType: 'link' | 'upload' }
  | { type: 'SET_ACTIVE_TAB'; value: number }
  | { type: 'SET_SOURCE_TYPE'; value: 'link' | 'upload' }
  | { type: 'SET_SELECTED_FILE'; file: File | null }
  | { type: 'SET_FILE_ERROR'; error: string | null }
  | { type: 'SET_DRAG_OVER'; value: boolean }
  | { type: 'SET_IS_PRIVATE'; value: boolean; policy?: PasswordPolicy }
  | { type: 'SET_PASSWORD'; value: string }
  | { type: 'SET_CONFIRM_PASSWORD'; value: string }
  | { type: 'SET_SHOW_PASSWORD'; value: boolean }
  | { type: 'GENERATE_PASSWORD'; policy?: PasswordPolicy };

const initialDocFormState: DocFormState = {
  activeTab: 0,
  sourceType: 'link',
  selectedFile: null,
  fileError: null,
  dragOver: false,
  isPrivate: false,
  password: '',
  confirmPassword: '',
  showPassword: false,
};

function docFormReducer(state: DocFormState, action: DocFormAction): DocFormState {
  switch (action.type) {
    case 'RESET': return { ...initialDocFormState, sourceType: action.sourceType };
    case 'SET_ACTIVE_TAB': return { ...state, activeTab: action.value };
    case 'SET_SOURCE_TYPE': return { ...state, sourceType: action.value, selectedFile: null, fileError: null, dragOver: false };
    case 'SET_SELECTED_FILE': return { ...state, selectedFile: action.file };
    case 'SET_FILE_ERROR': return { ...state, fileError: action.error };
    case 'SET_DRAG_OVER': return { ...state, dragOver: action.value };
    case 'SET_IS_PRIVATE': {
      const pw = action.value ? generatePassword(action.policy) : '';
      return { ...state, isPrivate: action.value, password: pw, confirmPassword: pw, showPassword: action.value };
    }
    case 'SET_PASSWORD': return { ...state, password: action.value };
    case 'SET_CONFIRM_PASSWORD': return { ...state, confirmPassword: action.value };
    case 'SET_SHOW_PASSWORD': return { ...state, showPassword: action.value };
    case 'GENERATE_PASSWORD': {
      const pw = generatePassword(action.policy);
      return { ...state, password: pw, confirmPassword: pw, showPassword: true };
    }
  }
}

export interface DocumentFormResult {
  request: CreateDocumentRequest;
  localizations: CreateDocumentLocalizationRequest[];
  privacy?: { password: string };
}

interface DocumentFormDialogProps {
  open: boolean;
  document?: DocumentResponse | null;
  folders: DocumentFolder[];
  locales: Locale[];
  selectedFolderId?: string | null;
  passwordPolicy?: PasswordPolicy;
  onSubmit: (result: DocumentFormResult) => void;
  onClose: () => void;
  loading: boolean;
}

const readFileAsBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const base64 = result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export default function DocumentFormDialog({
  open,
  document,
  folders,
  locales,
  selectedFolderId,
  passwordPolicy,
  onSubmit,
  onClose,
  loading,
}: DocumentFormDialogProps) {
  const { t } = useTranslation();
  const isEditing = !!document;
  const [formState, formDispatch] = useReducer(docFormReducer, initialDocFormState);

  const activeLocales = useMemo(() => locales.filter((l) => l.is_active), [locales]);

  const buildDefaults = useMemo((): DocumentFormData => {
    if (document) {
      const isFile = document.has_file;
      return {
        source_type: isFile ? 'upload' : 'link',
        url: document.url ?? '',
        document_type: document.document_type,
        folder_id: document.folder_id ?? '',
        localizations: activeLocales.map((locale) => {
          const existing = (document.localizations ?? []).find((l) => l.locale_id === locale.id);
          return {
            locale_id: locale.id,
            name: existing?.name ?? '',
            description: existing?.description ?? '',
          };
        }),
      };
    }
    return {
      source_type: 'upload',
      url: '',
      document_type: 'other',
      folder_id: selectedFolderId ?? '',
      localizations: activeLocales.map((locale) => ({
        locale_id: locale.id,
        name: '',
        description: '',
      })),
    };
  }, [document, activeLocales, selectedFolderId]);

  const {
    register,
    handleSubmit,
    reset,
    control,
    setValue,
    formState: { errors, isValid },
  } = useForm<DocumentFormData>({
    resolver: formResolver(documentFormSchema),
    defaultValues: buildDefaults,
    mode: 'onChange',
  });

  const { fields } = useFieldArray({ control, name: 'localizations' });

  // Reset form when dialog opens
  const prevOpenRef = useRef(false);
  useEffect(() => {
    if (open && !prevOpenRef.current) {
      const defaults = buildDefaults;
      reset(defaults);
      formDispatch({ type: 'RESET', sourceType: defaults.source_type });
    }
    prevOpenRef.current = open;
  });

  const handleSourceTypeChange = (value: 'link' | 'upload') => {
    formDispatch({ type: 'SET_SOURCE_TYPE', value });
    setValue('source_type', value);
    if (value === 'link') {
      formDispatch({ type: 'SET_IS_PRIVATE', value: false });
    }
  };

  const handleFileSelect = (file: File | null) => {
    formDispatch({ type: 'SET_SELECTED_FILE', file });
    if (file) {
      const docType = deriveDocumentType(file.name, file.type);
      setValue('document_type', docType);
    }
  };

  const pwMinLen = passwordPolicy?.minLength ?? 8;
  const pwError = validatePassword(formState.password, passwordPolicy);
  const passwordValid = !formState.isPrivate || (
    !pwError && formState.password.length >= pwMinLen && formState.password === formState.confirmPassword
  );

  const canSubmit = isValid && passwordValid && !loading && (
    formState.sourceType === 'link' ||
    isEditing ||
    formState.selectedFile !== null
  );

  const onFormSubmit = async (data: DocumentFormData) => {
    if (formState.sourceType === 'upload' && !formState.selectedFile && !isEditing) {
      formDispatch({ type: 'SET_FILE_ERROR', error: t('forms.document.errors.noFile') });
      return;
    }

    let request: CreateDocumentRequest;

    if (formState.sourceType === 'upload' && formState.selectedFile) {
      const base64Data = await readFileAsBase64(formState.selectedFile);
      request = {
        document_type: data.document_type,
        folder_id: data.folder_id || undefined,
        display_order: 0,
        file_data: base64Data,
        file_name: formState.selectedFile.name,
        file_size: formState.selectedFile.size,
        mime_type: formState.selectedFile.type || 'application/octet-stream',
      };
    } else if (formState.sourceType === 'upload' && isEditing && !formState.selectedFile) {
      request = {
        document_type: data.document_type,
        folder_id: data.folder_id || undefined,
        display_order: 0,
      };
    } else {
      request = {
        url: data.url,
        document_type: data.document_type,
        folder_id: data.folder_id || undefined,
        display_order: 0,
      };
    }

    const localizations: CreateDocumentLocalizationRequest[] = data.localizations
      .filter((loc) => loc.name && loc.name.trim().length > 0)
      .map((loc) => ({
        locale_id: loc.locale_id,
        name: loc.name!,
        description: loc.description || undefined,
      }));

    onSubmit({
      request,
      localizations,
      privacy: formState.isPrivate ? { password: formState.password } : undefined,
    });
  };

  const sortedFolders = useMemo(
    () => [...folders].sort((a, b) => a.name.localeCompare(b.name)),
    [folders],
  );

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth aria-labelledby="document-form-title" data-testid="document-form.dialog">
      <form onSubmit={handleSubmit(onFormSubmit)}>
        <DialogTitle id="document-form-title">
          {isEditing ? t('forms.document.editTitle') : t('forms.document.createTitle')}
        </DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <DocumentSourceSection
              sourceType={formState.sourceType}
              onSourceTypeChange={handleSourceTypeChange}
              selectedFile={formState.selectedFile}
              onFileSelect={handleFileSelect}
              fileError={formState.fileError}
              onFileError={(error) => formDispatch({ type: 'SET_FILE_ERROR', error })}
              dragOver={formState.dragOver}
              onDragOver={(value) => formDispatch({ type: 'SET_DRAG_OVER', value })}
              document={document}
              isEditing={isEditing}
              register={register as never}
              errors={errors}
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

            {/* Privacy toggle — only for file uploads */}
            {formState.sourceType === 'upload' && !isEditing && (
              <>
                <FormControlLabel
                  control={
                    <Switch
                      checked={formState.isPrivate}
                      onChange={(e) => formDispatch({ type: 'SET_IS_PRIVATE', value: e.target.checked, policy: passwordPolicy })}
                    />
                  }
                  label={
                    <Stack direction="row" spacing={0.5} sx={{ alignItems: "center" }}>
                      <LockIcon fontSize="small" />
                      <span>{t('documents.privacy.setTitle')}</span>
                    </Stack>
                  }
                />
                {formState.isPrivate && (
                  <Stack spacing={1.5}>
                    <Typography variant="caption" color="text.secondary">
                      {t('documents.privacy.setDescription')}
                    </Typography>
                    <TextField
                      label={t('documents.privacy.password')}
                      type={formState.showPassword ? 'text' : 'password'}
                      fullWidth
                      size="small"
                      value={formState.password}
                      onChange={(e) => formDispatch({ type: 'SET_PASSWORD', value: e.target.value })}
                      error={!!pwError}
                      helperText={pwError ?? undefined}
                      slotProps={{
                        input: {
                          endAdornment: (
                            <InputAdornment position="end">
                              <IconButton size="small" onClick={() => formDispatch({ type: 'SET_SHOW_PASSWORD', value: !formState.showPassword })}>
                                {formState.showPassword ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
                              </IconButton>
                              <Tooltip title={t('documents.privacy.generate')}>
                                <IconButton size="small" onClick={() => formDispatch({ type: 'GENERATE_PASSWORD', policy: passwordPolicy })}>
                                  <AutorenewIcon fontSize="small" />
                                </IconButton>
                              </Tooltip>
                            </InputAdornment>
                          ),
                        },
                      }}
                    />
                    <TextField
                      label={t('documents.privacy.confirmPassword')}
                      type={formState.showPassword ? 'text' : 'password'}
                      fullWidth
                      size="small"
                      value={formState.confirmPassword}
                      onChange={(e) => formDispatch({ type: 'SET_CONFIRM_PASSWORD', value: e.target.value })}
                      error={formState.confirmPassword.length > 0 && formState.password !== formState.confirmPassword}
                      helperText={formState.confirmPassword.length > 0 && formState.password !== formState.confirmPassword ? t('documents.privacy.mismatch') : undefined}
                    />
                  </Stack>
                )}
              </>
            )}

            <DocumentLocaleSection
              activeTab={formState.activeTab}
              onTabChange={(v) => formDispatch({ type: 'SET_ACTIVE_TAB', value: v })}
              activeLocales={activeLocales}
              fields={fields}
              register={register as never}
              errors={errors}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={loading} data-testid="document-form.btn.cancel">
            {t('common.actions.cancel')}
          </Button>
          <Button type="submit" variant="contained" disabled={!canSubmit} data-testid="document-form.btn.submit">
            {loading ? t('common.actions.saving') : isEditing ? t('common.actions.save') : t('common.actions.create')}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
