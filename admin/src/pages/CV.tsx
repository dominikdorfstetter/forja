import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Alert,
  Paper,
  IconButton,
  MenuItem,
  TextField,
  Tooltip,
  Chip,
  Tab,
  Tabs,
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
    queryKey: ['cv-entries', selectedSiteId, entryTypeFilter, entryPage, entryPageSize],
    queryFn: () => apiService.getCvEntries(selectedSiteId, {
      entry_type: entryTypeFilter ? entryTypeFilter.toLowerCase() : undefined,
      page: entryPage,
      page_size: entryPageSize,
    }),
    enabled: !!selectedSiteId,
  });
  const entries = entriesData?.data;

  const { data: skillsData, isLoading: skillsLoading, error: skillsError } = useQuery({
    queryKey: ['skills', selectedSiteId, skillPage, skillPageSize],
    queryFn: () => apiService.getSkills(selectedSiteId, { page: skillPage, page_size: skillPageSize }),
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
      header: t('cv.entries.table.company'),
      scope: 'col',
      render: (entry) => entry.company,
    },
    {
      header: t('cv.entries.table.location'),
      scope: 'col',
      render: (entry) => entry.location,
    },
    {
      header: t('cv.entries.table.type'),
      scope: 'col',
      render: (entry) => <Chip label={entry.entry_type} size="small" variant="outlined" />,
    },
    {
      header: t('cv.entries.table.dates'),
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
      header: t('cv.entries.table.order'),
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
      header: t('cv.skills.table.name'),
      scope: 'col',
      render: (skill) => skill.name,
    },
    {
      header: t('cv.skills.table.slug'),
      scope: 'col',
      render: (skill) => <Box component="span" sx={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{skill.slug}</Box>,
    },
    {
      header: t('cv.skills.table.category'),
      scope: 'col',
      render: (skill) => skill.category ? <Chip label={skill.category} size="small" variant="outlined" /> : '\u2014',
    },
    {
      header: t('cv.skills.table.proficiency'),
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
              <TextField select label={t('common.filters.filterByType')} size="small" value={entryTypeFilter} onChange={(e) => { setEntryTypeFilter(e.target.value); setEntryPage(1); }} sx={{ minWidth: 200, mb: 2 }}>
                <MenuItem value="">{t('common.filters.all')}</MenuItem>
                {ENTRY_TYPES.map((type) => <MenuItem key={type} value={type}>{type}</MenuItem>)}
              </TextField>

              {entriesLoading ? (
                <LoadingState label={t('cv.entries.loading')} />
              ) : entriesError ? (
                <Alert severity="error">{t('cv.entries.loadError')}</Alert>
              ) : !entries || entries.length === 0 ? (
                <EmptyState icon={<WorkIcon sx={{ fontSize: 64 }} />} title={t('cv.entries.empty.title')} description={t('cv.entries.empty.description')} action={{ label: t('cv.entries.addEntry'), onClick: openEntryCreate }} />
              ) : (
                <Paper>
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
