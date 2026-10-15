import { Alert, Box, TableCell } from '@mui/material';
import { Toolbar, ToolbarSpacer, SearchField, SortableTableShell } from '@/components/shared/listPageV2';
import FolderIcon from '@mui/icons-material/Folder';
import { useTranslation } from 'react-i18next';
import { reorderProjects } from '@/services/projects';
import type { ProjectResponse } from '@/types/api';
import LoadingState from '@/components/shared/LoadingState';
import EmptyState from '@/components/shared/EmptyState';
import SortableProjectRow from './SortableProjectRow';
import type { ProjectRowHandlers } from './ProjectActionsMenu';
import type { PortfolioListSectionProps } from './portfolioListTypes';
import { PortfolioPagination, SortHeaderCell } from './PortfolioListParts';
import { usePortfolioReorder } from './usePortfolioReorder';
import { queryKeys } from '@/lib/queryKeys';

interface PortfolioProjectsSectionProps extends PortfolioListSectionProps, ProjectRowHandlers {
  projects: ProjectResponse[] | undefined;
  siteId: string;
}

export default function PortfolioProjectsSection({
  projects,
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
  onPublish,
  onUnpublish,
  onDelete,
  onArchive,
  onRestore,
  searchValue,
  onSearchChange,
  sortBy,
  sortDir,
  onSort,
}: PortfolioProjectsSectionProps) {
  const { t } = useTranslation();
  const { ordered: orderedProjects, activeItem: activeProject, handleDragStart, handleDragEnd } = usePortfolioReorder(
    projects,
    (items) => reorderProjects(siteId, items),
    queryKeys.projects(siteId),
  );
  const sort = { sortBy, sortDir, onSort };

  if (loading) {
    return <LoadingState label={t('portfolio.projects.loading')} />;
  }

  if (error) {
    return <Alert severity="error" data-testid="projects-error">{t('portfolio.projects.loadError')}</Alert>;
  }

  if (orderedProjects.length === 0) {
    return (
      <EmptyState
        icon={<FolderIcon sx={{ fontSize: 64 }} />}
        title={t('portfolio.projects.empty.title')}
        description={t('portfolio.projects.empty.description')}
        action={{ label: t('portfolio.projects.addProject'), onClick: onOpenCreate }}
      />
    );
  }

  return (
    <Box data-testid="projects-section">
      <Toolbar>
        <SearchField
          value={searchValue}
          onChange={onSearchChange}
          placeholder={t('portfolio.projects.searchPlaceholder')}
          data-testid="projects-section.search"
        />
        <ToolbarSpacer />
      </Toolbar>

      <SortableTableShell
        itemIds={orderedProjects.map((p) => p.id)}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        canWrite={canWrite}
        dragPreview={activeProject?.slug}
        headCells={
          <>
            <SortHeaderCell column="slug" {...sort}>{t('portfolio.projects.table.slug')}</SortHeaderCell>
            <TableCell scope="col">{t('portfolio.projects.table.status')}</TableCell>
            <TableCell scope="col">{t('portfolio.projects.table.featured')}</TableCell>
            <SortHeaderCell column="start_date" {...sort}>{t('portfolio.projects.table.dates')}</SortHeaderCell>
            <TableCell scope="col" align="right">{t('portfolio.projects.table.actions')}</TableCell>
          </>
        }
      >
        {orderedProjects.map((project) => (
          <SortableProjectRow
            key={project.id}
            project={project}
            canWrite={canWrite}
            isAdmin={isAdmin}
            onEdit={onEdit}
            onPublish={onPublish}
            onUnpublish={onUnpublish}
            onDelete={onDelete}
            onArchive={onArchive}
            onRestore={onRestore}
          />
        ))}
      </SortableTableShell>
      {meta && <PortfolioPagination total={meta.total_items} page={page} rowsPerPage={rowsPerPage} onPage={onPage} onPerPage={onPerPage} />}
    </Box>
  );
}
