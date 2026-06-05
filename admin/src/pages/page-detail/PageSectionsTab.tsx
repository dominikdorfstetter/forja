import { useReducer, useCallback, useEffect, useState } from 'react';
import {
  Box,
  Button,
  Card,
  CardActionArea,
  Drawer,
  Paper,
  Stack,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
} from '@mui/material';
import FormDialog from '@/components/shared/FormDialog';
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
import HelpOutlineIcon from '@mui/icons-material/HelpOutlined';
import ContactMailIcon from '@mui/icons-material/ContactMail';
import ExtensionIcon from '@mui/icons-material/Extension';
import BarChartIcon from '@mui/icons-material/BarChart';
import GroupIcon from '@mui/icons-material/Group';
import TimelineIcon from '@mui/icons-material/Timeline';
import BusinessIcon from '@mui/icons-material/Business';
import EmailIcon from '@mui/icons-material/Email';
import VideocamIcon from '@mui/icons-material/Videocam';
import HorizontalRuleIcon from '@mui/icons-material/HorizontalRule';
import TextFieldsIcon from '@mui/icons-material/TextFields';
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
import { M3Button } from '@/components/design-system';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import SectionEditorDialog from '@/components/pages/SectionEditorDialog';
import PagePreview from '@/components/pages/PagePreview';
import SortableSectionRow from '@/components/pages/SortableSectionRow';

const SECTION_TYPE_CONFIG: { type: SectionType; icon: React.ReactNode; descriptionKey: string }[] = [
  { type: 'Hero', icon: <ViewCarouselIcon />, descriptionKey: 'sectionEditor.types.Hero' },
  { type: 'Features', icon: <GridViewIcon />, descriptionKey: 'sectionEditor.types.Features' },
  { type: 'Cta', icon: <CampaignIcon />, descriptionKey: 'sectionEditor.types.Cta' },
  { type: 'Gallery', icon: <CollectionsIcon />, descriptionKey: 'sectionEditor.types.Gallery' },
  { type: 'Testimonials', icon: <FormatQuoteIcon />, descriptionKey: 'sectionEditor.types.Testimonials' },
  { type: 'Pricing', icon: <AttachMoneyIcon />, descriptionKey: 'sectionEditor.types.Pricing' },
  { type: 'Faq', icon: <HelpOutlineIcon />, descriptionKey: 'sectionEditor.types.Faq' },
  { type: 'Contact', icon: <ContactMailIcon />, descriptionKey: 'sectionEditor.types.Contact' },
  { type: 'Custom', icon: <ExtensionIcon />, descriptionKey: 'sectionEditor.types.Custom' },
  { type: 'Stats', icon: <BarChartIcon />, descriptionKey: 'sectionEditor.types.Stats' },
  { type: 'Team', icon: <GroupIcon />, descriptionKey: 'sectionEditor.types.Team' },
  { type: 'Timeline', icon: <TimelineIcon />, descriptionKey: 'sectionEditor.types.Timeline' },
  { type: 'LogoCloud', icon: <BusinessIcon />, descriptionKey: 'sectionEditor.types.LogoCloud' },
  { type: 'Newsletter', icon: <EmailIcon />, descriptionKey: 'sectionEditor.types.Newsletter' },
  { type: 'Video', icon: <VideocamIcon />, descriptionKey: 'sectionEditor.types.Video' },
  { type: 'Divider', icon: <HorizontalRuleIcon />, descriptionKey: 'sectionEditor.types.Divider' },
  { type: 'Text', icon: <TextFieldsIcon />, descriptionKey: 'sectionEditor.types.Text' },
];

interface ActiveLocale {
  id: string;
  code: string;
}

interface PageSectionsTabProps {
  pageId: string;
  pageRoute?: string;
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

  // react-doctor-disable-next-line useEffect-event-handler — resets state on dialog open transition
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
    <FormDialog
      open={open}
      onClose={onClose}
      onSubmit={handleAdd}
      icon="view_quilt"
      title={t('pageDetail.sections.add')}
      submitLabel={loading ? t('pageDetail.dialog.adding') : t('common.actions.add')}
      loading={loading}
    >
      <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 1.5 }}>
        {SECTION_TYPE_CONFIG.map(({ type, icon, descriptionKey }) => (
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
              <Typography variant="body2" sx={{ fontWeight: 600 }}>{t(`sectionEditor.typeNames.${type}`)}</Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block', lineHeight: 1.2 }}>
                {t(descriptionKey)}
              </Typography>
            </CardActionArea>
          </Card>
        ))}
      </Box>
    </FormDialog>
  );
}

/** Insertion point button between sections */
function InsertionPoint({ onClick }: { onClick: () => void }) {
  const { t } = useTranslation();
  return (
    <Box
      sx={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        py: 0.5,
        opacity: 0,
        transition: 'opacity 0.2s',
        '&:hover': { opacity: 1 },
      }}
    >
      <Button
        size="small"
        startIcon={<AddIcon />}
        onClick={onClick}
        sx={{ fontSize: '0.7rem', textTransform: 'none', color: 'text.secondary' }}
      >
        {t('sectionEditor.addSection')}
      </Button>
    </Box>
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
  insertAtOrder: number;
  editorSection: PageSectionResponse | null;
  deletingSection: PageSectionResponse | null;
  orderedSections: PageSectionResponse[];
  activeId: string | null;
}

type SectionsTabAction =
  | { type: 'SET_VIEW_MODE'; payload: 'edit' | 'preview' }
  | { type: 'OPEN_QUICK_ADD'; payload: number }
  | { type: 'CLOSE_QUICK_ADD' }
  | { type: 'SET_EDITOR_SECTION'; payload: PageSectionResponse | null }
  | { type: 'SET_DELETING_SECTION'; payload: PageSectionResponse | null }
  | { type: 'SET_ORDERED_SECTIONS'; payload: PageSectionResponse[] }
  | { type: 'SET_ACTIVE_ID'; payload: string | null };

const initialSectionsState: SectionsTabState = {
  viewMode: 'edit',
  quickAddOpen: false,
  insertAtOrder: 0,
  editorSection: null,
  deletingSection: null,
  orderedSections: [],
  activeId: null,
};

function sectionsReducer(state: SectionsTabState, action: SectionsTabAction): SectionsTabState {
  switch (action.type) {
    case 'SET_VIEW_MODE':
      return { ...state, viewMode: action.payload };
    case 'OPEN_QUICK_ADD':
      return { ...state, quickAddOpen: true, insertAtOrder: action.payload };
    case 'CLOSE_QUICK_ADD':
      return { ...state, quickAddOpen: false };
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
  pageRoute,
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

  // react-doctor-disable-next-line useEffect-event-handler — syncs server data to local DnD state
  useEffect(() => {
    if (sections) {
      dispatch({
        type: 'SET_ORDERED_SECTIONS',
        payload: [...sections].sort((a, b) => a.display_order - b.display_order),
      });
    }
  }, [sections]);

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

  const handleDuplicate = useCallback((section: PageSectionResponse) => {
    onCreateSection({
      section_type: section.section_type,
      display_order: section.display_order + 1,
      cover_image_id: section.cover_image_id || undefined,
      call_to_action_route: section.call_to_action_route || undefined,
      settings: section.settings || undefined,
    });
  }, [onCreateSection]);

  const handleMoveUp = useCallback((section: PageSectionResponse) => {
    const idx = state.orderedSections.findIndex((s) => s.id === section.id);
    if (idx <= 0) return;
    const reordered = arrayMove(state.orderedSections, idx, idx - 1);
    const items: ReorderItem[] = reordered.map((s, i) => ({ id: s.id, display_order: i }));
    dispatch({ type: 'SET_ORDERED_SECTIONS', payload: reordered });
    onReorderSections(items);
  }, [state.orderedSections, onReorderSections]);

  const handleMoveDown = useCallback((section: PageSectionResponse) => {
    const idx = state.orderedSections.findIndex((s) => s.id === section.id);
    if (idx < 0 || idx >= state.orderedSections.length - 1) return;
    const reordered = arrayMove(state.orderedSections, idx, idx + 1);
    const items: ReorderItem[] = reordered.map((s, i) => ({ id: s.id, display_order: i }));
    dispatch({ type: 'SET_ORDERED_SECTIONS', payload: reordered });
    onReorderSections(items);
  }, [state.orderedSections, onReorderSections]);

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
          <M3Button variant="outlined" size="sm" icon="add" onClick={() => dispatch({ type: 'OPEN_QUICK_ADD', payload: state.orderedSections.length })}>
            {t('pageDetail.sections.add')}
          </M3Button>
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
          action={canWrite ? { label: t('pageDetail.sections.add'), onClick: () => dispatch({ type: 'OPEN_QUICK_ADD', payload: 0 }) } : undefined}
        />
      ) : (
        <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={handleDragStart} onDragEnd={handleDragEnd}>
          <SortableContext items={state.orderedSections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
            <Stack spacing={0}>
              {/* Insertion point at top */}
              {canWrite && (
                <InsertionPoint onClick={() => dispatch({ type: 'OPEN_QUICK_ADD', payload: 0 })} />
              )}
              {state.orderedSections.map((section, index) => (
                <Box key={section.id}>
                  <SortableSectionRow
                    section={section}
                    localeChips={getLocaleChips(section.id)}
                    primaryTitle={getPrimaryTitle(section.id)}
                    subtitle={getSubtitle(section.id)}
                    canWrite={canWrite}
                    isAdmin={isAdmin}
                    isFirst={index === 0}
                    isLast={index === state.orderedSections.length - 1}
                    onEdit={(s) => dispatch({ type: 'SET_EDITOR_SECTION', payload: s })}
                    onDelete={(s) => dispatch({ type: 'SET_DELETING_SECTION', payload: s })}
                    onDuplicate={handleDuplicate}
                    onMoveUp={handleMoveUp}
                    onMoveDown={handleMoveDown}
                  />
                  {/* Insertion point between sections */}
                  {canWrite && (
                    <InsertionPoint onClick={() => dispatch({ type: 'OPEN_QUICK_ADD', payload: index + 1 })} />
                  )}
                </Box>
              ))}
            </Stack>
          </SortableContext>
          <DragOverlay dropAnimation={{ duration: 200, easing: 'ease' }}>
            {activeSection ? (
              <Paper elevation={12} sx={{ display: 'flex', alignItems: 'center', gap: 1, px: 2, py: 1, borderRadius: 2, bgcolor: 'background.paper', border: '1px solid', borderColor: 'primary.main', pointerEvents: 'none' }}>
                <DragIndicatorIcon fontSize="small" color="primary" />
                <Typography variant="body2" noWrap sx={{ fontWeight: 500 }}>
                  {t(`sectionEditor.typeNames.${activeSection.section_type}`)}: {getPrimaryTitle(activeSection.id) || t('pageDetail.sections.untitled')}
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
          dispatch({ type: 'CLOSE_QUICK_ADD' });
        }}
        onClose={() => dispatch({ type: 'CLOSE_QUICK_ADD' })}
        loading={createLoading}
        nextOrder={state.insertAtOrder}
      />
      {/* Side panel editor (replaces modal) */}
      <Drawer
        anchor="right"
        open={!!state.editorSection}
        onClose={() => {
          dispatch({ type: 'SET_EDITOR_SECTION', payload: null });
          onSectionEditorClose();
        }}
        slotProps={{
          paper: { sx: { width: { xs: '100%', sm: '50%', lg: '33%' }, minWidth: { sm: 400 } } }
        }}
      >
        {state.editorSection && (
          <SectionEditorDialog
            open={true}
            section={state.editorSection}
            onClose={() => {
              dispatch({ type: 'SET_EDITOR_SECTION', payload: null });
              onSectionEditorClose();
            }}
            embedded
            pageContext={{
              route: pageRoute,
              existingSectionTypes: (sections ?? [])
                .filter((s) => s.id !== state.editorSection?.id)
                .sort((a, b) => a.display_order - b.display_order)
                .map((s) => s.section_type),
            }}
          />
        )}
      </Drawer>
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
