import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate, useParams } from 'react-router';
import {
  Box,
  CircularProgress,
  FormControlLabel,
  MenuItem,
  Switch,
  Tab,
  Tabs,
  TextField,
} from '@mui/material';
import { PageHeader } from '@/components/shared/listPageV2/PageHeader';
import { M3Button } from '@/components/design-system';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import FieldBuilder from '@/components/forms/FieldBuilder';
import FormLocalePanel from '@/components/forms/FormLocalePanel';
import { deleteForm, getForm, updateForm } from '@/services/forms';
import { getSiteLocales } from '@/services/siteLocales';
import { useAuth } from '@/store/AuthContext';
import { useSiteContext } from '@/store/SiteContext';
import { useErrorSnackbar } from '@/hooks/useErrorSnackbar';
import { useFormSaveBar } from '@/hooks/useFormSaveBar';
import type {
  FormDetailResponse,
  UpdateFormRequest,
  FormBotProtection,
  FormStorageMode,
  FormFieldInput,
  FormFieldResponse,
  FormLocalizationInput,
} from '@/types/api';
import { queryKeys } from '@/lib/queryKeys';

function fieldsFromResponse(fields: FormFieldResponse[]): FormFieldInput[] {
  return fields.map((f) => ({
    label: f.label,
    field_type: f.field_type,
    placeholder: f.placeholder,
    help_text: f.help_text,
    validation: f.validation ?? {},
    options: f.options ?? null,
    is_required: f.is_required,
    display_order: f.display_order,
    localizations: (f.localizations ?? []).map((l) => ({
      locale_id: l.locale_id,
      display_label: l.display_label,
      placeholder: l.placeholder,
      help_text: l.help_text,
    })),
  }));
}

function formLocsFromResponse(
  form: FormDetailResponse,
): FormLocalizationInput[] {
  return (form.localizations ?? []).map((l) => ({
    locale_id: l.locale_id,
    name: l.name,
    description: l.description,
    consent_text: l.consent_text,
  }));
}

function formLocsChanged(
  a: FormLocalizationInput[],
  b: FormLocalizationInput[],
): boolean {
  if (a.length !== b.length) return true;
  return JSON.stringify(a) !== JSON.stringify(b);
}

function fieldsChanged(a: FormFieldInput[], b: FormFieldInput[]): boolean {
  if (a.length !== b.length) return true;
  return JSON.stringify(a) !== JSON.stringify(b);
}

interface SettingsState {
  name: string;
  slug: string;
  description: string;
  is_active: boolean;
  consent_required: boolean;
  consent_text: string;
  bot_protection: FormBotProtection;
  storage_mode: FormStorageMode;
  retention_days: number | '';
}

function toSettings(form: FormDetailResponse): SettingsState {
  return {
    name: form.name,
    slug: form.slug,
    description: form.description ?? '',
    is_active: form.is_active,
    consent_required: form.consent_required,
    consent_text: form.consent_text ?? '',
    bot_protection: form.bot_protection,
    storage_mode: form.storage_mode,
    retention_days: form.retention_days ?? '',
  };
}

function diff(state: SettingsState, original: SettingsState): UpdateFormRequest {
  const out: UpdateFormRequest = {};
  if (state.name !== original.name) out.name = state.name;
  if (state.slug !== original.slug) out.slug = state.slug;
  if (state.description !== original.description) {
    out.description = state.description.trim() === '' ? null : state.description;
  }
  if (state.is_active !== original.is_active) out.is_active = state.is_active;
  if (state.consent_required !== original.consent_required) {
    out.consent_required = state.consent_required;
  }
  if (state.consent_text !== original.consent_text) {
    out.consent_text = state.consent_text.trim() === '' ? null : state.consent_text;
  }
  if (state.bot_protection !== original.bot_protection) out.bot_protection = state.bot_protection;
  if (state.storage_mode !== original.storage_mode) out.storage_mode = state.storage_mode;
  if (state.retention_days !== original.retention_days) {
    out.retention_days = state.retention_days === '' ? null : Number(state.retention_days);
  }
  return out;
}

/**
 * Form detail/builder page (#587). Two tabs: Settings (this slice) and
 * Fields (slice 5 — placeholder for now). Owns dirty-state tracking
 * and wires Save/Discard to the global save bar via useFormSaveBar.
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
  const [settings, setSettings] = useState<SettingsState | null>(null);
  const [original, setOriginal] = useState<SettingsState | null>(null);
  const [fields, setFields] = useState<FormFieldInput[] | null>(null);
  const [originalFields, setOriginalFields] = useState<FormFieldInput[] | null>(null);
  const [localizations, setLocalizations] = useState<FormLocalizationInput[] | null>(null);
  const [originalLocs, setOriginalLocs] = useState<FormLocalizationInput[] | null>(null);
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
  const defaultLocale = useMemo(
    () => activeLocales.find((l) => l.is_default) ?? activeLocales[0],
    [activeLocales],
  );

  const { data: form, isLoading } = useQuery({
    queryKey: queryKeys.form(formId),
    queryFn: () => getForm(formId),
    enabled: !!formId,
  });

  // Seed local state on first load + when server data changes.
  useEffect(() => {
    if (form) {
      const snap = toSettings(form);
      setSettings(snap);
      setOriginal(snap);
      const fs = fieldsFromResponse(form.fields);
      setFields(fs);
      setOriginalFields(fs);
      const locs = formLocsFromResponse(form);
      setLocalizations(locs);
      setOriginalLocs(locs);
    }
  }, [form]);

  const updateMutation = useMutation({
    mutationFn: (payload: UpdateFormRequest) => updateForm(formId, payload),
    onSuccess: (updated) => {
      queryClient.setQueryData(queryKeys.form(formId), updated);
      queryClient.invalidateQueries({ queryKey: queryKeys.forms(selectedSiteId) });
      const snap = toSettings(updated);
      setSettings(snap);
      setOriginal(snap);
      const fs = fieldsFromResponse(updated.fields);
      setFields(fs);
      setOriginalFields(fs);
      const locs = formLocsFromResponse(updated);
      setLocalizations(locs);
      setOriginalLocs(locs);
      showSuccess(t('formsModule.detail.messages.saved', 'Form saved.'));
    },
    onError: showError,
  });

  const deleteMutation = useMutation({
    mutationFn: () => deleteForm(formId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.forms(selectedSiteId) });
      showSuccess(t('formsModule.list.messages.deleted'));
      navigate('/forms');
    },
    onError: showError,
  });

  const settingsDirty =
    settings !== null && original !== null && Object.keys(diff(settings, original)).length > 0;
  const fieldsDirty =
    fields !== null && originalFields !== null && fieldsChanged(fields, originalFields);
  const locsDirty =
    localizations !== null && originalLocs !== null && formLocsChanged(localizations, originalLocs);
  const isDirty = settingsDirty || fieldsDirty || locsDirty;

  useFormSaveBar({
    id: 'form-detail',
    isDirty: isDirty,
    saving: updateMutation.isPending,
    saveTestId: 'forms.detail.save',
    discardTestId: 'forms.detail.discard',
    onSave: () => {
      if (!settings || !original || !fields || !localizations) return;
      const payload: UpdateFormRequest = settingsDirty ? diff(settings, original) : {};
      if (fieldsDirty) payload.fields = fields;
      if (locsDirty) payload.localizations = localizations;
      if (Object.keys(payload).length > 0) updateMutation.mutate(payload);
    },
    onDiscard: () => {
      if (original) setSettings(original);
      if (originalFields) setFields(originalFields);
      if (originalLocs) setLocalizations(originalLocs);
    },
  });

  if (isLoading || !settings || !form || !localizations) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }} data-testid="forms.detail.loading">
        <CircularProgress />
      </Box>
    );
  }

  const update = <K extends keyof SettingsState>(key: K, value: SettingsState[K]) =>
    setSettings((s) => (s ? { ...s, [key]: value } : s));

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
        <Box sx={{ display: 'grid', gap: 2, maxWidth: 720 }}>
          <TextField
            label={t('formsModule.detail.fields.name', 'Name')}
            value={settings.name}
            onChange={(e) => update('name', e.target.value)}
            fullWidth
          />
          <TextField
            label={t('formsModule.detail.fields.slug', 'Slug')}
            value={settings.slug}
            onChange={(e) => update('slug', e.target.value)}
            fullWidth
          />
          <TextField
            label={t('formsModule.detail.fields.description', 'Description')}
            value={settings.description}
            onChange={(e) => update('description', e.target.value)}
            multiline
            minRows={2}
            fullWidth
          />

          <FormControlLabel
            control={
              <Switch
                checked={settings.is_active}
                onChange={(_, v) => update('is_active', v)}
                data-testid="forms.detail.toggle.active"
              />
            }
            label={t('formsModule.detail.fields.active', 'Active')}
          />

          <FormControlLabel
            control={
              <Switch
                checked={settings.consent_required}
                onChange={(_, v) => update('consent_required', v)}
              />
            }
            label={t('formsModule.detail.fields.consentRequired', 'Require consent checkbox')}
          />

          {settings.consent_required && (
            <TextField
              label={t('formsModule.detail.fields.consentText', 'Consent text')}
              value={settings.consent_text}
              onChange={(e) => update('consent_text', e.target.value)}
              multiline
              minRows={2}
              fullWidth
            />
          )}

          <TextField
            select
            label={t('formsModule.detail.fields.botProtection', 'Bot protection')}
            value={settings.bot_protection}
            onChange={(e) => update('bot_protection', e.target.value as FormBotProtection)}
            fullWidth
          >
            <MenuItem value="none">
              {t('formsModule.detail.botProtection.none', 'None')}
            </MenuItem>
            <MenuItem value="mandatory">
              {t('formsModule.detail.botProtection.mandatory', 'Mandatory')}
            </MenuItem>
          </TextField>

          <TextField
            select
            label={t('formsModule.detail.fields.storageMode', 'Storage mode')}
            value={settings.storage_mode}
            onChange={(e) => update('storage_mode', e.target.value as FormStorageMode)}
            helperText={t(
              'formsModule.detail.fields.storageModeHelp',
              'Queryable enables admin-side search across submission data; Simple stores compactly.',
            )}
            fullWidth
          >
            <MenuItem value="simple">
              {t('formsModule.detail.storageMode.simple', 'Simple')}
            </MenuItem>
            <MenuItem value="queryable">
              {t('formsModule.detail.storageMode.queryable', 'Queryable')}
            </MenuItem>
          </TextField>

          <TextField
            label={t('formsModule.detail.fields.retentionDays', 'Retention (days)')}
            value={settings.retention_days}
            onChange={(e) => {
              const v = e.target.value;
              if (v === '') return update('retention_days', '');
              const n = Number(v);
              if (!Number.isNaN(n)) update('retention_days', n);
            }}
            type="number"
            inputMode="numeric"
            helperText={t(
              'formsModule.detail.fields.retentionDaysHelp',
              'Leave empty to keep submissions indefinitely. Positive integer auto-deletes after N days.',
            )}
            fullWidth
          />
        </Box>
      )}

      {tab === 'fields' && fields !== null && (
        <FieldBuilder fields={fields} onChange={setFields} />
      )}

      {tab === 'translations' && (
        <Box>
          <Box sx={{ display: 'flex', gap: 1, mb: 3, flexWrap: 'wrap', alignItems: 'center' }}>
            <Box sx={{ fontSize: 13, color: 'text.secondary', mr: 1 }}>
              {t('formsModule.detail.localePicker', 'Locale:')}
            </Box>
            {activeLocales
              .filter((l) => !defaultLocale || l.locale_id !== defaultLocale.locale_id)
              .map((l) => {
                const isActive = activeLocaleId === l.locale_id;
                return (
                  <button
                    key={l.locale_id}
                    type="button"
                    onClick={() => setActiveLocaleId(l.locale_id)}
                    data-testid={`forms.detail.locale.${l.code}`}
                    style={{
                      padding: '6px 14px',
                      borderRadius: 999,
                      border: '1px solid var(--outline-variant)',
                      background: isActive
                        ? 'var(--primary-container)'
                        : 'var(--surface-container-low)',
                      color: isActive ? 'var(--on-primary-container)' : 'var(--on-surface)',
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                    aria-pressed={isActive}
                  >
                    {l.native_name || l.name} ({l.code})
                  </button>
                );
              })}
          </Box>

          {activeLocaleId && fields !== null ? (
            <FormLocalePanel
              localeId={activeLocaleId}
              localeName={
                activeLocales.find((l) => l.locale_id === activeLocaleId)?.name ?? ''
              }
              localeCode={
                activeLocales.find((l) => l.locale_id === activeLocaleId)?.code ?? ''
              }
              canonicalName={settings.name}
              canonicalDescription={settings.description || null}
              canonicalConsentText={settings.consent_text || null}
              formLocs={localizations}
              onFormLocsChange={setLocalizations}
              fields={fields}
              onFieldsChange={setFields}
            />
          ) : (
            <Box
              sx={{
                border: '1px dashed var(--outline-variant)',
                borderRadius: 3,
                p: 4,
                textAlign: 'center',
                color: 'text.secondary',
              }}
            >
              {activeLocales.length <= 1
                ? t(
                    'formsModule.detail.translations.noLocales',
                    'Enable additional site locales in Site settings to translate this form.',
                  )
                : t(
                    'formsModule.detail.translations.pickLocale',
                    'Pick a locale above to add or edit translations.',
                  )}
            </Box>
          )}
        </Box>
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
