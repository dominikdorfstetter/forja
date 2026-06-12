import { useState, useCallback, useRef } from 'react';
import {
  Alert,
  Box,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TableSortLabel,
  Typography,
} from '@mui/material';
import { Pagination, Toolbar, ToolbarSpacer, SearchField } from '@/components/shared/listPageV2';
import FolderIcon from '@mui/icons-material/Folder';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  DragOverlay,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
} from '@dnd-kit/sortable';
import { useTranslation } from 'react-i18next';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { reorderProjects } from '@/services/projects';
import type { ProjectResponse, ReorderItem } from '@/types/api';
import { useErrorSnackbar } from '@/hooks/useErrorSnackbar';
import LoadingState from '@/components/shared/LoadingState';
import EmptyState from '@/components/shared/EmptyState';
import SortableProjectRow from './SortableProjectRow';
import { queryKeys } from '@/lib/queryKeys';

interface PaginationMeta {
  total_items: number;
  page: number;
  page_size: number;
}

interface PortfolioProjectsSectionProps {
  projects: ProjectResponse[] | undefined;
  meta: PaginationMeta | undefined;
  loading: boolean;
  error: Error | null;
  page: number;
  rowsPerPage: number;
  canWrite: boolean;
  isAdmin: boolean;
  siteId: string;
  onPage: (page: number) => void;
  onPerPage: (pageSize: number) => void;
  onOpenCreate: () => void;
  onEdit: (project: ProjectResponse) => void;
  onPublish: (project: ProjectResponse) => void;
  onUnpublish: (project: ProjectResponse) => void;
  onDelete: (project: ProjectResponse) => void;
  onArchive?: (project: ProjectResponse) => void;
  onRestore?: (project: ProjectResponse) => void;
  searchValue: string;
  onSearchChange: (value: string) => void;
  sortBy: string;
  sortDir: 'asc' | 'desc';
  onSort: (column: string) => void;
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
  const queryClient = useQueryClient();
  const { showError } = useErrorSnackbar();

  const [orderedProjects, setOrderedProjects] = useState<ProjectResponse[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  const prevProjectsRef = useRef<ProjectResponse[] | undefined>(undefined);
  if (projects && projects !== prevProjectsRef.current) {
    setOrderedProjects(projects);
  }
  prevProjectsRef.current = projects;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const reorderMutation = useMutation({
    mutationFn: (items: ReorderItem[]) => reorderProjects(siteId, items),
    onError: (err) => {
      showError(err);
      queryClient.invalidateQueries({ queryKey: queryKeys.projects(siteId) });
    },
  });

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setOrderedProjects((prev) => {
      const oldIndex = prev.findIndex((p) => p.id === active.id);
      const newIndex = prev.findIndex((p) => p.id === over.id);
      const reordered = arrayMove(prev, oldIndex, newIndex);
      const items: ReorderItem[] = reordered.map((project, index) => ({
        id: project.id,
        display_order: index,
      }));
      reorderMutation.mutate(items);
      return reordered;
    });
  }, [reorderMutation]);

  const activeProject = activeId ? orderedProjects.find((p) => p.id === activeId) : null;

  if (loading) {
    return <LoadingState label={t('portfolio.projects.loading')} />;
  }

  if (error) {
    return <Alert severity="error" data-testid="projects-error">{t('portfolio.projects.loadError')}</Alert>;
  }

  if (!orderedProjects || orderedProjects.length === 0) {
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

      <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
        <TableContainer
          sx={{
            borderRadius: '20px',
            border: '1px solid var(--outline-variant)',
            background: 'var(--surface-container-low)',
            '& .MuiTableHead-root .MuiTableCell-root': {
              fontSize: 11,
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '1px',
              color: 'var(--on-surface-variant)',
              background: 'transparent',
              borderBottom: '1px solid var(--outline-variant)',
              height: 44,
              py: 0,
            },
            '& .MuiTableBody-root .MuiTableCell-root': {
              borderBottom: '1px solid var(--outline-variant)',
              color: 'var(--on-surface)',
              fontSize: 14,
              background: 'transparent',
            },
            '& .MuiTableBody-root .MuiTableRow-root:last-of-type .MuiTableCell-root': {
              borderBottom: 'none',
            },
            '& .MuiTableBody-root .MuiTableRow-root:hover .MuiTableCell-root': {
              background: 'var(--surface-container)',
            },
            '& .MuiTableSortLabel-root, & .MuiTableSortLabel-active, & .MuiTableSortLabel-icon': {
              color: 'inherit !important',
            },
          }}
        >
          <Table size="small">
            <TableHead>
              <TableRow>
                {canWrite && <TableCell scope="col" sx={{ width: 48, px: 1 }} />}
                <TableCell scope="col">
                  <TableSortLabel
                    active={sortBy === 'slug'}
                    direction={sortBy === 'slug' ? sortDir : 'asc'}
                    onClick={() => onSort('slug')}
                  >
                    {t('portfolio.projects.table.slug')}
                  </TableSortLabel>
                </TableCell>
                <TableCell scope="col">{t('portfolio.projects.table.status')}</TableCell>
                <TableCell scope="col">{t('portfolio.projects.table.featured')}</TableCell>
                <TableCell scope="col">
                  <TableSortLabel
                    active={sortBy === 'start_date'}
                    direction={sortBy === 'start_date' ? sortDir : 'asc'}
                    onClick={() => onSort('start_date')}
                  >
                    {t('portfolio.projects.table.dates')}
                  </TableSortLabel>
                </TableCell>
                <TableCell scope="col" align="right">{t('portfolio.projects.table.actions')}</TableCell>
              </TableRow>
            </TableHead>
            <SortableContext items={orderedProjects.map((p) => p.id)} strategy={verticalListSortingStrategy}>
              <TableBody>
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
              </TableBody>
            </SortableContext>
          </Table>
        </TableContainer>
        <DragOverlay dropAnimation={{ duration: 200, easing: 'ease' }}>
          {activeProject ? (
            <Paper elevation={12} sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1, borderRadius: 2, bgcolor: 'background.paper', border: '1px solid', borderColor: 'primary.main', pointerEvents: 'none' }}>
              <DragIndicatorIcon fontSize="small" color="primary" />
              <Typography variant="body2" noWrap sx={{ fontWeight: 500 }}>{activeProject.slug}</Typography>
            </Paper>
          ) : null}
        </DragOverlay>
      </DndContext>
      {meta && (
        <Pagination
          total={meta.total_items}
          page={page}
          perPage={rowsPerPage}
          onPage={onPage}
          onPerPage={(n) => {
            onPerPage(n);
            onPage(1);
          }}
        />
      )}
    </Box>
  );
}
