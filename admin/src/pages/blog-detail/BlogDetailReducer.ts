import type { BlogDetailResponse, ContentLocalizationResponse } from '@/types/api';
import type { BlogContentFormData } from './blogDetailSchema';
import type { TranslationPreview } from './BlogTranslateDialog';

export interface UIState {
  activeLocaleTab: number;
  historyOpen: boolean;
  reviewDialogOpen: boolean;
  approveDialogOpen: boolean;
  archiveDialogOpen: boolean;
  restoreDialogOpen: boolean;
  formVersion: number;
  sidebarOpen: boolean;
  sidebarTab: number;
  translateDialogOpen: boolean;
  translateLocale: string;
  translationPreview: TranslationPreview;
  refreshingField: string | null;
}

export type UIAction =
  | { type: 'setActiveLocaleTab'; value: number }
  | { type: 'toggleHistory' }
  | { type: 'closeHistory' }
  | { type: 'setReviewDialogOpen'; value: boolean }
  | { type: 'setApproveDialogOpen'; value: boolean }
  | { type: 'setArchiveDialogOpen'; value: boolean }
  | { type: 'setRestoreDialogOpen'; value: boolean }
  | { type: 'bumpFormVersion' }
  | { type: 'toggleSidebar' }
  | { type: 'closeSidebar' }
  | { type: 'setSidebarTab'; value: number }
  | { type: 'openTranslateDialog'; locale: string }
  | { type: 'closeTranslateDialog' }
  | { type: 'setTranslateLocale'; value: string }
  | { type: 'setTranslationPreview'; value: TranslationPreview }
  | { type: 'setRefreshingField'; value: string | null }
  | { type: 'applyTranslation'; tabIndex: number };

export const initialUIState: UIState = {
  activeLocaleTab: 0,
  historyOpen: false,
  reviewDialogOpen: false,
  approveDialogOpen: false,
  archiveDialogOpen: false,
  restoreDialogOpen: false,
  formVersion: 0,
  sidebarOpen: true,
  sidebarTab: 0,
  translateDialogOpen: false,
  translateLocale: '',
  translationPreview: null,
  refreshingField: null,
};

export function uiReducer(state: UIState, action: UIAction): UIState {
  switch (action.type) {
    case 'setActiveLocaleTab':
      return { ...state, activeLocaleTab: action.value };
    case 'toggleHistory':
      return { ...state, historyOpen: !state.historyOpen };
    case 'closeHistory':
      return { ...state, historyOpen: false };
    case 'setReviewDialogOpen':
      return { ...state, reviewDialogOpen: action.value };
    case 'setApproveDialogOpen':
      return { ...state, approveDialogOpen: action.value };
    case 'setArchiveDialogOpen':
      return { ...state, archiveDialogOpen: action.value };
    case 'setRestoreDialogOpen':
      return { ...state, restoreDialogOpen: action.value };
    case 'bumpFormVersion':
      return { ...state, formVersion: state.formVersion + 1 };
    case 'toggleSidebar':
      return { ...state, sidebarOpen: !state.sidebarOpen };
    case 'closeSidebar':
      return { ...state, sidebarOpen: false };
    case 'setSidebarTab':
      return { ...state, sidebarTab: action.value };
    case 'openTranslateDialog':
      return { ...state, translateDialogOpen: true, translateLocale: action.locale, translationPreview: null };
    case 'closeTranslateDialog':
      return { ...state, translateDialogOpen: false };
    case 'setTranslateLocale':
      return { ...state, translateLocale: action.value, translationPreview: null };
    case 'setTranslationPreview':
      return { ...state, translationPreview: action.value };
    case 'setRefreshingField':
      return { ...state, refreshingField: action.value };
    case 'applyTranslation':
      return { ...state, activeLocaleTab: action.tabIndex, translateDialogOpen: false, translationPreview: null };
    default:
      return state;
  }
}

export function buildFormDefaults(
  blog: BlogDetailResponse | undefined,
  loc: ContentLocalizationResponse | undefined,
): BlogContentFormData {
  return {
    title: loc?.title ?? '',
    subtitle: loc?.subtitle ?? '',
    excerpt: loc?.excerpt ?? '',
    body: loc?.body ?? '',
    meta_title: loc?.meta_title ?? '',
    meta_description: loc?.meta_description ?? '',
    author: blog?.author ?? '',
    published_date: blog?.published_date?.split('T')[0] ?? '',
    status: (blog?.status as BlogContentFormData['status']) ?? 'Draft',
    is_featured: blog?.is_featured ?? false,
    allow_comments: blog?.allow_comments ?? false,
    reading_time_minutes: blog?.reading_time_minutes ?? null,
    reading_time_override: false,
    publish_start: blog?.publish_start ?? null,
    publish_end: blog?.publish_end ?? null,
    cover_image_id: blog?.cover_image_id ?? null,
    header_image_id: blog?.header_image_id ?? null,
  };
}
