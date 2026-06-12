import type { ReactNode } from 'react';
import type { TFunction } from 'i18next';
import type { QueryKey } from '@tanstack/react-query';
import type {
  BulkContentRequest,
  BulkContentResponse,
  ContentStatus,
  Paginated,
} from '@/types/api';
import type { DataTableV2Column } from '@/components/shared/listPageV2';

export type SortDir = 'asc' | 'desc';

export interface ListQueryParams {
  page: number;
  page_size: number;
  search?: string;
  status?: ContentStatus;
  exclude_status?: ContentStatus;
  sort_by?: string;
  sort_dir?: SortDir;
  /** Adapter-specific extension fields (e.g., page_type for Pages). */
  [key: string]: unknown;
}

export interface ChipOption {
  value: string;
  label: string;
  count?: number;
}

export interface ColumnsDeps {
  t: TFunction;
  fmt: (date: Date | number | string, pattern: string) => string;
  sortBy: string;
  sortDir: SortDir;
}

export type EntityListChrome = 'standalone' | 'embedded';

export interface EntityListAdapter<TItem, TStatusCounts = void> {
  /** Stable identifier — used for query keys, test ids, etc. */
  entityKey: string;

  /**
   * Whether the harness owns the page chrome (`PageHeader`).
   * 'embedded' lets a parent page render its own `PageHeader` and host this
   * harness inside one of its tabs (e.g. `LegalPage` → `DocumentsTab`).
   * Defaults to 'standalone'.
   */
  chrome?: EntityListChrome;

  /**
   * Optional override for row-click navigation target.
   * Defaults to `/${entityKey}s/${getItemId(item)}`.
   */
  routePath?: (item: TItem) => string;

  /**
   * Optional override for the mutation-invalidation query-key root.
   * Defaults to `${entityKey}s`. Use when an entity's existing query keys don't
   * match the convention (e.g. Legal uses `['legal']`, not `['legals']`).
   */
  queryKeyRoot?: string;

  /** Header configuration. */
  pageHeaderIcon: string;

  /**
   * i18n namespace owning all list-chrome copy. The harness resolves keys by
   * convention under `<i18nNamespace>.list.*`:
   *   title, subtitle, breadcrumb, loading, loadError,
   *   empty.{title,description,noSite}, searchPlaceholder,
   *   tabs.{active,archived}, messages.{updated,deleted}.
   * Replaces the ~13 individual `*Key` fields (one source of truth per entity).
   */
  i18nNamespace: string;

  /** Data fetching. */
  fetchList: (siteId: string, params: ListQueryParams) => Promise<Paginated<TItem>>;
  listQueryKey: (siteId: string, params: ListQueryParams) => QueryKey;
  fetchStatusCounts?: (siteId: string) => Promise<TStatusCounts>;
  statusCountsQueryKey?: (siteId: string) => QueryKey;
  /**
   * Extra query keys to invalidate after mutations, scoped to the active site
   * (e.g. `(siteId) => [queryKeys.trashCount(siteId)]`).
   */
  bulkExtraInvalidations?: (siteId: string) => readonly QueryKey[];

  /** Item shape. */
  getItemId: (item: TItem) => string;

  /** Mutations. */
  updateEntity: (id: string, data: { status: ContentStatus }) => Promise<unknown>;
  deleteEntity: (id: string) => Promise<unknown>;
  bulkAction: (siteId: string, request: BulkContentRequest) => Promise<BulkContentResponse>;

  /** Default sort. */
  defaultSort: { sortBy: string; sortDir: SortDir };

  /** Column + chip-filter builders. */
  buildColumns: (deps: ColumnsDeps) => DataTableV2Column<TItem>[];
  buildChipFilters: (deps: { t: TFunction; workflowEnabled: boolean; counts: TStatusCounts | undefined }) => ChipOption[];

  /** Test ids for the page root, table, and search field. */
  pageTestId: string;
  tableTestId: string;
  searchTestId: string;

  /** Optional: empty-state icon node (consumer renders MUI icon). */
  emptyIcon: ReactNode;
}

export interface RowDialogState<TItem> {
  publishingItem: TItem | null;
  unpublishingItem: TItem | null;
  archivingItem: TItem | null;
  restoringItem: TItem | null;
}

export interface RowDialogActions<TItem> {
  openPublish: (item: TItem) => void;
  openUnpublish: (item: TItem) => void;
  openArchive: (item: TItem) => void;
  openRestore: (item: TItem) => void;
  closePublish: () => void;
  closeUnpublish: () => void;
  closeArchive: () => void;
  closeRestore: () => void;
}

export interface BulkDialogState {
  bulkDeleteOpen: boolean;
  bulkPublishOpen: boolean;
  bulkUnpublishOpen: boolean;
  bulkArchiveOpen: boolean;
  bulkRestoreOpen: boolean;
}

export interface BulkDialogActions {
  openBulkPublish: () => void;
  openBulkUnpublish: () => void;
  openBulkArchive: () => void;
  openBulkRestore: () => void;
  openBulkDelete: () => void;
  closeAllBulk: () => void;
}

export interface RowActionsSlotProps<TItem> {
  item: TItem;
  canWrite: boolean;
  isAdmin: boolean;
  rowActions: RowDialogActions<TItem>;
  onView: (item: TItem) => void;
  onClone?: (item: TItem) => void;
  onDelete: (item: TItem) => void;
  cloneDisabled?: boolean;
}

export interface DialogsSlotProps<TItem> {
  rowState: RowDialogState<TItem>;
  rowActions: RowDialogActions<TItem>;
  bulkState: BulkDialogState;
  bulkActions: BulkDialogActions;
  bulkCount: number;
  bulkLoading: boolean;
  /** Consumer should call `mutate` for the chosen action then `closeRow*`. */
  onRowConfirmStatus: (item: TItem, status: ContentStatus) => void;
  onRowConfirmDelete: (item: TItem) => void;
  onBulkConfirm: (action: 'publish' | 'unpublish' | 'archive' | 'restore' | 'delete') => void;
  deletingItem: TItem | null;
  onDeleteCancel: () => void;
  deleteLoading: boolean;
}

export interface HeaderActionsSlotProps {
  canWrite: boolean;
  selectedSiteId: string | undefined;
  openCreate: () => void;
}

export interface ToolbarExtrasSlotProps {
  canWrite: boolean;
  selectedSiteId: string | undefined;
}

export interface EmptyStateSlotProps {
  canWrite: boolean;
  openCreate: () => void;
}

export interface CreateFormSlotProps {
  formOpen: boolean;
  closeForm: () => void;
}

export interface EntityListPageProps<TItem, TStatusCounts = void> {
  adapter: EntityListAdapter<TItem, TStatusCounts>;
  renderRowActions: (props: RowActionsSlotProps<TItem>) => ReactNode;
  renderDialogs: (props: DialogsSlotProps<TItem>) => ReactNode;
  renderHeaderActions?: (props: HeaderActionsSlotProps) => ReactNode;
  renderToolbarExtras?: (props: ToolbarExtrasSlotProps) => ReactNode;
  renderEmptyState?: (props: EmptyStateSlotProps) => ReactNode;
  renderCreateForm?: (props: CreateFormSlotProps) => ReactNode;
  /** Extra params merged into the list query (e.g. `page_type` for Pages). */
  extraQueryParams?: Record<string, unknown>;
  /** Extra reactive deps for the list query key (consumer-owned filters). */
  extraQueryDeps?: readonly unknown[];
}
