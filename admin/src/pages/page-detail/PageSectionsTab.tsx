import { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Button,
  Card,
  CardActionArea,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ViewListIcon from '@mui/icons-material/ViewList';
import PreviewIcon from '@mui/icons-material/Preview';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import ViewCarouselIcon from '@mui/icons-material/ViewCarousel';
import GridViewIcon from '@mui/icons-material/GridView';
import CampaignIcon from '@mui/icons-material/Campaign';
import CollectionsIcon from '@mui/icons-material/Collections';
import FormatQuoteIcon from '@mui/icons-material/FormatQuote';
import AttachMoneyIcon from '@mui/icons-material/AttachMoney';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import ContactMailIcon from '@mui/icons-material/ContactMail';
import ExtensionIcon from '@mui/icons-material/Extension';
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
import type {
  PageSectionResponse,
  SectionLocalizationResponse,
  CreatePageSectionRequest,
  SectionType,
  ReorderItem,
} from '@/types/api';
import LoadingState from '@/components/shared/LoadingState';
import EmptyState from '@/components/shared/EmptyState';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import SectionEditorDialog from '@/components/pages/SectionEditorDialog';
import PagePreview from '@/components/pages/PagePreview';
import SortableSectionRow from '@/components/pages/SortableSectionRow';

const SECTION_TYPE_CONFIG: { type: SectionType; icon: React.ReactNode; description: string }[] = [
  { type: 'Hero', icon: <ViewCarouselIcon />, description: 'Full-width banner with headline' },
  { type: 'Features', icon: <GridViewIcon />, description: 'Feature cards grid' },
  { type: 'Cta', icon: <CampaignIcon />, description: 'Call-to-action block' },
  { type: 'Gallery', icon: <CollectionsIcon />, description: 'Image gallery' },
  { type: 'Testimonials', icon: <FormatQuoteIcon />, description: 'Customer testimonials' },
  { type: 'Pricing', icon: <AttachMoneyIcon />, description: 'Pricing table' },
  { type: 'Faq', icon: <HelpOutlineIcon />, description: 'FAQ accordion' },
  { type: 'Contact', icon: <ContactMailIcon />, description: 'Contact form' },
  { type: 'Custom', icon: <ExtensionIcon />, description: 'Custom section' },
];

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
  onReorderSections: (items: ReorderItem[]) => void;
  onSectionEditorClose: () => void;
  createLoading: boolean;
  deleteLoading: boolean;
}

function QuickAddDialog({
  open,
  onSubmit,
  onClose,
  loading,
  nextOrder,
}: {
  open: boolean;
  onSubmit: (data: CreatePageSectionRequest) => void;
  onClose: () => void;
  loading?: boolean;
  nextOrder: number;
}) {
  const { t } = useTranslation();
  const [selectedType, setSelectedType] = useState<SectionType>('Hero');

  useEffect(() => {
    if (open) setSelectedType('Hero');
  }, [open]);

  const handleAdd = () => {
    onSubmit({
      section_type: selectedType,
      display_order: nextOrder,
    });
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{t('pageDetail.sections.add')}</DialogTitle>
      <DialogContent>
        <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1.5, mt: 1 }}>
          {SECTION_TYPE_CONFIG.map(({ type, icon, description }) => (
            <Card
              key={type}
              variant="outlined"
              sx={{
                border: 2,
                borderColor: selectedType === type ? 'primary.main' : 'divider',
                bgcolor: selectedType === type ? 'action.selected' : 'background.paper',
                transition: 'border-color 0.15s, background-color 0.15s',
              }}
            >
              <CardActionArea
                onClick={() => setSelectedType(type)}
                sx={{ p: 1.5, textAlign: 'center' }}
              >
                <Box sx={{ color: selectedType === type ? 'primary.main' : 'text.secondary', mb: 0.5 }}>
                  {icon}
                </Box>
                <Typography variant="body2" fontWeight={600}>{type}</Typography>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.2 }}>
                  {description}
                </Typography>
              </CardActionArea>
            </Card>
          ))}
        </Box>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={loading}>{t('common.actions.cancel')}</Button>
        <Button variant="contained" onClick={handleAdd} disabled={loading}>
          {loading ? t('pageDetail.dialog.adding') : t('common.actions.add')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

function stripMarkdown(md: string): string {
  return md
    .replace(/[#*_~`>[\]()!|\\-]/g, '')
    .replace(/\n+/g, ' ')
    .trim();
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
  onReorderSections,
  onSectionEditorClose,
  createLoading,
  deleteLoading,
}: PageSectionsTabProps) {
  const { t } = useTranslation();
  const [viewMode, setViewMode] = useState<'edit' | 'preview'>('edit');
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [editorSection, setEditorSection] = useState<PageSectionResponse | null>(null);
  const [deletingSection, setDeletingSection] = useState<PageSectionResponse | null>(null);
  const [orderedSections, setOrderedSections] = useState<PageSectionResponse[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    if (sections) {
      setOrderedSections([...sections].sort((a, b) => a.display_order - b.display_order));
    }
  }, [sections]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    setActiveId(event.active.id as string);
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    setActiveId(null);
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    setOrderedSections((prev) => {
      const oldIndex = prev.findIndex((s) => s.id === active.id);
      const newIndex = prev.findIndex((s) => s.id === over.id);
      const reordered = arrayMove(prev, oldIndex, newIndex);
      const items: ReorderItem[] = reordered.map((section, index) => ({
        id: section.id,
        display_order: index,
      }));
      onReorderSections(items);
      return reordered;
    });
  }, [onReorderSections]);

  const getLocaleChips = (sectionId: string) => {
    if (!sectionLocalizations || !activeLocales.length) return [];
    const sectionLocs = sectionLocalizations.filter((l) => l.page_section_id === sectionId);
    return activeLocales
      .filter((locale) => sectionLocs.some((l) => l.locale_id === locale.id))
      .map((locale) => locale.code.toUpperCase());
  };

  const getPrimaryTitle = (sectionId: string): string | null => {
    if (!sectionLocalizations) return null;
    const loc = sectionLocalizations.find((l) => l.page_section_id === sectionId && l.title);
    return loc?.title || null;
  };

  const getSubtitle = (sectionId: string): string | null => {
    if (!sectionLocalizations) return null;
    const loc = sectionLocalizations.find((l) => l.page_section_id === sectionId && l.text);
    if (!loc?.text) return null;
    const stripped = stripMarkdown(loc.text);
    return stripped.length > 60 ? stripped.slice(0, 60) + '...' : stripped;
  };

  const activeSection = activeId ? orderedSections.find((s) => s.id === activeId) : null;

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
      ) : !orderedSections || orderedSections.length === 0 ? (
        <EmptyState
          icon={<AddIcon sx={{ fontSize: 48 }} />}
          title={t('pageDetail.sections.empty')}
          description={t('pageDetail.sections.emptyDescription')}
          action={canWrite ? { label: t('pageDetail.sections.add'), onClick: () => setQuickAddOpen(true) } : undefined}
        />
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <TableContainer>
            <Table>
              <TableHead>
                <TableRow>
                  {canWrite && <TableCell scope="col" sx={{ width: 48, px: 1 }} />}
                  <TableCell scope="col">{t('pageDetail.table.type')}</TableCell>
                  <TableCell scope="col">{t('pageDetail.table.content')}</TableCell>
                  <TableCell scope="col">{t('pageDetail.table.localizations')}</TableCell>
                  <TableCell scope="col" align="right">{t('pageDetail.table.actions')}</TableCell>
                </TableRow>
              </TableHead>
              <SortableContext items={orderedSections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                <TableBody>
                  {orderedSections.map((section) => (
                    <SortableSectionRow
                      key={section.id}
                      section={section}
                      localeChips={getLocaleChips(section.id)}
                      primaryTitle={getPrimaryTitle(section.id)}
                      subtitle={getSubtitle(section.id)}
                      canWrite={canWrite}
                      isAdmin={isAdmin}
                      onEdit={setEditorSection}
                      onDelete={setDeletingSection}
                    />
                  ))}
                </TableBody>
              </SortableContext>
            </Table>
          </TableContainer>
          <DragOverlay dropAnimation={{ duration: 200, easing: 'ease' }}>
            {activeSection ? (
              <Paper elevation={12} sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1, borderRadius: 2, bgcolor: 'background.paper', border: '1px solid', borderColor: 'primary.main', pointerEvents: 'none' }}>
                <DragIndicatorIcon fontSize="small" color="primary" />
                <Typography variant="body2" fontWeight={500} noWrap>
                  {activeSection.section_type} — {getPrimaryTitle(activeSection.id) || t('pageDetail.sections.untitled')}
                </Typography>
              </Paper>
            ) : null}
          </DragOverlay>
        </DndContext>
      )}

      <QuickAddDialog
        open={quickAddOpen}
        onSubmit={(data) => {
          onCreateSection(data);
          setQuickAddOpen(false);
        }}
        onClose={() => setQuickAddOpen(false)}
        loading={createLoading}
        nextOrder={orderedSections.length}
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
        confirmationText={t('common.actions.delete')}
      />
    </Box>
  );
}
