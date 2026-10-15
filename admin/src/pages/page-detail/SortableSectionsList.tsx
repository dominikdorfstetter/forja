import { Box, Button, Stack } from '@mui/material';
import AddIcon from '@mui/icons-material/Add';
import {
  DndContext,
  closestCenter,
  DragOverlay,
  type DragStartEvent,
  type DragEndEvent,
} from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { useTranslation } from 'react-i18next';
import type { PageSectionResponse, SectionLocalizationResponse } from '@/types/api';
import SortableSectionRow from '@/components/pages/SortableSectionRow';
import {
  localeChipsFor,
  primaryTitleFor,
  subtitleFor,
  type SectionsLocale,
} from './pageSectionsHelpers';
import { DragPreviewCard, useReorderSensors } from '@/components/shared/listPageV2';

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

/** Floating card that follows the pointer while a section is dragged. */
function SectionDragPreview({ section, title }: { section: PageSectionResponse; title: string | null }) {
  const { t } = useTranslation();
  return (
    <DragPreviewCard>
      {t(`sectionEditor.typeNames.${section.section_type}`)}: {title || t('pageDetail.sections.untitled')}
    </DragPreviewCard>
  );
}

interface SortableSectionsListProps {
  sections: PageSectionResponse[];
  /** Section currently being dragged, rendered in the drag overlay. */
  activeSection: PageSectionResponse | null | undefined;
  sectionLocalizations: SectionLocalizationResponse[] | undefined;
  activeLocales: SectionsLocale[];
  canWrite: boolean;
  isAdmin: boolean;
  /** Opens the quick-add dialog to insert a section at the given display order. */
  onInsertAt: (order: number) => void;
  onEdit: (section: PageSectionResponse) => void;
  onDelete: (section: PageSectionResponse) => void;
  onDuplicate: (section: PageSectionResponse) => void;
  onMoveUp: (section: PageSectionResponse) => void;
  onMoveDown: (section: PageSectionResponse) => void;
  onDragStart: (event: DragStartEvent) => void;
  onDragEnd: (event: DragEndEvent) => void;
}

/** Drag-and-drop list of a page's sections with insertion points between rows. */
export default function SortableSectionsList({
  sections,
  activeSection,
  sectionLocalizations,
  activeLocales,
  canWrite,
  isAdmin,
  onInsertAt,
  onEdit,
  onDelete,
  onDuplicate,
  onMoveUp,
  onMoveDown,
  onDragStart,
  onDragEnd,
}: SortableSectionsListProps) {
  const sensors = useReorderSensors();

  return (
    <DndContext sensors={sensors} collisionDetection={closestCenter} onDragStart={onDragStart} onDragEnd={onDragEnd}>
      <SortableContext items={sections.map((s) => s.id)} strategy={verticalListSortingStrategy}>
        <Stack spacing={0}>
          {/* Insertion point at top */}
          {canWrite && (
            <InsertionPoint onClick={() => onInsertAt(0)} />
          )}
          {sections.map((section, index) => (
            <Box key={section.id}>
              <SortableSectionRow
                section={section}
                localeChips={localeChipsFor(section.id, sectionLocalizations, activeLocales)}
                primaryTitle={primaryTitleFor(section.id, sectionLocalizations)}
                subtitle={subtitleFor(section.id, sectionLocalizations)}
                canWrite={canWrite}
                isAdmin={isAdmin}
                isFirst={index === 0}
                isLast={index === sections.length - 1}
                onEdit={onEdit}
                onDelete={onDelete}
                onDuplicate={onDuplicate}
                onMoveUp={onMoveUp}
                onMoveDown={onMoveDown}
              />
              {/* Insertion point between sections */}
              {canWrite && (
                <InsertionPoint onClick={() => onInsertAt(index + 1)} />
              )}
            </Box>
          ))}
        </Stack>
      </SortableContext>
      <DragOverlay dropAnimation={{ duration: 200, easing: 'ease' }}>
        {activeSection ? (
          <SectionDragPreview section={activeSection} title={primaryTitleFor(activeSection.id, sectionLocalizations)} />
        ) : null}
      </DragOverlay>
    </DndContext>
  );
}
