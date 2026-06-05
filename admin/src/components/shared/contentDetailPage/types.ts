import type { ReactNode } from 'react';
import type { Control, FieldValues, UseFormGetValues, UseFormReset, UseFormSetValue, UseFormWatch, FormState } from 'react-hook-form';
import type { QueryKey } from '@tanstack/react-query';
import type { ZodSchema } from 'zod';
import type { TFunction } from 'i18next';
import type { ContentStatus, PreviewTemplate, ReviewActionRequest, SiteLocaleResponse } from '@/types/api';

export interface ActiveLocale {
  id: string;
  code: string;
  name: string;
  native_name?: string | null;
  direction: SiteLocaleResponse['direction'];
  is_active: boolean;
  created_at: string;
}

export interface BreadcrumbEntry {
  label: string;
  path?: string;
}

export interface FormHistoryHandle {
  canUndo: boolean;
  canRedo: boolean;
  undo: () => void;
  redo: () => void;
  snapshot: () => void;
}

export interface WorkflowFlags {
  workflowEnabled: boolean;
  canSubmitForReview: boolean;
  canApprove: boolean;
  canRequestChanges: boolean;
  canPublish: boolean;
  canUnpublish: boolean;
  canArchive: boolean;
  canRestore: boolean;
  canSchedule: boolean;
}

export interface WorkflowHandlers {
  handleSubmitForReview: () => void;
  handleApproveClick: () => void;
  handleApprovePublishNow: () => void;
  handleApproveSchedule: (date: string) => void;
  handleRequestChanges: () => void;
  handleReviewCommentSubmit: (comment?: string) => void;
  handlePublish: () => void;
  handleUnpublish: () => void;
  handleArchiveClick: () => void;
  handleArchiveConfirm: () => void;
  handleRestoreClick: () => void;
  handleRestore: () => void;
  handleRestoreAsDraft: () => void;
}

export interface DialogState {
  historyOpen: boolean;
  reviewDialogOpen: boolean;
  approveDialogOpen: boolean;
  archiveDialogOpen: boolean;
  restoreDialogOpen: boolean;
  closeHistory: () => void;
  closeReviewDialog: () => void;
  closeApproveDialog: () => void;
  closeArchiveDialog: () => void;
  closeRestoreDialog: () => void;
}

export interface ContentDetailAdapter<TDetail, TFormData extends FieldValues, TLoc> {
  /** Stable identifier — used for navigation guard key, history entityType, etc. */
  entityKey: string;

  /** Fetch the detail entity. */
  fetchDetail: (id: string) => Promise<TDetail>;
  detailQueryKey: (id: string) => QueryKey;
  /** Extra query keys to invalidate on mutation success (e.g., the list page's queries). */
  invalidateOnSave?: readonly QueryKey[];

  /** Extract localizations from a loaded detail (or [] if not yet loaded). */
  getLocalizations: (detail: TDetail | undefined) => readonly TLoc[];
  getLocalizationLocaleId: (loc: TLoc) => string;

  /** Form schema and shape. */
  schema: ZodSchema<TFormData>;
  buildFormDefaults: (detail: TDetail | undefined, loc: TLoc | undefined) => TFormData;
  buildEntityUpdates: (values: TFormData, detail: TDetail) => Record<string, unknown>;
  buildLocalizationData: (values: TFormData) => Record<string, unknown>;
  /** Optional gate for whether localization-side fields changed — page-detail uses this. */
  hasLocalizationChanges?: (values: TFormData, loc: TLoc | undefined) => boolean;
  /** Optional title field passed to localization save (blog/legal save title on loc; page does not). */
  getLocTitleField?: (values: TFormData) => string | undefined;

  /** Mutations. */
  updateEntity: (id: string, data: Record<string, unknown>) => Promise<unknown>;
  createLocalization: (entityId: string, localeId: string, data: Record<string, unknown>) => Promise<unknown>;
  updateLocalization: (locId: string, data: Record<string, unknown>) => Promise<unknown>;
  reviewEntity?: (id: string, data: ReviewActionRequest) => Promise<{ message: string }>;

  /** i18n key namespace for default messages (e.g. `${ns}.messages.saved`). */
  i18nNamespace: string;

  /** Header. */
  getIcon: () => string;
  getTitle: (detail: TDetail, t: TFunction) => string;
  getSubtitle?: (detail: TDetail, t: TFunction) => string;
  getBreadcrumbs: (detail: TDetail, t: TFunction) => readonly BreadcrumbEntry[];
  getPreviewPath: (detail: TDetail) => string;

  /** Behaviour flags. */
  multiLocaleTabs: boolean;

  /** Optional hooks the consumer wants invoked at lifecycle moments. */
  onPublishStart?: () => void;
  onPublishSuccess?: (detail: TDetail) => void;

  /** Optional test id for the root box. */
  pageTestId?: string;
}

export interface ToolbarSlotProps<TFormData extends FieldValues, TDetail> {
  control: Control<TFormData, unknown, TFormData>;
  watch: UseFormWatch<TFormData>;
  setValue: UseFormSetValue<TFormData>;
  getValues: UseFormGetValues<TFormData>;
  history: FormHistoryHandle;
  onSave: () => void;
  isSaving: boolean;
  canWrite: boolean;
  workflow: WorkflowFlags;
  handlers: WorkflowHandlers;
  detail: TDetail;
  /** Toggles the standard history drawer. */
  onToggleHistory: () => void;
  /** Resolved by usePreviewUrl. */
  previewTemplates: PreviewTemplate[];
  onPreview: (templateUrl: string | undefined) => void;
}

export interface EditorSlotProps<TFormData extends FieldValues, TDetail> {
  control: Control<TFormData, unknown, TFormData>;
  watch: UseFormWatch<TFormData>;
  setValue: UseFormSetValue<TFormData>;
  getValues: UseFormGetValues<TFormData>;
  formState: FormState<TFormData>;
  reset: UseFormReset<TFormData>;
  detail: TDetail;
  canWrite: boolean;
  selectedSiteId: string;
  takeSnapshot: () => void;
  activeLocales: readonly ActiveLocale[];
}

export interface StandardDialogsSlotProps<TDetail> {
  detail: TDetail;
  isSaving: boolean;
  reviewLoading: boolean;
  approveLoading: boolean;
  dialogs: DialogState;
  handlers: WorkflowHandlers;
}

export interface ExtraSlotProps<TFormData extends FieldValues, TDetail> extends EditorSlotProps<TFormData, TDetail> {
  /** Persist the current form (replaces the old autosave `flush`). */
  save: () => Promise<void>;
  isDirty: boolean;
  activeLocales: readonly ActiveLocale[];
  currentLocale: ActiveLocale | undefined;
  setActiveLocaleTab: (idx: number) => void;
  formStatus: ContentStatus;
  /**
   * Cache form values for a specific locale id. The cached values are used as
   * defaults the next time that locale tab becomes active. Used by translation
   * flows that prepare translated values before switching tabs.
   */
  cacheFormValues: (localeId: string, values: TFormData) => void;
  getCachedFormValues: (localeId: string) => TFormData | undefined;
}

export interface ContentDetailPageProps<TDetail, TFormData extends FieldValues, TLoc> {
  adapter: ContentDetailAdapter<TDetail, TFormData, TLoc>;
  renderToolbar: (props: ToolbarSlotProps<TFormData, TDetail>) => ReactNode;
  renderEditor: (props: EditorSlotProps<TFormData, TDetail>) => ReactNode;
  renderStandardDialogs: (props: StandardDialogsSlotProps<TDetail>) => ReactNode;
  renderExtraPanels?: (props: ExtraSlotProps<TFormData, TDetail>) => ReactNode;
  renderExtraDialogs?: (props: ExtraSlotProps<TFormData, TDetail>) => ReactNode;
  renderHeaderExtras?: (props: { detail: TDetail }) => ReactNode;
}
