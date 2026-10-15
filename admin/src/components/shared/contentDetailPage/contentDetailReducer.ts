export interface ContentDetailUIState {
  activeLocaleTab: number;
  historyOpen: boolean;
  reviewDialogOpen: boolean;
  approveDialogOpen: boolean;
  archiveDialogOpen: boolean;
  restoreDialogOpen: boolean;
}

export type ContentDetailUIAction =
  | { type: 'setActiveLocaleTab'; value: number }
  | { type: 'toggleHistory' }
  | { type: 'closeHistory' }
  | { type: 'setReviewDialogOpen'; value: boolean }
  | { type: 'setApproveDialogOpen'; value: boolean }
  | { type: 'setArchiveDialogOpen'; value: boolean }
  | { type: 'setRestoreDialogOpen'; value: boolean };

export const initialContentDetailUIState: ContentDetailUIState = {
  activeLocaleTab: 0,
  historyOpen: false,
  reviewDialogOpen: false,
  approveDialogOpen: false,
  archiveDialogOpen: false,
  restoreDialogOpen: false,
};

export function contentDetailUIReducer(
  state: ContentDetailUIState,
  action: ContentDetailUIAction,
): ContentDetailUIState {
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
    default:
      return state;
  }
}
