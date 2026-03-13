import { useReducer, useCallback, useRef } from 'react';
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
import { useState } from 'react';
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

  // Reset selected type when dialog opens
  const prevOpenRef = useRef(false);
  if (open && !prevOpenRef.current) {
    setSelectedType('Hero');
  }
  prevOpenRef.current = open;

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

// --- Reducer ---

interface SectionsTabState {
  viewMode: 'edit' | 'preview';
  quickAddOpen: boolean;
  editorSection: PageSectionResponse | null;
  deletingSection: PageSectionResponse | null;
  orderedSections: PageSectionResponse[];
  activeId: string | null;
}

type SectionsTabAction =
  | { type: 'SET_VIEW_MODE'; payload: 'edit' | 'preview' }
  | { type: 'SET_QUICK_ADD_OPEN'; payload: boolean }
  | { type: 'SET_EDITOR_SECTION'; payload: PageSectionResponse | null }
  | { type: 'SET_DELETING_SECTION'; payload: PageSectionResponse | null }
  | { type: 'SET_ORDERED_SECTIONS'; payload: PageSectionResponse[] }
  | { type: 'SET_ACTIVE_ID'; payload: string | null };

const initialSectionsState: SectionsTabState = {
  viewMode: 'edit',
  quickAddOpen: false,
  editorSection: null,
  deletingSection: null,
  orderedSections: [],
  activeId: null,
};

function sectionsReducer(state: SectionsTabState, action: SectionsTabAction): SectionsTabState {
  switch (action.type) {
    case 'SET_VIEW_MODE':
      return { ...state, viewMode: action.payload };
    case 'SET_QUICK_ADD_OPEN':
      return { ...state, quickAddOpen: action.payload };
    case 'SET_EDITOR_SECTION':
      return { ...state, editorSection: action.payload };
    case 'SET_DELETING_SECTION':
      return { ...state, deletingSection: action.payload };
    case 'SET_ORDERED_SECTIONS':
      return { ...state, orderedSections: action.payload };
    case 'SET_ACTIVE_ID':
      return { ...state, activeId: action.payload };
    default:
      return state;
  }
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
  const [state, dispatch] = useReducer(sectionsReducer, initialSectionsState);

  const prevSectionsRef = useRef(sections);
  if (sections && sections !== prevSectionsRef.current) {
    dispatch({
      type: 'SET_ORDERED_SECTIONS',
      payload: [...sections].sort((a, b) => a.display_order - b.display_order),
    });
  }
  prevSectionsRef.current = sections;

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
  );

  const handleDragStart = useCallback((event: DragStartEvent) => {
    dispatch({ type: 'SET_ACTIVE_ID', payload: event.active.id as string });
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    dispatch({ type: 'SET_ACTIVE_ID', payload: null });
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = state.orderedSections.findIndex((s) => s.id === active.id);
    const newIndex = state.orderedSections.findIndex((s) => s.id === over.id);
    const reordered = arrayMove(state.orderedSections, oldIndex, newIndex);
    const items: ReorderItem[] = reordered.map((section, index) => ({
      id: section.id,
      display_order: index,
    }));
    dispatch({ type: 'SET_ORDERED_SECTIONS', payload: reordered });
    onReorderSections(items);
  }, [onReorderSections, state.orderedSections]);

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

  const activeSection = state.activeId ? state.orderedSections.find((s) => s.id === state.activeId) : null;

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
          <ToggleButtonGroup
            value={state.viewMode}
            exclusive
            onChange={(_, val) => val && dispatch({ type: 'SET_VIEW_MODE', payload: val })}
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
        {canWrite && state.viewMode === 'edit' && (
          <Button variant="outlined" startIcon={<AddIcon />} onClick={() => dispatch({ type: 'SET_QUICK_ADD_OPEN', payload: true })}>
            {t('pageDetail.sections.add')}
          </Button>
        )}
      </Box>

      {state.viewMode === 'preview' ? (
        <PagePreview
          sections={sections || []}
          localizations={sectionLocalizations || []}
        />
      ) : sectionsLoading ? (
        <LoadingState label={t('pageDetail.sections.loadingSections')} />
      ) : !state.orderedSections || state.orderedSections.length === 0 ? (
        <EmptyState
          icon={<AddIcon sx={{ fontSize: 48 }} />}
          title={t('pageDetail.sections.empty')}
          description={t('pageDetail.sections.emptyDescription')}
          action={canWrite ? { label: t('pageDetail.sections.add'), onClick: () => dispatch({ type: 'SET_QUICK_ADD_OPEN', payload: true }) } : undefined}
        />
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <TableContainer>
            <Table size="small">
              <TableHead>
                <TableRow>
                  {canWrite && <TableCell scope="col" sx={{ width: 48, px: 1 }} />}
                  <TableCell scope="col">{t('pageDetail.table.type')}</TableCell>
                  <TableCell scope="col">{t('pageDetail.table.content')}</TableCell>
                  <TableCell scope="col">{t('pageDetail.table.localizations')}</TableCell>
                  <TableCell scope="col" align="right">{t('pageDetail.table.actions')}</TableCell>
                </TableRow>
              </TableHead>
              <SortableContext items={state.orderedSections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
                <TableBody>
                  {state.orderedSections.map((section) => (
                    <SortableSectionRow
                      key={section.id}
                      section={section}
                      localeChips={getLocaleChips(section.id)}
                      primaryTitle={getPrimaryTitle(section.id)}
                      subtitle={getSubtitle(section.id)}
                      canWrite={canWrite}
                      isAdmin={isAdmin}
                      onEdit={(s) => dispatch({ type: 'SET_EDITOR_SECTION', payload: s })}
                      onDelete={(s) => dispatch({ type: 'SET_DELETING_SECTION', payload: s })}
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
        open={state.quickAddOpen}
        onSubmit={(data) => {
          onCreateSection(data);
          dispatch({ type: 'SET_QUICK_ADD_OPEN', payload: false });
        }}
        onClose={() => dispatch({ type: 'SET_QUICK_ADD_OPEN', payload: false })}
        loading={createLoading}
        nextOrder={state.orderedSections.length}
      />

      <SectionEditorDialog
        open={!!state.editorSection}
        section={state.editorSection}
        onClose={() => {
          dispatch({ type: 'SET_EDITOR_SECTION', payload: null });
          onSectionEditorClose();
        }}
      />

      <ConfirmDialog
        open={!!state.deletingSection}
        title={t('pageDetail.sections.deleteTitle')}
        message={t('pageDetail.sections.deleteMessage', { type: state.deletingSection?.section_type })}
        confirmLabel={t('common.actions.delete')}
        onConfirm={() => {
          if (state.deletingSection) {
            onDeleteSection(state.deletingSection.id);
            dispatch({ type: 'SET_DELETING_SECTION', payload: null });
          }
        }}
        onCancel={() => dispatch({ type: 'SET_DELETING_SECTION', payload: null })}
        loading={deleteLoading}
        confirmationText={t('common.actions.delete')}
      />
    </Box>
  );
}
