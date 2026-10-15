import { useEffect, useMemo, useReducer, useRef } from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  MenuItem,
  Stack,
  TextField,
} from '@mui/material';
import { useForm, Controller, useFieldArray } from 'react-hook-form';
import { formResolver } from '@/utils/validation';
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
import DocumentPrivacyFields from './DocumentPrivacyFields';
import type { PasswordPolicy } from './passwordUtils';
import {
  buildDocumentFormDefaults,
  buildDocumentLocalizations,
  buildDocumentRequest,
  deriveDocumentType,
  documentFormSchema,
  type DocumentFormData,
  type EncodedUpload,
} from './documentFormModel';
import { canSubmitDocumentForm, docFormReducer, initialDocFormState } from './documentFormState';

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

async function encodeUpload(file: File | null): Promise<EncodedUpload | null> {
  if (!file) return null;
  return { base64: await readFileAsBase64(file), name: file.name, size: file.size, type: file.type };
}

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

  const buildDefaults = useMemo(
    () => buildDocumentFormDefaults(document, activeLocales, selectedFolderId),
    [document, activeLocales, selectedFolderId],
  );

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

  const canSubmit = canSubmitDocumentForm(formState, { formValid: isValid, loading, isEditing, policy: passwordPolicy });

  const onFormSubmit = async (data: DocumentFormData) => {
    if (formState.sourceType === 'upload' && !formState.selectedFile && !isEditing) {
      formDispatch({ type: 'SET_FILE_ERROR', error: t('forms.document.errors.noFile') });
      return;
    }

    const upload = formState.sourceType === 'upload' ? await encodeUpload(formState.selectedFile) : null;

    onSubmit({
      request: buildDocumentRequest(data, formState.sourceType, upload),
      localizations: buildDocumentLocalizations(data.localizations),
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
              <DocumentPrivacyFields state={formState} dispatch={formDispatch} passwordPolicy={passwordPolicy} />
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
