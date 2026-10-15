import type { CSSProperties } from 'react';
import { PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';

/** Pointer sensor shared by drag-to-reorder lists: a 5px move starts a drag, so clicks still land. */
export function useReorderSensors() {
  return useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));
}

/**
 * dnd-kit `useSortable` plus the style every drag-to-reorder row shares: the
 * row follows the pointer and the placeholder it leaves behind is dimmed.
 */
export function useSortableRow(id: string) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id });
  const style: CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.4 : 1,
  };
  return { attributes, listeners, setNodeRef, style };
}
