import { useState, useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Tab,
  Tabs,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import WorkIcon from '@mui/icons-material/Work';
import SchoolIcon from '@mui/icons-material/School';
import { useQuery } from '@tanstack/react-query';
import apiService from '@/services/api';
import type {
  SkillResponse,
  CreateSkillRequest,
  UpdateSkillRequest,
  CvEntryResponse,
  CreateCvEntryRequest,
  UpdateCvEntryRequest,
} from '@/types/api';
import { useSiteContext } from '@/store/SiteContext';
import { useAuth } from '@/store/AuthContext';
import PageHeader from '@/components/shared/PageHeader';
import EmptyState from '@/components/shared/EmptyState';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import SkillFormDialog from '@/components/cv/SkillFormDialog';
import CvEntryFormDialog from '@/components/cv/CvEntryFormDialog';
import CvEntriesSection from '@/components/cv/CvEntriesSection';
import CvSkillsSection from '@/components/cv/CvSkillsSection';
import { useListPageState } from '@/hooks/useListPageState';
import { useCrudMutations } from '@/hooks/useCrudMutations';

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

          {tabIndex === 0 && (
            <CvEntriesSection
              entries={entries}
              meta={entriesData?.meta}
              loading={entriesLoading}
              error={entriesError}
              page={entryPage}
              rowsPerPage={entryPageSize}
              canWrite={canWrite}
              isAdmin={isAdmin}
              onPageChange={handleEntryPageChange}
              onRowsPerPageChange={handleEntryRowsPerPageChange}
              onOpenCreate={openEntryCreate}
              onEdit={setEditingEntry}
              onDelete={setDeletingEntry}
              searchValue={entrySearch}
              onSearchChange={setEntrySearch}
              sortBy={entrySortBy}
              sortDir={entrySortDir}
              onSort={handleEntrySort}
              entryTypeFilter={entryTypeFilter}
              onEntryTypeFilterChange={(value) => { setEntryTypeFilter(value); setEntryPage(1); }}
            />
          )}

          {tabIndex === 1 && (
            <CvSkillsSection
              skills={skills}
              meta={skillsData?.meta}
              loading={skillsLoading}
              error={skillsError}
              page={skillPage}
              rowsPerPage={skillPageSize}
              canWrite={canWrite}
              isAdmin={isAdmin}
              onPageChange={handleSkillPageChange}
              onRowsPerPageChange={handleSkillRowsPerPageChange}
              onOpenCreate={openSkillCreate}
              onEdit={setEditingSkill}
              onDelete={setDeletingSkill}
              searchValue={skillSearch}
              onSearchChange={setSkillSearch}
              sortBy={skillSortBy}
              sortDir={skillSortDir}
              onSort={handleSkillSort}
            />
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
