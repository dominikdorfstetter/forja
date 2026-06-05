import { useEffect, useState, type ReactNode } from 'react';
import { useParams, useNavigate } from 'react-router';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Tab,
  Tabs,
} from '@mui/material';
import WorkIcon from '@mui/icons-material/Work';
import SchoolIcon from '@mui/icons-material/School';
import FolderSpecialIcon from '@mui/icons-material/FolderSpecial';
import { useQuery } from '@tanstack/react-query';
import { createCvEntry, deleteCvEntry, getCvEntries, updateCvEntry } from '@/services/cv';
import { createProject, deleteProject, getProjects, updateProject } from '@/services/projects';
import { createSkill, deleteSkill, getSkills, updateSkill } from '@/services/skills';
import type {
  SkillResponse,
  CreateSkillRequest,
  UpdateSkillRequest,
  CvEntryResponse,
  CreateCvEntryRequest,
  UpdateCvEntryRequest,
  ProjectResponse,
  CreateProjectRequest,
  UpdateProjectRequest,
} from '@/types/api';
import { useSiteContext } from '@/store/SiteContext';
import { useAuth } from '@/store/AuthContext';
import { PageHeader, pageTabsSx } from '@/components/shared/listPageV2';
import { M3Button } from '@/components/design-system';
import EmptyState from '@/components/shared/EmptyState';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import SkillFormDialog from '@/components/portfolio/SkillFormDialog';
import CvEntryWizard from '@/components/portfolio/CvEntryWizard';
import CvEntriesSection from '@/components/portfolio/CvEntriesSection';
import CvSkillsSection from '@/components/portfolio/CvSkillsSection';
import PortfolioProjectsSection from '@/components/portfolio/PortfolioProjectsSection';
import ProjectWizard from '@/components/portfolio/ProjectWizard';
import { useListPageState } from '@/hooks/useListPageState';
import { useCrudMutations } from '@/hooks/useCrudMutations';

// URL tab slug → tab index. Lets users deep-link to a specific tab and
// keeps the breadcrumb in sync with the active view. The slug is stable
// across translations; the visible label is i18n'd separately.
const TAB_SLUGS = ['entries', 'skills', 'projects'] as const;
type TabSlug = (typeof TAB_SLUGS)[number];

function slugToIndex(slug: string | undefined): number {
  const i = TAB_SLUGS.indexOf(slug as TabSlug);
  return i === -1 ? 0 : i;
}

export default function PortfolioPage() {
  const { t } = useTranslation();
  const { selectedSiteId } = useSiteContext();
  const { canWrite, isAdmin } = useAuth();
  const { tab: tabParam } = useParams<{ tab?: string }>();
  const navigate = useNavigate();
  const tabIndex = slugToIndex(tabParam);
  const setTabIndex = (i: number) => {
    navigate(`/portfolio/${TAB_SLUGS[i]}`, { replace: false });
  };
  const [entryTypeFilter, setEntryTypeFilter] = useState<string>('');

  // Canonicalize `/portfolio` → `/portfolio/entries` so the URL always
  // reflects the visible tab and deep-links are round-trippable.
  useEffect(() => {
    if (!tabParam) navigate('/portfolio/entries', { replace: true });
  }, [tabParam, navigate]);

  // Entry list state
  const {
    page: entryPage, pageSize: entryPageSize, setPage: setEntryPage, setPageSize: setEntryPageSize,
    search: entrySearch, setSearch: setEntrySearch, debouncedSearch: entryDebouncedSearch,
    sortBy: entrySortBy, sortDir: entrySortDir, handleSort: handleEntrySort,
    formOpen: entryFormOpen, editing: editingEntry, deleting: deletingEntry,
    openCreate: openEntryCreate, closeForm: closeEntryForm,
    openEdit: setEditingEntry, closeEdit: closeEntryEdit,
    openDelete: setDeletingEntry, closeDelete: closeEntryDelete,
  } = useListPageState<CvEntryResponse>({ initialSortBy: 'start_date', initialSortDir: 'desc' });

  // Skill list state
  const {
    page: skillPage, pageSize: skillPageSize, setPage: setSkillPage, setPageSize: setSkillPageSize,
    search: skillSearch, setSearch: setSkillSearch, debouncedSearch: skillDebouncedSearch,
    sortBy: skillSortBy, sortDir: skillSortDir, handleSort: handleSkillSort,
    formOpen: skillFormOpen, editing: editingSkill, deleting: deletingSkill,
    openCreate: openSkillCreate, closeForm: closeSkillForm,
    openEdit: setEditingSkill, closeEdit: closeSkillEdit,
    openDelete: setDeletingSkill, closeDelete: closeSkillDelete,
  } = useListPageState<SkillResponse>();

  // Project list state
  const {
    page: projectPage, pageSize: projectPageSize, setPage: setProjectPage, setPageSize: setProjectPageSize,
    search: projectSearch, setSearch: setProjectSearch, debouncedSearch: projectDebouncedSearch,
    sortBy: projectSortBy, sortDir: projectSortDir, handleSort: handleProjectSort,
    formOpen: projectFormOpen, editing: editingProject, deleting: deletingProject,
    openCreate: openProjectCreate, closeForm: closeProjectForm,
    openEdit: setEditingProject, closeEdit: closeProjectEdit,
    openDelete: setDeletingProject, closeDelete: closeProjectDelete,
  } = useListPageState<ProjectResponse>({ initialSortBy: 'start_date', initialSortDir: 'desc' });

  // Command palette action listener
  useEffect(() => {
    const handler = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail === 'add-cv-entry') { navigate('/portfolio/entries'); openEntryCreate(); }
      else if (detail === 'add-skill') { navigate('/portfolio/skills'); openSkillCreate(); }
      else if (detail === 'add-project') { navigate('/portfolio/projects'); openProjectCreate(); }
    };
    window.addEventListener('command-palette:action', handler);
    return () => window.removeEventListener('command-palette:action', handler);
  }, [openEntryCreate, openSkillCreate, openProjectCreate, navigate]);

  // Queries
  const { data: entriesData, isLoading: entriesLoading, error: entriesError } = useQuery({
    queryKey: ['cv-entries', selectedSiteId, entryTypeFilter, entryDebouncedSearch, entryPage, entryPageSize, entrySortBy, entrySortDir],
    queryFn: () => getCvEntries(selectedSiteId, {
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
    queryFn: () => getSkills(selectedSiteId, { search: skillDebouncedSearch || undefined, page: skillPage, page_size: skillPageSize, sort_by: skillSortBy || undefined, sort_dir: skillSortBy ? skillSortDir : undefined }),
    enabled: !!selectedSiteId,
  });
  const skills = skillsData?.data;

  // Entry mutations
  const { createMutation: createEntryMutation, updateMutation: updateEntryMutation, deleteMutation: deleteEntryMutation } = useCrudMutations<CreateCvEntryRequest, UpdateCvEntryRequest>({
    queryKey: 'cv-entries',
    create: {
      mutationFn: (data) => createCvEntry(data),
      successMessage: t('cv.entries.messages.created'),
      onSuccess: () => { closeEntryForm(); },
    },
    update: {
      mutationFn: ({ id, data }) => updateCvEntry(id, data),
      successMessage: t('cv.entries.messages.updated'),
      onSuccess: () => { closeEntryEdit(); },
    },
    delete: {
      mutationFn: (id) => deleteCvEntry(id),
      successMessage: t('cv.entries.messages.deleted'),
      onSuccess: () => { closeEntryDelete(); },
    },
  });

  // Skill mutations
  const { createMutation: createSkillMutation, updateMutation: updateSkillMutation, deleteMutation: deleteSkillMutation } = useCrudMutations<CreateSkillRequest, UpdateSkillRequest>({
    queryKey: 'skills',
    create: {
      mutationFn: (data) => createSkill(data),
      successMessage: t('cv.skills.messages.created'),
      onSuccess: () => { closeSkillForm(); },
    },
    update: {
      mutationFn: ({ id, data }) => updateSkill(id, data),
      successMessage: t('cv.skills.messages.updated'),
      onSuccess: () => { closeSkillEdit(); },
    },
    delete: {
      mutationFn: (id) => deleteSkill(id),
      successMessage: t('cv.skills.messages.deleted'),
      onSuccess: () => { closeSkillDelete(); },
    },
  });

  // Projects query
  const { data: projectsData, isLoading: projectsLoading, error: projectsError } = useQuery({
    queryKey: ['projects', selectedSiteId, projectDebouncedSearch, projectPage, projectPageSize, projectSortBy, projectSortDir],
    queryFn: () => getProjects(selectedSiteId, {
      search: projectDebouncedSearch || undefined,
      page: projectPage,
      page_size: projectPageSize,
      sort_by: projectSortBy || undefined,
      sort_dir: projectSortBy ? projectSortDir : undefined,
    }),
    enabled: !!selectedSiteId,
  });
  const projects = projectsData?.data;

  // Project mutations
  const { createMutation: createProjectMutation, updateMutation: updateProjectMutation, deleteMutation: deleteProjectMutation } = useCrudMutations<CreateProjectRequest, UpdateProjectRequest>({
    queryKey: 'projects',
    create: {
      mutationFn: (data) => createProject(data),
      successMessage: t('portfolio.projects.messages.created'),
      onSuccess: () => { closeProjectForm(); },
    },
    update: {
      mutationFn: ({ id, data }) => updateProject(id, data),
      successMessage: t('portfolio.projects.messages.updated'),
      onSuccess: () => { closeProjectEdit(); },
    },
    delete: {
      mutationFn: (id) => deleteProject(id),
      successMessage: t('portfolio.projects.messages.deleted'),
      onSuccess: () => { closeProjectDelete(); },
    },
  });

  // Project status handlers
  const handlePublishProject = (project: ProjectResponse) => {
    updateProjectMutation.mutate({ id: project.id, data: { status: 'Published' } });
  };
  const handleUnpublishProject = (project: ProjectResponse) => {
    updateProjectMutation.mutate({ id: project.id, data: { status: 'Draft' } });
  };
  const handleArchiveProject = (project: ProjectResponse) => {
    updateProjectMutation.mutate({ id: project.id, data: { status: 'Archived' } });
  };
  const handleRestoreProject = (project: ProjectResponse) => {
    updateProjectMutation.mutate({ id: project.id, data: { status: 'Draft' } });
  };

  let headerAction: ReactNode = null;
  if (selectedSiteId && canWrite) {
    if (tabIndex === 0) {
      headerAction = (
        <M3Button size="md" icon="add" onClick={openEntryCreate} data-testid="create-cv-entry">
          {t('cv.entries.addEntry')}
        </M3Button>
      );
    } else if (tabIndex === 1) {
      headerAction = (
        <M3Button size="md" icon="add" onClick={openSkillCreate} data-testid="create-skill">
          {t('cv.skills.addSkill')}
        </M3Button>
      );
    } else {
      headerAction = (
        <M3Button size="md" icon="add" onClick={openProjectCreate} data-testid="create-project">
          {t('portfolio.projects.addProject')}
        </M3Button>
      );
    }
  }

  const tabLabels: Record<TabSlug, string> = {
    entries: t('portfolio.tabs.cv'),
    skills: t('cv.tabs.skills'),
    projects: t('portfolio.tabs.projects'),
  };
  const activeTabLabel = tabLabels[TAB_SLUGS[tabIndex]];
  const breadcrumb =
    t('layout.sidebar.content') +
    ' / ' +
    t('portfolio.pageTitle') +
    ' / ' +
    activeTabLabel;

  return (
    <Box data-testid="portfolio.page">
      <PageHeader
        icon="work"
        breadcrumb={breadcrumb}
        title={t('portfolio.pageTitle')}
        subtitle={t('portfolio.pageSubtitle')}
        actions={headerAction}
      />

      {!selectedSiteId ? (
        <EmptyState icon={<WorkIcon sx={{ fontSize: 64 }} />} title={t('common.noSiteSelected')} description={t('cv.empty.noSite')} />
      ) : (
        <>
          <Tabs value={tabIndex} onChange={(_, v) => setTabIndex(v)} sx={pageTabsSx}>
            <Tab icon={<WorkIcon fontSize="small" />} iconPosition="start" label={t('portfolio.tabs.cv')} data-testid="portfolio.tab.entries" />
            <Tab icon={<SchoolIcon fontSize="small" />} iconPosition="start" label={t('cv.tabs.skills')} data-testid="portfolio.tab.skills" />
            <Tab icon={<FolderSpecialIcon fontSize="small" />} iconPosition="start" label={t('portfolio.tabs.projects')} data-testid="portfolio.tab.projects" />
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
              siteId={selectedSiteId}
              onPage={setEntryPage}
              onPerPage={setEntryPageSize}
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
              onPage={setSkillPage}
              onPerPage={setSkillPageSize}
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

          {tabIndex === 2 && (
            <PortfolioProjectsSection
              projects={projects}
              meta={projectsData?.meta}
              loading={projectsLoading}
              error={projectsError}
              page={projectPage}
              rowsPerPage={projectPageSize}
              canWrite={canWrite}
              isAdmin={isAdmin}
              siteId={selectedSiteId}
              onPage={setProjectPage}
              onPerPage={setProjectPageSize}
              onOpenCreate={openProjectCreate}
              onEdit={setEditingProject}
              onPublish={handlePublishProject}
              onUnpublish={handleUnpublishProject}
              onDelete={setDeletingProject}
              onArchive={handleArchiveProject}
              onRestore={handleRestoreProject}
              searchValue={projectSearch}
              onSearchChange={setProjectSearch}
              sortBy={projectSortBy}
              sortDir={projectSortDir}
              onSort={handleProjectSort}
            />
          )}
        </>
      )}

      {/* Entry Dialogs */}
      <CvEntryWizard open={entryFormOpen} onSubmit={(data) => createEntryMutation.mutate(data as CreateCvEntryRequest)} onClose={closeEntryForm} loading={createEntryMutation.isPending} />
      <CvEntryWizard open={!!editingEntry} entry={editingEntry} onSubmit={(data) => editingEntry && updateEntryMutation.mutate({ id: editingEntry.id, data: data as UpdateCvEntryRequest })} onClose={closeEntryEdit} loading={updateEntryMutation.isPending} />
      <ConfirmDialog open={!!deletingEntry} title={t('cv.entries.deleteDialog.title')} message={t('cv.entries.deleteDialog.message', { company: deletingEntry?.company })} confirmLabel={t('common.actions.delete')} onConfirm={() => deletingEntry && deleteEntryMutation.mutate(deletingEntry.id)} onCancel={closeEntryDelete} loading={deleteEntryMutation.isPending} confirmationText={t('common.actions.delete')} />

      {/* Skill Dialogs */}
      <SkillFormDialog open={skillFormOpen} onSubmit={(data) => createSkillMutation.mutate(data)} onClose={closeSkillForm} loading={createSkillMutation.isPending} />
      <SkillFormDialog open={!!editingSkill} skill={editingSkill} onSubmit={(data) => editingSkill && updateSkillMutation.mutate({ id: editingSkill.id, data })} onClose={closeSkillEdit} loading={updateSkillMutation.isPending} />
      <ConfirmDialog open={!!deletingSkill} title={t('cv.skills.deleteDialog.title')} message={t('cv.skills.deleteDialog.message', { name: deletingSkill?.name })} confirmLabel={t('common.actions.delete')} onConfirm={() => deletingSkill && deleteSkillMutation.mutate(deletingSkill.id)} onCancel={closeSkillDelete} loading={deleteSkillMutation.isPending} confirmationText={t('common.actions.delete')} />

      {/* Project Dialogs */}
      <ProjectWizard open={projectFormOpen} onSubmit={(data) => createProjectMutation.mutate(data as CreateProjectRequest)} onClose={closeProjectForm} loading={createProjectMutation.isPending} />
      <ProjectWizard open={!!editingProject} project={editingProject} onSubmit={(data) => editingProject && updateProjectMutation.mutate({ id: editingProject.id, data: data as UpdateProjectRequest })} onClose={closeProjectEdit} loading={updateProjectMutation.isPending} />
      <ConfirmDialog open={!!deletingProject} title={t('portfolio.projects.deleteDialog.title')} message={t('portfolio.projects.deleteDialog.message', { slug: deletingProject?.slug })} confirmLabel={t('common.actions.delete')} onConfirm={() => deletingProject && deleteProjectMutation.mutate(deletingProject.id)} onCancel={closeProjectDelete} loading={deleteProjectMutation.isPending} confirmationText={t('common.actions.delete')} />
    </Box>
  );
}
