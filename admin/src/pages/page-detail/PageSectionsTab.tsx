import { useState, useEffect } from 'react';
import {
  Box,
  Button,
  Chip,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  IconButton,
  MenuItem,
  Stack,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AddIcon from '@mui/icons-material/Add';
import ViewListIcon from '@mui/icons-material/ViewList';
import PreviewIcon from '@mui/icons-material/Preview';
import { useForm, Controller } from 'react-hook-form';
import { useTranslation } from 'react-i18next';
import type {
  PageSectionResponse,
  SectionLocalizationResponse,
  CreatePageSectionRequest,
  SectionType,
} from '@/types/api';
import LoadingState from '@/components/shared/LoadingState';
import EmptyState from '@/components/shared/EmptyState';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import SectionEditorDialog from '@/components/pages/SectionEditorDialog';
import PagePreview from '@/components/pages/PagePreview';

const SECTION_TYPES: SectionType[] = ['Hero', 'Features', 'Cta', 'Gallery', 'Testimonials', 'Pricing', 'Faq', 'Contact', 'Custom'];

interface ActiveLocale {
  id: string;
  code: string;
}

interface PageSectionsTabProps {
  pageId: string;
  sections: PageSectionResponse[] | undefined;
  sectionsLoading: boolean;
  sectionLocalizations: SectionLocalizationResponse[] | undefined;
  activeLocales: ActiveLocale[];
  canWrite: boolean;
  isAdmin: boolean;
  onCreateSection: (data: CreatePageSectionRequest) => void;
  onDeleteSection: (sectionId: string) => void;
  onSectionEditorClose: () => void;
  createLoading: boolean;
  deleteLoading: boolean;
}

interface QuickAddFormData {
  section_type: SectionType;
  display_order: number;
}

function QuickAddDialog({
  open,
  onSubmit,
  onClose,
  loading,
}: {
  open: boolean;
  onSubmit: (data: CreatePageSectionRequest) => void;
  onClose: () => void;
  loading?: boolean;
}) {
  const { t } = useTranslation();
  const { register, handleSubmit, reset, control, formState: { errors } } = useForm<QuickAddFormData>({
    defaultValues: { section_type: 'Hero' as SectionType, display_order: 0 },
  });

  useEffect(() => {
    if (open) {
      reset({ section_type: 'Hero' as SectionType, display_order: 0 });
    }
  }, [open, reset]);

  const onFormSubmit = (data: QuickAddFormData) => {
    onSubmit({
      section_type: data.section_type,
      display_order: Number(data.display_order),
    });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <form onSubmit={handleSubmit(onFormSubmit)}>
        <DialogTitle>{t('pageDetail.sections.add')}</DialogTitle>
        <DialogContent>
          <Stack spacing={2} sx={{ mt: 1 }}>
            <Controller name="section_type" control={control} render={({ field }) => (
              <TextField select label={t('pageDetail.dialog.sectionType')} fullWidth {...field}>
                {SECTION_TYPES.map((st) => <MenuItem key={st} value={st}>{st}</MenuItem>)}
              </TextField>
            )} />
            <TextField
              label={t('pageDetail.dialog.displayOrder')}
              type="number"
              fullWidth
              {...register('display_order', { required: t('pageDetail.dialog.displayOrderRequired'), valueAsNumber: true })}
              error={!!errors.display_order}
              helperText={errors.display_order?.message}
            />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={onClose} disabled={loading}>{t('common.actions.cancel')}</Button>
          <Button type="submit" variant="contained" disabled={loading}>
            {loading ? t('pageDetail.dialog.adding') : t('common.actions.add')}
          </Button>
        </DialogActions>
      </form>
    </Dialog>
  );
}

export default function PageSectionsTab({
  sections,
  sectionsLoading,
  sectionLocalizations,
  activeLocales,
  canWrite,
  isAdmin,
  onCreateSection,
  onDeleteSection,
  onSectionEditorClose,
  createLoading,
  deleteLoading,
}: PageSectionsTabProps) {
  const { t } = useTranslation();
  const [viewMode, setViewMode] = useState<'edit' | 'preview'>('edit');
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [editorSection, setEditorSection] = useState<PageSectionResponse | null>(null);
  const [deletingSection, setDeletingSection] = useState<PageSectionResponse | null>(null);

  const getLocaleChips = (sectionId: string) => {
    if (!sectionLocalizations || !activeLocales.length) return [];
    const sectionLocs = sectionLocalizations.filter((l) => l.page_section_id === sectionId);
    return activeLocales
      .filter((locale) => sectionLocs.some((l) => l.locale_id === locale.id))
      .map((locale) => locale.code.toUpperCase());
  };

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <ToggleButtonGroup
            value={viewMode}
            exclusive
            onChange={(_, val) => val && setViewMode(val)}
            size="small"
          >
            <ToggleButton value="edit" aria-label={t('common.actions.edit')}>
              <Tooltip title={t('common.actions.edit')}><ViewListIcon fontSize="small" /></Tooltip>
            </ToggleButton>
            <ToggleButton value="preview" aria-label={t('common.actions.view')}>
              <Tooltip title={t('common.actions.view')}><PreviewIcon fontSize="small" /></Tooltip>
            </ToggleButton>
          </ToggleButtonGroup>
        </Box>
        {canWrite && viewMode === 'edit' && (
          <Button variant="outlined" startIcon={<AddIcon />} onClick={() => setQuickAddOpen(true)}>
            {t('pageDetail.sections.add')}
          </Button>
        )}
      </Box>

      {viewMode === 'preview' ? (
        <PagePreview
          sections={sections || []}
          localizations={sectionLocalizations || []}
        />
      ) : sectionsLoading ? (
        <LoadingState label={t('pageDetail.sections.loadingSections')} />
      ) : !sections || sections.length === 0 ? (
        <EmptyState
          icon={<AddIcon sx={{ fontSize: 48 }} />}
          title={t('pageDetail.sections.empty')}
          description={t('pageDetail.sections.emptyDescription')}
          action={canWrite ? { label: t('pageDetail.sections.add'), onClick: () => setQuickAddOpen(true) } : undefined}
        />
      ) : (
        <TableContainer>
          <Table>
            <TableHead>
              <TableRow>
                <TableCell>{t('pageDetail.table.type')}</TableCell>
                <TableCell>{t('pageDetail.table.order')}</TableCell>
                <TableCell>{t('pageDetail.table.localizations')}</TableCell>
                <TableCell>{t('pageDetail.table.coverImage')}</TableCell>
                <TableCell>{t('pageDetail.table.ctaRoute')}</TableCell>
                <TableCell align="right">{t('pageDetail.table.actions')}</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {[...sections]
                .sort((a, b) => a.display_order - b.display_order)
                .map((section) => {
                  const localeChips = getLocaleChips(section.id);
                  return (
                    <TableRow key={section.id}>
                      <TableCell>
                        <Chip label={section.section_type} size="small" variant="outlined" />
                      </TableCell>
                      <TableCell>{section.display_order}</TableCell>
                      <TableCell>
                        {localeChips.length > 0 ? (
                          <Stack direction="row" spacing={0.5}>
                            {localeChips.map((code) => (
                              <Chip key={code} label={code} size="small" color="info" variant="outlined" sx={{ fontSize: '0.7rem', height: 22 }} />
                            ))}
                          </Stack>
                        ) : (
                          <Typography variant="body2" color="text.secondary">—</Typography>
                        )}
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontFamily="monospace" sx={{ maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {section.cover_image_id || '—'}
                        </Typography>
                      </TableCell>
                      <TableCell>
                        <Typography variant="body2" fontFamily="monospace">
                          {section.call_to_action_route || '—'}
                        </Typography>
                      </TableCell>
                      <TableCell align="right">
                        {canWrite && (
                          <Tooltip title={t('common.actions.edit')}>
                            <IconButton size="small" onClick={() => setEditorSection(section)}>
                              <EditIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                        {isAdmin && (
                          <Tooltip title={t('common.actions.delete')}>
                            <IconButton size="small" color="error" onClick={() => setDeletingSection(section)}>
                              <DeleteIcon fontSize="small" />
                            </IconButton>
                          </Tooltip>
                        )}
                      </TableCell>
                    </TableRow>
                  );
                })}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      <QuickAddDialog
        open={quickAddOpen}
        onSubmit={(data) => {
          onCreateSection(data);
          setQuickAddOpen(false);
        }}
        onClose={() => setQuickAddOpen(false)}
        loading={createLoading}
      />

      <SectionEditorDialog
        open={!!editorSection}
        section={editorSection}
        onClose={() => {
          setEditorSection(null);
          onSectionEditorClose();
        }}
      />

      <ConfirmDialog
        open={!!deletingSection}
        title={t('pageDetail.sections.deleteTitle')}
        message={t('pageDetail.sections.deleteMessage', { type: deletingSection?.section_type })}
        confirmLabel={t('common.actions.delete')}
        onConfirm={() => {
          if (deletingSection) {
            onDeleteSection(deletingSection.id);
            setDeletingSection(null);
          }
        }}
        onCancel={() => setDeletingSection(null)}
        loading={deleteLoading}
      />
    </Box>
  );
}
