import { useReducer, useCallback } from 'react';
import {
  Box,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
} from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import ViewListIcon from '@mui/icons-material/ViewList';
import PreviewIcon from '@mui/icons-material/Preview';
import { useTranslation } from 'react-i18next';
import type {
  PageSectionResponse,
  SectionLocalizationResponse,
  CreatePageSectionRequest,
  ReorderItem,
} from '@/types/api';
import LoadingState from '@/components/shared/LoadingState';
import EmptyState from '@/components/shared/EmptyState';
import { M3Button } from '@/components/design-system';
import ConfirmDialog from '@/components/shared/ConfirmDialog';
import PagePreview from '@/components/pages/PagePreview';
import SectionQuickAddDialog from './SectionQuickAddDialog';
import SortableSectionsList from './SortableSectionsList';
import { usePageSectionOrdering } from './usePageSectionOrdering';
import SectionEditorDrawer from './SectionEditorDrawer';
import type { SectionsLocale } from './pageSectionsHelpers';

interface PageSectionsTabProps {
  pageId: string;
  pageRoute?: string;
  sections: PageSectionResponse[] | undefined;
  sectionsLoading: boolean;
  sectionLocalizations: SectionLocalizationResponse[] | undefined;
  activeLocales: SectionsLocale[];
  canWrite: boolean;
  isAdmin: boolean;
  onCreateSection: (data: CreatePageSectionRequest) => void;
  onDeleteSection: (sectionId: string) => void;
  onReorderSections: (items: ReorderItem[]) => void;
  onSectionEditorClose: () => void;
  createLoading: boolean;
  deleteLoading: boolean;
}

// --- Reducer ---

interface SectionsTabState {
  viewMode: 'edit' | 'preview';
  quickAddOpen: boolean;
  insertAtOrder: number;
  editorSection: PageSectionResponse | null;
  deletingSection: PageSectionResponse | null;
}

type SectionsTabAction =
  | { type: 'SET_VIEW_MODE'; payload: 'edit' | 'preview' }
  | { type: 'OPEN_QUICK_ADD'; payload: number }
  | { type: 'CLOSE_QUICK_ADD' }
  | { type: 'SET_EDITOR_SECTION'; payload: PageSectionResponse | null }
  | { type: 'SET_DELETING_SECTION'; payload: PageSectionResponse | null };

const initialSectionsState: SectionsTabState = {
  viewMode: 'edit',
  quickAddOpen: false,
  insertAtOrder: 0,
  editorSection: null,
  deletingSection: null,
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
    default:
      return state;
  }
}

/** Edit-mode body: loading → empty state → the sortable list (passed as children). */
function SectionsEditView({
  loading,
  isEmpty,
  canWrite,
  onAddFirst,
  children,
}: {
  loading: boolean;
  isEmpty: boolean;
  canWrite: boolean;
  onAddFirst: () => void;
  children: React.ReactNode;
}) {
  const { t } = useTranslation();
  if (loading) return <LoadingState label={t('pageDetail.sections.loadingSections')} />;
  if (isEmpty) {
    return (
      <EmptyState
        icon={<AddIcon sx={{ fontSize: 48 }} />}
        title={t('pageDetail.sections.empty')}
        description={t('pageDetail.sections.emptyDescription')}
        action={canWrite ? { label: t('pageDetail.sections.add'), onClick: onAddFirst } : undefined}
      />
    );
  }
  return children;
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
  const ordering = usePageSectionOrdering(sections, onReorderSections);
  const openQuickAdd = (order: number) => dispatch({ type: 'OPEN_QUICK_ADD', payload: order });

  const handleDuplicate = useCallback((section: PageSectionResponse) => {
    onCreateSection({
      section_type: section.section_type,
      display_order: section.display_order + 1,
      cover_image_id: section.cover_image_id || undefined,
      call_to_action_route: section.call_to_action_route || undefined,
      settings: section.settings || undefined,
    });
  }, [onCreateSection]);

  const closeEditor = () => {
    dispatch({ type: 'SET_EDITOR_SECTION', payload: null });
    onSectionEditorClose();
  };

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
          <M3Button variant="outlined" size="sm" icon="add" onClick={() => openQuickAdd(ordering.orderedSections.length)}>
            {t('pageDetail.sections.add')}
          </M3Button>
        )}
      </Box>
      {state.viewMode === 'preview' ? (
        <PagePreview
          sections={sections || []}
          localizations={sectionLocalizations || []}
        />
      ) : (
        <SectionsEditView
          loading={sectionsLoading}
          isEmpty={ordering.orderedSections.length === 0}
          canWrite={canWrite}
          onAddFirst={() => openQuickAdd(0)}
        >
          <SortableSectionsList
            sections={ordering.orderedSections}
            activeSection={ordering.activeSection}
            sectionLocalizations={sectionLocalizations}
            activeLocales={activeLocales}
            canWrite={canWrite}
            isAdmin={isAdmin}
            onInsertAt={openQuickAdd}
            onEdit={(s) => dispatch({ type: 'SET_EDITOR_SECTION', payload: s })}
            onDelete={(s) => dispatch({ type: 'SET_DELETING_SECTION', payload: s })}
            onDuplicate={handleDuplicate}
            onMoveUp={ordering.handleMoveUp}
            onMoveDown={ordering.handleMoveDown}
            onDragStart={ordering.handleDragStart}
            onDragEnd={ordering.handleDragEnd}
          />
        </SectionsEditView>
      )}
      <SectionQuickAddDialog
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
      <SectionEditorDrawer
        section={state.editorSection}
        sections={sections}
        pageRoute={pageRoute}
        onClose={closeEditor}
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
