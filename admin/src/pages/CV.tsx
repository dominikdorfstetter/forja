import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  Box,
  Alert,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  IconButton,
  MenuItem,
  TextField,
  Tooltip,
  Chip,
  Tab,
  Tabs,
  TablePagination,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import WorkIcon from '@mui/icons-material/Work';
import SchoolIcon from '@mui/icons-material/School';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useSnackbar } from 'notistack';
import { format } from 'date-fns';
import apiService from '@/services/api';
import { resolveError } from '@/utils/errorResolver';
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

const ENTRY_TYPES: CvEntryType[] = ['Work', 'Education', 'Volunteer', 'Certification', 'Project'];

export default function CVPage() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const { enqueueSnackbar } = useSnackbar();
  const { selectedSiteId } = useSiteContext();
  const { canWrite, isAdmin } = useAuth();
  const [tabIndex, setTabIndex] = useState(0);
  const [entryTypeFilter, setEntryTypeFilter] = useState<string>('');
  const [entryPage, setEntryPage] = useState(1);
  const [entryPerPage, setEntryPerPage] = useState(25);
  const [skillPage, setSkillPage] = useState(1);
  const [skillPerPage, setSkillPerPage] = useState(25);

  // Entry state
  const [entryFormOpen, setEntryFormOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<CvEntryResponse | null>(null);
  const [deletingEntry, setDeletingEntry] = useState<CvEntryResponse | null>(null);

  // Skill state
  const [skillFormOpen, setSkillFormOpen] = useState(false);
  const [editingSkill, setEditingSkill] = useState<SkillResponse | null>(null);
  const [deletingSkill, setDeletingSkill] = useState<SkillResponse | null>(null);

  // Queries
  const { data: entriesData, isLoading: entriesLoading, error: entriesError } = useQuery({
    queryKey: ['cv-entries', selectedSiteId, entryTypeFilter, entryPage, entryPerPage],
    queryFn: () => apiService.getCvEntries(selectedSiteId, {
      entry_type: entryTypeFilter ? entryTypeFilter.toLowerCase() : undefined,
      page: entryPage,
      per_page: entryPerPage,
    }),
    enabled: !!selectedSiteId,
  });
  const entries = entriesData?.data;

  const { data: skillsData, isLoading: skillsLoading, error: skillsError } = useQuery({
    queryKey: ['skills', selectedSiteId, skillPage, skillPerPage],
    queryFn: () => apiService.getSkills(selectedSiteId, { page: skillPage, per_page: skillPerPage }),
    enabled: !!selectedSiteId,
  });
  const skills = skillsData?.data;

  // Entry mutations
  const createEntryMutation = useMutation({
    mutationFn: (data: CreateCvEntryRequest) => apiService.createCvEntry(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['cv-entries'] }); setEntryFormOpen(false); enqueueSnackbar(t('cv.entries.messages.created'), { variant: 'success' }); },
    onError: (error) => { const { detail, title } = resolveError(error); enqueueSnackbar(detail || title, { variant: 'error' }); },
  });

  const updateEntryMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateCvEntryRequest }) => apiService.updateCvEntry(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['cv-entries'] }); setEditingEntry(null); enqueueSnackbar(t('cv.entries.messages.updated'), { variant: 'success' }); },
    onError: (error) => { const { detail, title } = resolveError(error); enqueueSnackbar(detail || title, { variant: 'error' }); },
  });

  const deleteEntryMutation = useMutation({
    mutationFn: (id: string) => apiService.deleteCvEntry(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['cv-entries'] }); setDeletingEntry(null); enqueueSnackbar(t('cv.entries.messages.deleted'), { variant: 'success' }); },
    onError: (error) => { const { detail, title } = resolveError(error); enqueueSnackbar(detail || title, { variant: 'error' }); },
  });

  // Skill mutations
  const createSkillMutation = useMutation({
    mutationFn: (data: CreateSkillRequest) => apiService.createSkill(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['skills'] }); setSkillFormOpen(false); enqueueSnackbar(t('cv.skills.messages.created'), { variant: 'success' }); },
    onError: (error) => { const { detail, title } = resolveError(error); enqueueSnackbar(detail || title, { variant: 'error' }); },
  });

  const updateSkillMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateSkillRequest }) => apiService.updateSkill(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['skills'] }); setEditingSkill(null); enqueueSnackbar(t('cv.skills.messages.updated'), { variant: 'success' }); },
    onError: (error) => { const { detail, title } = resolveError(error); enqueueSnackbar(detail || title, { variant: 'error' }); },
  });

  const deleteSkillMutation = useMutation({
    mutationFn: (id: string) => apiService.deleteSkill(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['skills'] }); setDeletingSkill(null); enqueueSnackbar(t('cv.skills.messages.deleted'), { variant: 'success' }); },
    onError: (error) => { const { detail, title } = resolveError(error); enqueueSnackbar(detail || title, { variant: 'error' }); },
  });

  const getActionForTab = () => {
    if (!selectedSiteId || !canWrite) return undefined;
    if (tabIndex === 0) return { label: t('cv.entries.addEntry'), icon: <AddIcon />, onClick: () => setEntryFormOpen(true) };
    return { label: t('cv.skills.addSkill'), icon: <AddIcon />, onClick: () => setSkillFormOpen(true) };
  };

  return (
    <Box>
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
            <Tab label={t('cv.tabs.entries')} />
            <Tab label={t('cv.tabs.skills')} />
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
                <EmptyState icon={<WorkIcon sx={{ fontSize: 64 }} />} title={t('cv.entries.empty.title')} description={t('cv.entries.empty.description')} action={{ label: t('cv.entries.addEntry'), onClick: () => setEntryFormOpen(true) }} />
              ) : (
                <TableContainer component={Paper}>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell scope="col">{t('cv.entries.table.company')}</TableCell>
                        <TableCell scope="col">{t('cv.entries.table.location')}</TableCell>
                        <TableCell scope="col">{t('cv.entries.table.type')}</TableCell>
                        <TableCell scope="col">{t('cv.entries.table.dates')}</TableCell>
                        <TableCell scope="col">{t('cv.entries.table.current')}</TableCell>
                        <TableCell scope="col">{t('cv.entries.table.order')}</TableCell>
                        <TableCell scope="col" align="right">{t('cv.entries.table.actions')}</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {entries.map((entry) => (
                        <TableRow key={entry.id}>
                          <TableCell>{entry.company}</TableCell>
                          <TableCell>{entry.location}</TableCell>
                          <TableCell><Chip label={entry.entry_type} size="small" variant="outlined" /></TableCell>
                          <TableCell>
                            {format(new Date(entry.start_date), 'PP')}
                            {' - '}
                            {entry.is_current ? t('common.labels.present') : (entry.end_date ? format(new Date(entry.end_date), 'PP') : '—')}
                          </TableCell>
                          <TableCell>{entry.is_current ? t('common.labels.yes') : t('common.labels.no')}</TableCell>
                          <TableCell>{entry.display_order}</TableCell>
                          <TableCell align="right">
                            {canWrite && <Tooltip title={t('common.actions.edit')}><IconButton size="small" aria-label={t('common.actions.edit')} onClick={() => setEditingEntry(entry)}><EditIcon fontSize="small" /></IconButton></Tooltip>}
                            {isAdmin && <Tooltip title={t('common.actions.delete')}><IconButton size="small" aria-label={t('common.actions.delete')} color="error" onClick={() => setDeletingEntry(entry)}><DeleteIcon fontSize="small" /></IconButton></Tooltip>}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
              {entriesData?.meta && (
                <TablePagination
                  component="div"
                  count={entriesData.meta.total_items}
                  page={entriesData.meta.page - 1}
                  onPageChange={(_, p) => setEntryPage(p + 1)}
                  rowsPerPage={entriesData.meta.page_size}
                  onRowsPerPageChange={(e) => { setEntryPerPage(+e.target.value); setEntryPage(1); }}
                  rowsPerPageOptions={[10, 25, 50]}
                />
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
                <EmptyState icon={<SchoolIcon sx={{ fontSize: 64 }} />} title={t('cv.skills.empty.title')} description={t('cv.skills.empty.description')} action={{ label: t('cv.skills.addSkill'), onClick: () => setSkillFormOpen(true) }} />
              ) : (
                <TableContainer component={Paper}>
                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell scope="col">{t('cv.skills.table.name')}</TableCell>
                        <TableCell scope="col">{t('cv.skills.table.slug')}</TableCell>
                        <TableCell scope="col">{t('cv.skills.table.category')}</TableCell>
                        <TableCell scope="col">{t('cv.skills.table.proficiency')}</TableCell>
                        <TableCell scope="col">{t('cv.skills.table.icon')}</TableCell>
                        <TableCell scope="col" align="right">{t('cv.skills.table.actions')}</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {skills.map((skill) => (
                        <TableRow key={skill.id}>
                          <TableCell>{skill.name}</TableCell>
                          <TableCell sx={{ fontFamily: 'monospace', fontSize: '0.85rem' }}>{skill.slug}</TableCell>
                          <TableCell>{skill.category ? <Chip label={skill.category} size="small" variant="outlined" /> : '—'}</TableCell>
                          <TableCell>{skill.proficiency_level != null ? `${skill.proficiency_level}%` : '—'}</TableCell>
                          <TableCell>{skill.icon || '—'}</TableCell>
                          <TableCell align="right">
                            {canWrite && <Tooltip title={t('common.actions.edit')}><IconButton size="small" aria-label={t('common.actions.edit')} onClick={() => setEditingSkill(skill)}><EditIcon fontSize="small" /></IconButton></Tooltip>}
                            {isAdmin && <Tooltip title={t('common.actions.delete')}><IconButton size="small" aria-label={t('common.actions.delete')} color="error" onClick={() => setDeletingSkill(skill)}><DeleteIcon fontSize="small" /></IconButton></Tooltip>}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
              {skillsData?.meta && (
                <TablePagination
                  component="div"
                  count={skillsData.meta.total_items}
                  page={skillsData.meta.page - 1}
                  onPageChange={(_, p) => setSkillPage(p + 1)}
                  rowsPerPage={skillsData.meta.page_size}
                  onRowsPerPageChange={(e) => { setSkillPerPage(+e.target.value); setSkillPage(1); }}
                  rowsPerPageOptions={[10, 25, 50]}
                />
              )}
            </>
          )}
        </>
      )}

      {/* Entry Dialogs */}
      <CvEntryFormDialog open={entryFormOpen} onSubmit={(data) => createEntryMutation.mutate(data)} onClose={() => setEntryFormOpen(false)} loading={createEntryMutation.isPending} />
      <CvEntryFormDialog open={!!editingEntry} entry={editingEntry} onSubmit={(data) => editingEntry && updateEntryMutation.mutate({ id: editingEntry.id, data })} onClose={() => setEditingEntry(null)} loading={updateEntryMutation.isPending} />
      <ConfirmDialog open={!!deletingEntry} title={t('cv.entries.deleteDialog.title')} message={t('cv.entries.deleteDialog.message', { company: deletingEntry?.company })} confirmLabel={t('common.actions.delete')} onConfirm={() => deletingEntry && deleteEntryMutation.mutate(deletingEntry.id)} onCancel={() => setDeletingEntry(null)} loading={deleteEntryMutation.isPending} />

      {/* Skill Dialogs */}
      <SkillFormDialog open={skillFormOpen} onSubmit={(data) => createSkillMutation.mutate(data)} onClose={() => setSkillFormOpen(false)} loading={createSkillMutation.isPending} />
      <SkillFormDialog open={!!editingSkill} skill={editingSkill} onSubmit={(data) => editingSkill && updateSkillMutation.mutate({ id: editingSkill.id, data })} onClose={() => setEditingSkill(null)} loading={updateSkillMutation.isPending} />
      <ConfirmDialog open={!!deletingSkill} title={t('cv.skills.deleteDialog.title')} message={t('cv.skills.deleteDialog.message', { name: deletingSkill?.name })} confirmLabel={t('common.actions.delete')} onConfirm={() => deletingSkill && deleteSkillMutation.mutate(deletingSkill.id)} onCancel={() => setDeletingSkill(null)} loading={deleteSkillMutation.isPending} />
    </Box>
  );
}
