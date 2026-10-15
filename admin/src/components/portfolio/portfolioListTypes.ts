export interface PaginationMeta {
  total_items: number;
  page: number;
  page_size: number;
}

/** Props shared by the paginated, searchable, sortable portfolio list sections. */
export interface PortfolioListSectionProps {
  meta: PaginationMeta | undefined;
  loading: boolean;
  error: Error | null;
  page: number;
  rowsPerPage: number;
  canWrite: boolean;
  isAdmin: boolean;
  onPage: (page: number) => void;
  onPerPage: (pageSize: number) => void;
  onOpenCreate: () => void;
  searchValue: string;
  onSearchChange: (value: string) => void;
  sortBy: string;
  sortDir: 'asc' | 'desc';
  onSort: (column: string) => void;
}
