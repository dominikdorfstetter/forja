import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Alert,
  Paper,
  IconButton,
  Tooltip,
  Chip,
  Tab,
  Tabs,
  TableSortLabel,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import WorkIcon from '@mui/icons-material/Work';
import SchoolIcon from '@mui/icons-material/School';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import apiService from '@/services/api';
import type {
  SkillResponse,
  CreateSkillRequest,
  UpdateSkillRequest,
  CvEntryResponse,
  CreateCvEntryRequest,
  UpdateCvEntryRequest,
  CvEntryType,
} from '@/types/api';
import { useSiteContext } from '@/store/SiteContext';
import { useAuth } from '@/store/AuthContext';
import PageHeader from '@/components/shared/PageHeader';
import LoadingState from '@/components/shared/LoadingState';
import EmptyState from '@/components/shared/EmptyState';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import SkillFormDialog from '@/components/cv/SkillFormDialog';
import CvEntryFormDialog from '@/components/cv/CvEntryFormDialog';
import DataTable, { type DataTableColumn } from '@/components/shared/DataTable';
import TableFilterBar from '@/components/shared/TableFilterBar';
import { useListPageState } from '@/hooks/useListPageState';
import { useCrudMutations } from '@/hooks/useCrudMutations';

const ENTRY_TYPES: CvEntryType[] = ['Work', 'Education', 'Volunteer', 'Certification', 'Project'];

export default function CVPage() {
  const { t } = useTranslation();
  const { selectedSiteId } = useSiteContext();
  const { canWrite, isAdmin } = useAuth();
  const [tabIndex, setTabIndex] = useState(0);
  const [entryTypeFilter, setEntryTypeFilter] = useState<string>('');

  // Entry list state
  const {
    page: entryPage, pageSize: entryPageSize,
    search: entrySearch, setSearch: setEntrySearch, debouncedSearch: entryDebouncedSearch,
    sortBy: entrySortBy, sortDir: entrySortDir, handleSort: handleEntrySort,
    formOpen: entryFormOpen, editing: editingEntry, deleting: deletingEntry,
    openCreate: openEntryCreate, closeForm: closeEntryForm,
    openEdit: setEditingEntry, closeEdit: closeEntryEdit,
    openDelete: setDeletingEntry, closeDelete: closeEntryDelete,
    handlePageChange: handleEntryPageChange, handleRowsPerPageChange: handleEntryRowsPerPageChange,
    setPage: setEntryPage,
  } = useListPageState<CvEntryResponse>();

  // Skill list state
  const {
    page: skillPage, pageSize: skillPageSize,
    search: skillSearch, setSearch: setSkillSearch, debouncedSearch: skillDebouncedSearch,
    sortBy: skillSortBy, sortDir: skillSortDir, handleSort: handleSkillSort,
    formOpen: skillFormOpen, editing: editingSkill, deleting: deletingSkill,
    openCreate: openSkillCreate, closeForm: closeSkillForm,
    openEdit: setEditingSkill, closeEdit: closeSkillEdit,
    openDelete: setDeletingSkill, closeDelete: closeSkillDelete,
    handlePageChange: handleSkillPageChange, handleRowsPerPageChange: handleSkillRowsPerPageChange,
  } = useListPageState<SkillResponse>();

  // Command palette action listener
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail === 'add-cv-entry') openEntryCreate();
      else if (detail === 'add-skill') openSkillCreate();
    };
    window.addEventListener('command-palette:action', handler);
    return () => window.removeEventListener('command-palette:action', handler);
  }, [openEntryCreate, openSkillCreate]);

  // Queries
  const { data: entriesData, isLoading: entriesLoading, error: entriesError } = useQuery({
    queryKey: ['cv-entries', selectedSiteId, entryTypeFilter, entryDebouncedSearch, entryPage, entryPageSize, entrySortBy, entrySortDir],
    queryFn: () => apiService.getCvEntries(selectedSiteId, {
      entry_type: entryTypeFilter ? entryTypeFilter.toLowerCase() : undefined,
      search: entryDebouncedSearch || undefined,
      page: entryPage,
      page_size: entryPageSize,
      sort_by: entrySortBy || undefined,
      sort_dir: entrySortBy ? entrySortDir : undefined,
    }),
    enabled: !!selectedSiteId,
  });
  const entries = entriesData?.data;

  const { data: skillsData, isLoading: skillsLoading, error: skillsError } = useQuery({
    queryKey: ['skills', selectedSiteId, skillDebouncedSearch, skillPage, skillPageSize, skillSortBy, skillSortDir],
    queryFn: () => apiService.getSkills(selectedSiteId, { search: skillDebouncedSearch || undefined, page: skillPage, page_size: skillPageSize, sort_by: skillSortBy || undefined, sort_dir: skillSortBy ? skillSortDir : undefined }),
    enabled: !!selectedSiteId,
  });
  const skills = skillsData?.data;

  // Entry mutations
  const { createMutation: createEntryMutation, updateMutation: updateEntryMutation, deleteMutation: deleteEntryMutation } = useCrudMutations<CreateCvEntryRequest, UpdateCvEntryRequest>({
    queryKey: 'cv-entries',
    create: {
      mutationFn: (data) => apiService.createCvEntry(data),
      successMessage: t('cv.entries.messages.created'),
      onSuccess: () => { closeEntryForm(); },
    },
    update: {
      mutationFn: ({ id, data }) => apiService.updateCvEntry(id, data),
      successMessage: t('cv.entries.messages.updated'),
      onSuccess: () => { closeEntryEdit(); },
    },
    delete: {
      mutationFn: (id) => apiService.deleteCvEntry(id),
      successMessage: t('cv.entries.messages.deleted'),
      onSuccess: () => { closeEntryDelete(); },
    },
  });

  // Skill mutations
  const { createMutation: createSkillMutation, updateMutation: updateSkillMutation, deleteMutation: deleteSkillMutation } = useCrudMutations<CreateSkillRequest, UpdateSkillRequest>({
    queryKey: 'skills',
    create: {
      mutationFn: (data) => apiService.createSkill(data),
      successMessage: t('cv.skills.messages.created'),
      onSuccess: () => { closeSkillForm(); },
    },
    update: {
      mutationFn: ({ id, data }) => apiService.updateSkill(id, data),
      successMessage: t('cv.skills.messages.updated'),
      onSuccess: () => { closeSkillEdit(); },
    },
    delete: {
      mutationFn: (id) => apiService.deleteSkill(id),
      successMessage: t('cv.skills.messages.deleted'),
      onSuccess: () => { closeSkillDelete(); },
    },
  });

  const getActionForTab = () => {
    if (!selectedSiteId || !canWrite) return undefined;
    if (tabIndex === 0) return { label: t('cv.entries.addEntry'), icon: <AddIcon />, onClick: openEntryCreate };
    return { label: t('cv.skills.addSkill'), icon: <AddIcon />, onClick: openSkillCreate };
  };

  const entryColumns: DataTableColumn<CvEntryResponse>[] = [
    {
      header: (
        <TableSortLabel
          active={entrySortBy === 'company'}
          direction={entrySortBy === 'company' ? entrySortDir : 'asc'}
          onClick={() => handleEntrySort('company')}
        >
          {t('cv.entries.table.company')}
        </TableSortLabel>
      ),
      scope: 'col',
      render: (entry) => entry.company,
    },
    {
      header: t('cv.entries.table.location'),
      scope: 'col',
      render: (entry) => entry.location,
    },
    {
      header: (
        <TableSortLabel
          active={entrySortBy === 'entry_type'}
          direction={entrySortBy === 'entry_type' ? entrySortDir : 'asc'}
          onClick={() => handleEntrySort('entry_type')}
        >
          {t('cv.entries.table.type')}
        </TableSortLabel>
      ),
      scope: 'col',
      render: (entry) => <Chip label={entry.entry_type} size="small" variant="outlined" />,
    },
    {
      header: (
        <TableSortLabel
          active={entrySortBy === 'start_date'}
          direction={entrySortBy === 'start_date' ? entrySortDir : 'asc'}
          onClick={() => handleEntrySort('start_date')}
        >
          {t('cv.entries.table.dates')}
        </TableSortLabel>
      ),
      scope: 'col',
      render: (entry) => (
        <>
          {format(new Date(entry.start_date), 'PP')}
          {' - '}
          {entry.is_current ? t('common.labels.present') : (entry.end_date ? format(new Date(entry.end_date), 'PP') : '\u2014')}
        </>
      ),
    },
    {
      header: t('cv.entries.table.current'),
      scope: 'col',
      render: (entry) => entry.is_current ? t('common.labels.yes') : t('common.labels.no'),
    },
    {
      header: (
        <TableSortLabel
          active={entrySortBy === 'display_order'}
          direction={entrySortBy === 'display_order' ? entrySortDir : 'asc'}
          onClick={() => handleEntrySort('display_order')}
        >
          {t('cv.entries.table.order')}
        </TableSortLabel>
      ),
      scope: 'col',
      render: (entry) => entry.display_order,
    },
    {
      header: t('cv.entries.table.actions'),
      scope: 'col',
      align: 'right',
      render: (entry) => (
        <>
          {canWrite && <Tooltip title={t('common.actions.edit')}><IconButton size="small" aria-label={t('common.actions.edit')} onClick={() => setEditingEntry(entry)}><EditIcon fontSize="small" /></IconButton></Tooltip>}
          {isAdmin && <Tooltip title={t('common.actions.delete')}><IconButton size="small" aria-label={t('common.actions.delete')} color="error" onClick={() => setDeletingEntry(entry)}><DeleteIcon fontSize="small" /></IconButton></Tooltip>}
        </>
      ),
    },
  ];

  const skillColumns: DataTableColumn<SkillResponse>[] = [
    {
      header: (
        <TableSortLabel
          active={skillSortBy === 'name'}
          direction={skillSortBy === 'name' ? skillSortDir : 'asc'}
          onClick={() => handleSkillSort('name')}
        >
          {t('cv.skills.table.name')}
        </TableSortLabel>
      ),
      scope: 'col',
      render: (skill) => skill.name,
    },
    {
      header: t('cv.skills.table.slug'),
      scope: 'col',
      render: (skill) => <Box component="span" sx={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{skill.slug}</Box>,
    },
    {
      header: (
        <TableSortLabel
          active={skillSortBy === 'category'}
          direction={skillSortBy === 'category' ? skillSortDir : 'asc'}
          onClick={() => handleSkillSort('category')}
        >
          {t('cv.skills.table.category')}
        </TableSortLabel>
      ),
      scope: 'col',
      render: (skill) => skill.category ? <Chip label={skill.category} size="small" variant="outlined" /> : '\u2014',
    },
    {
      header: (
        <TableSortLabel
          active={skillSortBy === 'proficiency_level'}
          direction={skillSortBy === 'proficiency_level' ? skillSortDir : 'asc'}
          onClick={() => handleSkillSort('proficiency_level')}
        >
          {t('cv.skills.table.proficiency')}
        </TableSortLabel>
      ),
      scope: 'col',
      render: (skill) => skill.proficiency_level != null ? `${skill.proficiency_level}%` : '\u2014',
    },
    {
      header: t('cv.skills.table.icon'),
      scope: 'col',
      render: (skill) => skill.icon || '\u2014',
    },
    {
      header: t('cv.skills.table.actions'),
      scope: 'col',
      align: 'right',
      render: (skill) => (
        <>
          {canWrite && <Tooltip title={t('common.actions.edit')}><IconButton size="small" aria-label={t('common.actions.edit')} onClick={() => setEditingSkill(skill)}><EditIcon fontSize="small" /></IconButton></Tooltip>}
          {isAdmin && <Tooltip title={t('common.actions.delete')}><IconButton size="small" aria-label={t('common.actions.delete')} color="error" onClick={() => setDeletingSkill(skill)}><DeleteIcon fontSize="small" /></IconButton></Tooltip>}
        </>
      ),
    },
  ];

  return (
    <Box data-testid="cv.page">
      <PageHeader
        title={t('cv.title')}
        subtitle={t('cv.subtitle')}
        action={getActionForTab()}
      />

      {!selectedSiteId ? (
        <EmptyState icon={<WorkIcon sx={{ fontSize: 64 }} />} title={t('common.noSiteSelected')} description={t('cv.empty.noSite')} />
      ) : (
        <>
          <Tabs value={tabIndex} onChange={(_, v) => setTabIndex(v)} sx={{ mb: 3 }}>
            <Tab icon={<WorkIcon fontSize="small" />} iconPosition="start" label={t('cv.tabs.entries')} />
            <Tab icon={<SchoolIcon fontSize="small" />} iconPosition="start" label={t('cv.tabs.skills')} />
          </Tabs>

          {/* Entries Tab */}
          {tabIndex === 0 && (
            <>
              {entriesLoading ? (
                <LoadingState label={t('cv.entries.loading')} />
              ) : entriesError ? (
                <Alert severity="error">{t('cv.entries.loadError')}</Alert>
              ) : !entries || entries.length === 0 ? (
                <EmptyState icon={<WorkIcon sx={{ fontSize: 64 }} />} title={t('cv.entries.empty.title')} description={t('cv.entries.empty.description')} action={{ label: t('cv.entries.addEntry'), onClick: openEntryCreate }} />
              ) : (
                <Paper>
                  <TableFilterBar
                    searchValue={entrySearch}
                    onSearchChange={setEntrySearch}
                    searchPlaceholder={t('cv.entries.searchPlaceholder')}
                    filters={[{
                      key: 'entryType',
                      label: t('common.filters.filterByType'),
                      value: entryTypeFilter,
                      onChange: (value) => { setEntryTypeFilter(value); setEntryPage(1); },
                      options: [
                        { value: '', label: t('common.filters.all') },
                        ...ENTRY_TYPES.map((type) => ({ value: type, label: type })),
                      ],
                    }]}
                  />
                  <DataTable<CvEntryResponse>
                    data={entries}
                    columns={entryColumns}
                    getRowKey={(entry) => entry.id}
                    meta={entriesData?.meta}
                    page={entryPage}
                    onPageChange={handleEntryPageChange}
                    rowsPerPage={entryPageSize}
                    onRowsPerPageChange={handleEntryRowsPerPageChange}
                    size="medium"
                  />
                </Paper>
              )}
            </>
          )}

          {/* Skills Tab */}
          {tabIndex === 1 && (
            <>
              {skillsLoading ? (
                <LoadingState label={t('cv.skills.loading')} />
              ) : skillsError ? (
                <Alert severity="error">{t('cv.skills.loadError')}</Alert>
              ) : !skills || skills.length === 0 ? (
                <EmptyState icon={<SchoolIcon sx={{ fontSize: 64 }} />} title={t('cv.skills.empty.title')} description={t('cv.skills.empty.description')} action={{ label: t('cv.skills.addSkill'), onClick: openSkillCreate }} />
              ) : (
                <Paper>
                  <TableFilterBar
                    searchValue={skillSearch}
                    onSearchChange={setSkillSearch}
                    searchPlaceholder={t('cv.skills.searchPlaceholder')}
                  />
                  <DataTable<SkillResponse>
                    data={skills}
                    columns={skillColumns}
                    getRowKey={(skill) => skill.id}
                    meta={skillsData?.meta}
                    page={skillPage}
                    onPageChange={handleSkillPageChange}
                    rowsPerPage={skillPageSize}
                    onRowsPerPageChange={handleSkillRowsPerPageChange}
                    size="medium"
                  />
                </Paper>
              )}
            </>
          )}
        </>
      )}

      {/* Entry Dialogs */}
      <CvEntryFormDialog open={entryFormOpen} onSubmit={(data) => createEntryMutation.mutate(data)} onClose={closeEntryForm} loading={createEntryMutation.isPending} />
      <CvEntryFormDialog open={!!editingEntry} entry={editingEntry} onSubmit={(data) => editingEntry && updateEntryMutation.mutate({ id: editingEntry.id, data })} onClose={closeEntryEdit} loading={updateEntryMutation.isPending} />
      <ConfirmDialog open={!!deletingEntry} title={t('cv.entries.deleteDialog.title')} message={t('cv.entries.deleteDialog.message', { company: deletingEntry?.company })} confirmLabel={t('common.actions.delete')} onConfirm={() => deletingEntry && deleteEntryMutation.mutate(deletingEntry.id)} onCancel={closeEntryDelete} loading={deleteEntryMutation.isPending} confirmationText={t('common.actions.delete')} />

      {/* Skill Dialogs */}
      <SkillFormDialog open={skillFormOpen} onSubmit={(data) => createSkillMutation.mutate(data)} onClose={closeSkillForm} loading={createSkillMutation.isPending} />
      <SkillFormDialog open={!!editingSkill} skill={editingSkill} onSubmit={(data) => editingSkill && updateSkillMutation.mutate({ id: editingSkill.id, data })} onClose={closeSkillEdit} loading={updateSkillMutation.isPending} />
      <ConfirmDialog open={!!deletingSkill} title={t('cv.skills.deleteDialog.title')} message={t('cv.skills.deleteDialog.message', { name: deletingSkill?.name })} confirmLabel={t('common.actions.delete')} onConfirm={() => deletingSkill && deleteSkillMutation.mutate(deletingSkill.id)} onCancel={closeSkillDelete} loading={deleteSkillMutation.isPending} confirmationText={t('common.actions.delete')} />
    </Box>
  );
}
