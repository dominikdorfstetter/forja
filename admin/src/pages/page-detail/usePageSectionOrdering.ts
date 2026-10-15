import { useCallback, useEffect, useReducer } from 'react';
import { arrayMove } from '@dnd-kit/sortable';
import type { DragEndEvent, DragStartEvent } from '@dnd-kit/core';
import type { PageSectionResponse, ReorderItem } from '@/types/api';
import { sortByDisplayOrder, toReorderItems } from './pageSectionsHelpers';

interface OrderingState {
  orderedSections: PageSectionResponse[];
  /** Id of the section currently being dragged. */
  activeId: string | null;
}

type OrderingAction =
  | { type: 'SET_ORDERED_SECTIONS'; payload: PageSectionResponse[] }
  | { type: 'SET_ACTIVE_ID'; payload: string | null };

const initialOrderingState: OrderingState = { orderedSections: [], activeId: null };

function orderingReducer(state: OrderingState, action: OrderingAction): OrderingState {
  switch (action.type) {
    case 'SET_ORDERED_SECTIONS':
      return { ...state, orderedSections: action.payload };
    case 'SET_ACTIVE_ID':
      return { ...state, activeId: action.payload };
    default:
      return state;
  }
}

/**
 * Local, optimistically reordered copy of the page's sections — drag-and-drop
 * and move up/down reorder it immediately and report the new order upstream.
 */
export function usePageSectionOrdering(
  sections: PageSectionResponse[] | undefined,
  onReorderSections: (items: ReorderItem[]) => void,
) {
  const [state, dispatch] = useReducer(orderingReducer, initialOrderingState);

  // react-doctor-disable-next-line useEffect-event-handler — syncs server data to local DnD state
  useEffect(() => {
    if (sections) {
      dispatch({ type: 'SET_ORDERED_SECTIONS', payload: sortByDisplayOrder(sections) });
    }
  }, [sections]);

  const commitOrder = useCallback((reordered: PageSectionResponse[]) => {
    dispatch({ type: 'SET_ORDERED_SECTIONS', payload: reordered });
    onReorderSections(toReorderItems(reordered));
  }, [onReorderSections]);

  const handleDragStart = useCallback((event: DragStartEvent) => {
    dispatch({ type: 'SET_ACTIVE_ID', payload: event.active.id as string });
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    dispatch({ type: 'SET_ACTIVE_ID', payload: null });
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = state.orderedSections.findIndex((s) => s.id === active.id);
    const newIndex = state.orderedSections.findIndex((s) => s.id === over.id);
    commitOrder(arrayMove(state.orderedSections, oldIndex, newIndex));
  }, [commitOrder, state.orderedSections]);

  const handleMoveUp = useCallback((section: PageSectionResponse) => {
    const idx = state.orderedSections.findIndex((s) => s.id === section.id);
    if (idx <= 0) return;
    commitOrder(arrayMove(state.orderedSections, idx, idx - 1));
  }, [state.orderedSections, commitOrder]);

  const handleMoveDown = useCallback((section: PageSectionResponse) => {
    const idx = state.orderedSections.findIndex((s) => s.id === section.id);
    if (idx < 0 || idx >= state.orderedSections.length - 1) return;
    commitOrder(arrayMove(state.orderedSections, idx, idx + 1));
  }, [state.orderedSections, commitOrder]);

  const activeSection = state.activeId
    ? state.orderedSections.find((s) => s.id === state.activeId)
    : null;

  return {
    orderedSections: state.orderedSections,
    activeSection,
    handleDragStart,
    handleDragEnd,
    handleMoveUp,
    handleMoveDown,
  };
}
