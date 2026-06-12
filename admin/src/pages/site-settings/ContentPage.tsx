import { useRef, useState } from 'react';
import { Box } from '@mui/material';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useSnackbar } from 'notistack';
import { useTranslation } from 'react-i18next';
import { getSiteMembers } from '@/services/members';
import { getSiteSettings, updateSiteSettings } from '@/services/sites';
import LoadingState from '@/components/shared/LoadingState';
import { useSiteContext } from '@/store/SiteContext';
import type { PreviewTemplate, UpdateSiteSettingsRequest } from '@/types/api';
import SiteAdvancedSettings from '@/pages/settings/SiteAdvancedSettings';
import { formResolver } from '@/utils/validation';
import { SectionHead } from '@/components/design-system';
import { useFormSaveBar } from '@/hooks/useFormSaveBar';
import { queryKeys } from '@/lib/queryKeys';

const schema = z.object({
  max_document_file_size_mb: z.number().min(1, 'Min 1 MB').max(100, 'Max 100 MB'),
  max_media_file_size_mb: z.number().min(1, 'Min 1 MB').max(500, 'Max 500 MB'),
  maintenance_mode: z.boolean(),
  contact_email: z.string().max(500).optional().or(z.literal('')),
  editorial_workflow_enabled: z.boolean(),
  document_password_min_length: z.number().min(4, 'Min 4').max(128, 'Max 128'),
  document_password_regex: z.string().max(500).optional().or(z.literal('')),
});

type FormValues = z.infer<typeof schema>;
type TemplateWithId = PreviewTemplate & { _id: number; is_builtin: boolean };

const BYTES_PER_MB = 1_048_576;

export default function ContentPage() {
  const { t } = useTranslation();
  const { selectedSiteId } = useSiteContext();
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const workflowRef = useRef<HTMLDivElement>(null);
  const templateIdCounter = useRef(0);
  const [previewTemplates, setPreviewTemplates] = useState<TemplateWithId[]>([]);
  const [previewTemplatesDirty, setPreviewTemplatesDirty] = useState(false);

  const { data: settings, isLoading } = useQuery({
    queryKey: queryKeys.siteSettings(selectedSiteId),
    queryFn: () => getSiteSettings(selectedSiteId),
    enabled: !!selectedSiteId,
  });

  const { data: members } = useQuery({
    queryKey: queryKeys.members(selectedSiteId),
    queryFn: () => getSiteMembers(selectedSiteId),
    enabled: !!selectedSiteId,
  });

  const { control, handleSubmit, reset, formState: { isDirty, errors, dirtyFields } } = useForm<FormValues>({
    resolver: formResolver(schema),
    defaultValues: {
      max_document_file_size_mb: 10,
      max_media_file_size_mb: 50,
      maintenance_mode: false,
      contact_email: '',
      editorial_workflow_enabled: false,
      document_password_min_length: 8,
      document_password_regex: '',
    },
  });

  const prevRef = useRef<typeof settings>(undefined);
  if (settings && settings !== prevRef.current) {
    prevRef.current = settings;
    reset({
      max_document_file_size_mb: Math.round(settings.max_document_file_size / BYTES_PER_MB),
      max_media_file_size_mb: Math.round(settings.max_media_file_size / BYTES_PER_MB),
      maintenance_mode: settings.maintenance_mode,
      contact_email: settings.contact_email,
      editorial_workflow_enabled: settings.editorial_workflow_enabled,
      document_password_min_length: settings.document_password_min_length ?? 8,
      document_password_regex: settings.document_password_regex ?? '',
    });
    setPreviewTemplates((settings.preview_templates ?? []).map(pt => ({
      ...pt,
      _id: templateIdCounter.current++,
      is_builtin: pt.is_builtin ?? false,
    })));
    setPreviewTemplatesDirty(false);
  }

  const mutation = useMutation({
    mutationFn: (data: UpdateSiteSettingsRequest) =>
      updateSiteSettings(selectedSiteId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.siteSettings(selectedSiteId) });
      enqueueSnackbar(t('settings.messages.saved'), { variant: 'success' });
    },
    onError: () => {
      enqueueSnackbar(t('settings.messages.saveFailed'), { variant: 'error' });
    },
  });

  const onSubmit = (values: FormValues) => {
    mutation.mutate({
      max_document_file_size: values.max_document_file_size_mb * BYTES_PER_MB,
      max_media_file_size: values.max_media_file_size_mb * BYTES_PER_MB,
      maintenance_mode: values.maintenance_mode,
      editorial_workflow_enabled: values.editorial_workflow_enabled,
      document_password_min_length: values.document_password_min_length,
      document_password_regex: values.document_password_regex || '',
      preview_templates: previewTemplates
        .filter(pt => pt.name.trim() && pt.url.trim() && !pt.is_builtin)
        .map(({ _id: _, is_builtin: _b, ...pt }) => pt),
    });
    // Clear dirty flags so the global save bar dismisses immediately.
    // RHF needs reset(values) to forget its dirty state; the preview
    // templates state is just a useState flag.
    reset(values, { keepValues: true });
    setPreviewTemplatesDirty(false);
  };

  const dirty = isDirty || previewTemplatesDirty;
  useFormSaveBar({
    id: 'site-settings.content',
    isDirty: dirty,
    saving: mutation.isPending,
    onSave: handleSubmit(onSubmit),
    onDiscard: () => {
      reset();
      setPreviewTemplates((settings?.preview_templates ?? []).map((pt) => ({
        ...pt,
        _id: templateIdCounter.current++,
        is_builtin: pt.is_builtin ?? false,
      })));
      setPreviewTemplatesDirty(false);
    },
    saveTestId: 'site-settings.content.save',
    discardTestId: 'site-settings.content.discard',
    dirtyFields,
  });

  if (isLoading) return <LoadingState label={t('settings.loadingSiteSettings')} />;

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <SectionHead
        icon="article"
        title={t('siteSettings.content.title', 'Content')}
        subtitle={t(
          'siteSettings.content.subtitle',
          'Upload limits, passwords, and how preview URLs are built.',
        )}
      />
      <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
        <SiteAdvancedSettings
          control={control}
          errors={errors}
          workflowRef={workflowRef}
          memberCount={members?.length}
          previewTemplates={previewTemplates}
          onAddTemplate={() => {
            setPreviewTemplates(prev => [...prev, { name: '', url: '', _id: templateIdCounter.current++, is_builtin: false }]);
            setPreviewTemplatesDirty(true);
          }}
          onRemoveTemplate={(index) => {
            setPreviewTemplates(prev => prev.filter((_, i) => i !== index));
            setPreviewTemplatesDirty(true);
          }}
          onTemplateChange={(index, field, value) => {
            setPreviewTemplates(prev => prev.map((pt, i) => i === index ? { ...pt, [field]: value } : pt));
            setPreviewTemplatesDirty(true);
          }}
        />

      </Box>
    </form>
  );
}
