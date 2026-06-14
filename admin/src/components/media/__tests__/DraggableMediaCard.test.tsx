import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DndContext } from '@dnd-kit/core';
import DraggableMediaCard from '../DraggableMediaCard';
import type { MediaListItem } from '@/types/api';

// Toggle read-only per test. vi.hoisted lets the mock factory read the flag.
const ro = vi.hoisted(() => ({ value: false }));
vi.mock('@/hooks/useReadOnly', () => ({
  useReadOnly: () => ({
    readOnly: ro.value,
    canWrite: !ro.value,
    gate: <T,>(v: T): T | undefined => (ro.value ? undefined : v),
    disabledProps: { disabled: ro.value, 'aria-disabled': ro.value },
  }),
}));

const file = { id: 'm1' } as unknown as MediaListItem;

function renderCard() {
  return render(
    <DndContext>
      <DraggableMediaCard file={file}>
        <span>thumb</span>
      </DraggableMediaCard>
    </DndContext>,
  );
}

describe('DraggableMediaCard read-only gating (#6)', () => {
  it('exposes drag affordances when the user can write', () => {
    ro.value = false;
    renderCard();
    const card = screen.getByText('thumb').parentElement as HTMLElement;
    // dnd-kit attaches its draggable a11y attributes only when listeners spread.
    expect(card).toHaveAttribute('aria-roledescription', 'draggable');
    expect(card.style.cursor).toBe('grab');
  });

  it('drops the drag affordance entirely under read-only (viewer/guest)', () => {
    ro.value = true;
    renderCard();
    const card = screen.getByText('thumb').parentElement as HTMLElement;
    // No drag listeners/attributes — a viewer cannot initiate a reorder drag.
    expect(card).not.toHaveAttribute('aria-roledescription');
    expect(card.style.cursor).toBe('default');
  });
});
