import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router';
import { Box, CircularProgress, Tab, Tabs } from '@mui/material';
import { PageHeader } from '@/components/shared/listPageV2/PageHeader';
import { M3Button } from '@/components/design-system';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import FieldBuilder from '@/components/forms/FieldBuilder';
import { deleteForm } from '@/services/forms';
import { getSiteLocales } from '@/services/siteLocales';
import { useAuth } from '@/store/AuthContext';
import { useSiteContext } from '@/store/SiteContext';
import { useErrorSnackbar } from '@/hooks/useErrorSnackbar';
import { useFormSaveBar } from '@/hooks/useFormSaveBar';
import { queryKeys } from '@/lib/queryKeys';
import FormSettingsTab from './form-detail/FormSettingsTab';
import FormTranslationsTab from './form-detail/FormTranslationsTab';
import { useFormDetailEditor } from './form-detail/useFormDetailEditor';

/**
 * Form detail/builder page (#587). Tabs: Settings, Fields and (with more
 * than one active locale) Translations. The draft lives in
 * `useFormDetailEditor`; Save/Discard are wired to the global save bar via
 * useFormSaveBar.
 */
export default function FormDetailPage() {
  const { id } = useParams<{ id: string }>();
  const formId = id ?? '';
  const { t } = useTranslation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { canWrite } = useAuth();
  const { showError, showSuccess } = useErrorSnackbar();

  const [tab, setTab] = useState<'settings' | 'fields' | 'translations'>('settings');
  const [activeLocaleId, setActiveLocaleId] = useState<string | null>(null);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const { selectedSiteId } = useSiteContext();

  const { data: siteLocales = [] } = useQuery({
    queryKey: queryKeys.siteLocales(selectedSiteId),
    queryFn: () => getSiteLocales(selectedSiteId),
    enabled: !!selectedSiteId,
  });
  const activeLocales = useMemo(
    () => siteLocales.filter((l) => l.is_active),
    [siteLocales],
  );

  const editor = useFormDetailEditor(formId);
  const { form, draft } = editor;

  const deleteMutation = useMutation({
    mutationFn: () => deleteForm(formId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.forms(selectedSiteId) });
      showSuccess(t('formsModule.list.messages.deleted'));
      navigate('/forms');
    },
    onError: showError,
  });

  useFormSaveBar({
    id: 'form-detail',
    isDirty: editor.isDirty,
    saving: editor.saving,
    saveTestId: 'forms.detail.save',
    discardTestId: 'forms.detail.discard',
    onSave: editor.save,
    onDiscard: editor.discard,
  });

  if (editor.isLoading || !draft || !form) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }} data-testid="forms.detail.loading">
        <CircularProgress />
      </Box>
    );
  }

  return (
    <div data-testid="forms.detail.page">
      <PageHeader
        icon="dynamic_form"
        breadcrumb={`${t('layout.sidebar.content')} / ${t('layout.sidebar.forms')} / ${form.name}`}
        title={form.name}
        subtitle={`/${t('layout.sidebar.forms').toLowerCase()}/${form.slug}`}
        actions={
          <>
            <M3Button
              variant="outlined"
              size="md"
              icon="inbox"
              onClick={() => navigate(`/forms/${form.id}/submissions`)}
              data-testid="forms.detail.btn.submissions"
            >
              {t('formsModule.detail.viewSubmissions', 'Submissions')}
            </M3Button>
            {canWrite && (
              <M3Button
                variant="outlined"
                size="md"
                icon="delete"
                onClick={() => setDeleteOpen(true)}
                data-testid="forms.detail.btn.delete"
              >
                {t('formsModule.list.actions.delete')}
              </M3Button>
            )}
          </>
        }
      />

      <Tabs
        value={tab}
        onChange={(_, v) => setTab(v)}
        sx={{ mb: 3 }}
        data-testid="forms.detail.tabs"
      >
        <Tab
          value="settings"
          label={t('formsModule.detail.tabs.settings', 'Settings')}
          data-testid="forms.detail.tab.settings"
        />
        <Tab
          value="fields"
          label={t('formsModule.detail.tabs.fields', 'Fields')}
          data-testid="forms.detail.tab.fields"
        />
        {activeLocales.length > 1 && (
          <Tab
            value="translations"
            label={t('formsModule.detail.tabs.translations', 'Translations')}
            data-testid="forms.detail.tab.translations"
          />
        )}
      </Tabs>

      {tab === 'settings' && (
        <FormSettingsTab settings={draft.settings} onChange={editor.updateSetting} />
      )}

      {tab === 'fields' && (
        <FieldBuilder fields={draft.fields} onChange={editor.setFields} />
      )}

      {tab === 'translations' && (
        <FormTranslationsTab
          activeLocales={activeLocales}
          activeLocaleId={activeLocaleId}
          onActiveLocaleChange={setActiveLocaleId}
          settings={draft.settings}
          localizations={draft.localizations}
          onLocalizationsChange={editor.setLocalizations}
          fields={draft.fields}
          onFieldsChange={editor.setFields}
        />
      )}

      <ConfirmDialog
        open={deleteOpen}
        title={t('formsModule.list.deleteConfirm.title')}
        message={t('formsModule.list.deleteConfirm.body')}
        confirmLabel={t('formsModule.list.deleteConfirm.confirm')}
        confirmColor="error"
        onConfirm={() => {
          setDeleteOpen(false);
          deleteMutation.mutate();
        }}
        onCancel={() => setDeleteOpen(false)}
        loading={deleteMutation.isPending}
      />
    </div>
  );
}
