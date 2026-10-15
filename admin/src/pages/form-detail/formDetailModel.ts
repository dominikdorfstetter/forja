import type {
  FormBotProtection,
  FormDetailResponse,
  FormFieldInput,
  FormFieldResponse,
  FormLocalizationInput,
  FormStorageMode,
  UpdateFormRequest,
} from '@/types/api';

export interface SettingsState {
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

/** The editable working copy of a form: settings, field list, translations. */
export interface FormDraft {
  settings: SettingsState;
  fields: FormFieldInput[];
  localizations: FormLocalizationInput[];
}

export function fieldsFromResponse(fields: FormFieldResponse[]): FormFieldInput[] {
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

export function formLocsFromResponse(form: FormDetailResponse): FormLocalizationInput[] {
  return (form.localizations ?? []).map((l) => ({
    locale_id: l.locale_id,
    name: l.name,
    description: l.description,
    consent_text: l.consent_text,
  }));
}

export function toSettings(form: FormDetailResponse): SettingsState {
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

export function draftFromForm(form: FormDetailResponse): FormDraft {
  return {
    settings: toSettings(form),
    fields: fieldsFromResponse(form.fields),
    localizations: formLocsFromResponse(form),
  };
}

/** Structural (order-sensitive) inequality of two lists. */
function listChanged<T>(a: T[], b: T[]): boolean {
  if (a.length !== b.length) return true;
  return JSON.stringify(a) !== JSON.stringify(b);
}

/** Blank optional text is cleared server-side (sent as null). */
function blankToNull(value: string): string | null {
  return value.trim() === '' ? null : value;
}

export function diff(state: SettingsState, original: SettingsState): UpdateFormRequest {
  const out: UpdateFormRequest = {};
  if (state.name !== original.name) out.name = state.name;
  if (state.slug !== original.slug) out.slug = state.slug;
  if (state.description !== original.description) out.description = blankToNull(state.description);
  if (state.is_active !== original.is_active) out.is_active = state.is_active;
  if (state.consent_required !== original.consent_required) {
    out.consent_required = state.consent_required;
  }
  if (state.consent_text !== original.consent_text) out.consent_text = blankToNull(state.consent_text);
  if (state.bot_protection !== original.bot_protection) out.bot_protection = state.bot_protection;
  if (state.storage_mode !== original.storage_mode) out.storage_mode = state.storage_mode;
  if (state.retention_days !== original.retention_days) {
    out.retention_days = state.retention_days === '' ? null : Number(state.retention_days);
  }
  return out;
}

/** Minimal update request for a draft: changed settings, plus the full
 * fields / localizations arrays only when those changed. Empty when clean. */
export function savePayload(draft: FormDraft, original: FormDraft): UpdateFormRequest {
  const payload = diff(draft.settings, original.settings);
  if (listChanged(draft.fields, original.fields)) payload.fields = draft.fields;
  if (listChanged(draft.localizations, original.localizations)) {
    payload.localizations = draft.localizations;
  }
  return payload;
}

export function isDraftDirty(draft: FormDraft | null, original: FormDraft | null): boolean {
  return draft !== null && original !== null && Object.keys(savePayload(draft, original)).length > 0;
}

/** Retention input: empty clears it, a number sets it, anything else is
 * ignored (`undefined`). */
export function parseRetentionDays(raw: string): number | '' | undefined {
  if (raw === '') return '';
  const n = Number(raw);
  return Number.isNaN(n) ? undefined : n;
}
