import { Alert, Box, TableCell } from '@mui/material';
import { Toolbar, ToolbarSpacer, SearchField, FilterSelect, SortableTableShell } from '@/components/shared/listPageV2';
import WorkIcon from '@mui/icons-material/Work';
import { useTranslation } from 'react-i18next';
import { reorderCvEntries } from '@/services/cv';
import type { CvEntryResponse, CvEntryType } from '@/types/api';
import LoadingState from '@/components/shared/LoadingState';
import EmptyState from '@/components/shared/EmptyState';
import SortableCvEntryRow from './SortableCvEntryRow';
import type { CvEntryRowHandlers } from './CvEntryActionsMenu';
import type { PortfolioListSectionProps } from './portfolioListTypes';
import { PortfolioPagination, SortHeaderCell } from './PortfolioListParts';
import { usePortfolioReorder } from './usePortfolioReorder';
import { queryKeys } from '@/lib/queryKeys';

const ENTRY_TYPES: CvEntryType[] = ['Work', 'Education', 'Volunteer', 'Certification', 'Project'];

interface CvEntriesSectionProps extends PortfolioListSectionProps, CvEntryRowHandlers {
  entries: CvEntryResponse[] | undefined;
  siteId: string;
  entryTypeFilter: string;
  onEntryTypeFilterChange: (value: string) => void;
}

export default function CvEntriesSection({
  entries,
  meta,
  loading,
  error,
  page,
  rowsPerPage,
  canWrite,
  isAdmin,
  siteId,
  onPage,
  onPerPage,
  onOpenCreate,
  onEdit,
  onDelete,
  searchValue,
  onSearchChange,
  sortBy,
  sortDir,
  onSort,
  entryTypeFilter,
  onEntryTypeFilterChange,
}: CvEntriesSectionProps) {
  const { t } = useTranslation();
  const { ordered: orderedEntries, activeItem: activeEntry, handleDragStart, handleDragEnd } = usePortfolioReorder(
    entries,
    (items) => reorderCvEntries(siteId, items),
    queryKeys.cvEntries(siteId),
  );
  const sort = { sortBy, sortDir, onSort };

  if (loading) {
    return <LoadingState label={t('cv.entries.loading')} />;
  }

  if (error) {
    return <Alert severity="error">{t('cv.entries.loadError')}</Alert>;
  }

  if (orderedEntries.length === 0) {
    return (
      <EmptyState
        icon={<WorkIcon sx={{ fontSize: 64 }} />}
        title={t('cv.entries.empty.title')}
        description={t('cv.entries.empty.description')}
        action={{ label: t('cv.entries.addEntry'), onClick: onOpenCreate }}
      />
    );
  }

  return (
    <Box data-testid="cv-entries.section">
      <Toolbar>
        <SearchField
          value={searchValue}
          onChange={onSearchChange}
          placeholder={t('cv.entries.searchPlaceholder')}
          data-testid="cv-entries.search"
        />
        <FilterSelect
          value={entryTypeFilter}
          onChange={onEntryTypeFilterChange}
          options={ENTRY_TYPES.map((type) => ({ value: type, label: type }))}
          placeholder={t('common.filters.filterByType')}
          width={180}
          data-testid="cv-entries.filter-entryType"
        />
        <ToolbarSpacer />
      </Toolbar>

      <SortableTableShell
        itemIds={orderedEntries.map((e) => e.id)}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        canWrite={canWrite}
        dragPreview={activeEntry?.company}
        headCells={
          <>
            <SortHeaderCell column="company" {...sort}>{t('cv.entries.table.company')}</SortHeaderCell>
            <TableCell scope="col">{t('cv.entries.table.location')}</TableCell>
            <SortHeaderCell column="entry_type" {...sort}>{t('cv.entries.table.type')}</SortHeaderCell>
            <SortHeaderCell column="start_date" {...sort}>{t('cv.entries.table.dates')}</SortHeaderCell>
            <TableCell scope="col">{t('cv.entries.table.current')}</TableCell>
            <TableCell scope="col" align="right">{t('cv.entries.table.actions')}</TableCell>
          </>
        }
      >
        {orderedEntries.map((entry) => (
          <SortableCvEntryRow
            key={entry.id}
            entry={entry}
            canWrite={canWrite}
            isAdmin={isAdmin}
            onEdit={onEdit}
            onDelete={onDelete}
          />
        ))}
      </SortableTableShell>
      {meta && <PortfolioPagination total={meta.total_items} page={page} rowsPerPage={rowsPerPage} onPage={onPage} onPerPage={onPerPage} />}
    </Box>
  );
}
