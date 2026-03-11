import { useMemo, useReducer, useRef } from 'react';
import {
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Stack,
  MenuItem,
} from '@mui/material';
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
import DocumentSourceSection from './DocumentSourceSection';
import DocumentLocaleSection from './DocumentLocaleSection';

const DOCUMENT_TYPES = [
  { value: 'pdf', label: 'PDF' },
  { value: 'doc', label: 'Document (Word)' },
  { value: 'xlsx', label: 'Spreadsheet (Excel)' },
  { value: 'zip', label: 'Archive (ZIP)' },
  { value: 'link', label: 'External Link' },
  { value: 'other', label: 'Other' },
] as const;

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

interface DocFormState {
  activeTab: number;
  sourceType: 'link' | 'upload';
  selectedFile: File | null;
  fileError: string | null;
}

type DocFormAction =
  | { type: 'RESET'; sourceType: 'link' | 'upload' }
  | { type: 'SET_ACTIVE_TAB'; value: number }
  | { type: 'SET_SOURCE_TYPE'; value: 'link' | 'upload' }
  | { type: 'SET_SELECTED_FILE'; file: File | null }
  | { type: 'SET_FILE_ERROR'; error: string | null };

const initialDocFormState: DocFormState = {
  activeTab: 0, sourceType: 'link', selectedFile: null, fileError: null,
};

function docFormReducer(state: DocFormState, action: DocFormAction): DocFormState {
  switch (action.type) {
    case 'RESET': return { ...initialDocFormState, sourceType: action.sourceType };
    case 'SET_ACTIVE_TAB': return { ...state, activeTab: action.value };
    case 'SET_SOURCE_TYPE': return { ...state, sourceType: action.value, selectedFile: null, fileError: null };
    case 'SET_SELECTED_FILE': return { ...state, selectedFile: action.file };
    case 'SET_FILE_ERROR': return { ...state, fileError: action.error };
  }
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

  // Reset form when dialog opens
  const prevOpenRef = useRef(false);
  if (open && !prevOpenRef.current) {
    const defaults = buildDefaults;
    reset(defaults);
    formDispatch({ type: 'RESET', sourceType: defaults.source_type });
  }
  prevOpenRef.current = open;

  const handleSourceTypeChange = (value: 'link' | 'upload') => {
    formDispatch({ type: 'SET_SOURCE_TYPE', value });
    setValue('source_type', value);
  };

  const onFormSubmit = async (data: DocumentFormData) => {
    if (formState.sourceType === 'upload' && !formState.selectedFile && !isEditing) {
      formDispatch({ type: 'SET_FILE_ERROR', error: 'Please select a file to upload' });
      return;
    }

    let request: CreateDocumentRequest;

    if (formState.sourceType === 'upload' && formState.selectedFile) {
      const base64Data = await readFileAsBase64(formState.selectedFile);
      request = {
        document_type: data.document_type,
        folder_id: data.folder_id || undefined,
        display_order: data.display_order,
        file_data: base64Data,
        file_name: formState.selectedFile.name,
        file_size: formState.selectedFile.size,
        mime_type: formState.selectedFile.type || 'application/octet-stream',
      };
    } else if (formState.sourceType === 'upload' && isEditing && !formState.selectedFile) {
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
              onFileSelect={(file) => formDispatch({ type: 'SET_SELECTED_FILE', file })}
              fileError={formState.fileError}
              onFileError={(error) => formDispatch({ type: 'SET_FILE_ERROR', error })}
              document={document}
              isEditing={isEditing}
              register={register as never}
              errors={errors}
            />

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
          <Button type="submit" variant="contained" disabled={loading || !isValid} data-testid="document-form.btn.submit">
            {loading ? t('common.actions.saving') : isEditing ? t('common.actions.save') : t('common.actions.create')}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}
