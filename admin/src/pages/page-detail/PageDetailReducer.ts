import type { PageDetailFormData } from './pageDetailSchema';

interface PageDetailUIState {
  activeTab: number;
  historyOpen: boolean;
  reviewDialogOpen: boolean;
  approveDialogOpen: boolean;
  archiveDialogOpen: boolean;
  restoreDialogOpen: boolean;
  formVersion: number;
}

export type PageDetailUIAction =
  | { type: 'SET_ACTIVE_TAB'; payload: number }
  | { type: 'TOGGLE_HISTORY' }
  | { type: 'SET_HISTORY_OPEN'; payload: boolean }
  | { type: 'SET_REVIEW_DIALOG'; payload: boolean }
  | { type: 'SET_APPROVE_DIALOG'; payload: boolean }
  | { type: 'SET_ARCHIVE_DIALOG'; payload: boolean }
  | { type: 'SET_RESTORE_DIALOG'; payload: boolean }
  | { type: 'BUMP_FORM_VERSION' };

export const initialUIState: PageDetailUIState = {
  activeTab: 0,
  historyOpen: false,
  reviewDialogOpen: false,
  approveDialogOpen: false,
  archiveDialogOpen: false,
  restoreDialogOpen: false,
  formVersion: 0,
};

export function uiReducer(state: PageDetailUIState, action: PageDetailUIAction): PageDetailUIState {
  switch (action.type) {
    case 'SET_ACTIVE_TAB':
      return { ...state, activeTab: action.payload };
    case 'TOGGLE_HISTORY':
      return { ...state, historyOpen: !state.historyOpen };
    case 'SET_HISTORY_OPEN':
      return { ...state, historyOpen: action.payload };
    case 'SET_REVIEW_DIALOG':
      return { ...state, reviewDialogOpen: action.payload };
    case 'SET_APPROVE_DIALOG':
      return { ...state, approveDialogOpen: action.payload };
    case 'SET_ARCHIVE_DIALOG':
      return { ...state, archiveDialogOpen: action.payload };
    case 'SET_RESTORE_DIALOG':
      return { ...state, restoreDialogOpen: action.payload };
    case 'BUMP_FORM_VERSION':
      return { ...state, formVersion: state.formVersion + 1 };
    default:
      return state;
  }
}

export function buildFormDefaults(
  page: {
    route: string;
    slug?: string;
    page_type: string;
    template?: string;
    status: string;
    is_in_navigation: boolean;
    navigation_order?: number;
    parent_page_id?: string;
    publish_start?: string;
    publish_end?: string;
  },
  localization?: {
    meta_title?: string | null;
    meta_description?: string | null;
    excerpt?: string | null;
  },
): PageDetailFormData {
  return {
    route: page.route,
    slug: page.slug ?? '',
    page_type: page.page_type as PageDetailFormData['page_type'],
    template: page.template ?? '',
    status: page.status as PageDetailFormData['status'],
    is_in_navigation: page.is_in_navigation,
    navigation_order: page.navigation_order ?? '',
    parent_page_id: page.parent_page_id ?? '',
    publish_start: page.publish_start ?? null,
    publish_end: page.publish_end ?? null,
    meta_title: localization?.meta_title ?? '',
    meta_description: localization?.meta_description ?? '',
    excerpt: localization?.excerpt ?? '',
  };
}
