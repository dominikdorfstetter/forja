import type { SectionLocalizationResponse } from '@/types/api';

export interface LocaleFormData {
  title: string;
  text: string;
  buttonText: string;
  /** Per-locale `settings.items` override — `null` = fall back to default. */
  items: Record<string, unknown>[] | null;
}

export interface EditorState {
  activeTab: number;
  localeForm: LocaleFormData;
  dirtyVersion: number;
  coverImageId: string;
  ctaRoute: string;
  settings: Record<string, unknown>;
  pickerOpen: boolean;
}

export type EditorAction =
  | { type: 'INIT_SECTION'; coverImageId: string; ctaRoute: string; settings: Record<string, unknown> }
  | { type: 'SET_ACTIVE_TAB'; value: number }
  | { type: 'SET_LOCALE_FORM'; value: LocaleFormData }
  | { type: 'UPDATE_LOCALE_FIELD'; field: 'title' | 'text' | 'buttonText'; value: string }
  | { type: 'SET_LOCALE_ITEMS'; value: Record<string, unknown>[] | null }
  | { type: 'BUMP_DIRTY_VERSION' }
  | { type: 'SET_COVER_IMAGE_ID'; value: string }
  | { type: 'SET_CTA_ROUTE'; value: string }
  | { type: 'SET_SETTINGS'; value: Record<string, unknown> }
  | { type: 'SET_PICKER_OPEN'; value: boolean };

export const initialEditorState: EditorState = {
  activeTab: 0, localeForm: { title: '', text: '', buttonText: '', items: null },
  dirtyVersion: 0, coverImageId: '', ctaRoute: '', settings: {},
  pickerOpen: false,
};

export function editorReducer(state: EditorState, action: EditorAction): EditorState {
  switch (action.type) {
    case 'INIT_SECTION': return { ...initialEditorState, coverImageId: action.coverImageId, ctaRoute: action.ctaRoute, settings: action.settings };
    case 'SET_ACTIVE_TAB': return { ...state, activeTab: action.value };
    case 'SET_LOCALE_FORM': return { ...state, localeForm: action.value };
    case 'UPDATE_LOCALE_FIELD': return { ...state, localeForm: { ...state.localeForm, [action.field]: action.value } };
    case 'SET_LOCALE_ITEMS': return { ...state, localeForm: { ...state.localeForm, items: action.value } };
    case 'BUMP_DIRTY_VERSION': return { ...state, dirtyVersion: state.dirtyVersion + 1 };
    case 'SET_COVER_IMAGE_ID': return { ...state, coverImageId: action.value };
    case 'SET_CTA_ROUTE': return { ...state, ctaRoute: action.value };
    case 'SET_SETTINGS': return { ...state, settings: action.value };
    case 'SET_PICKER_OPEN': return { ...state, pickerOpen: action.value };
  }
}

/** Locale form for a persisted localization — empty fields when there is none. */
export function localeFormFrom(loc: SectionLocalizationResponse | undefined): LocaleFormData {
  return {
    title: loc?.title || '',
    text: loc?.text || '',
    buttonText: loc?.button_text || '',
    items: (loc?.items as Record<string, unknown>[] | null | undefined) ?? null,
  };
}
