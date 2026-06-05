import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FormChangeProvider } from '@/store/FormChangeContext';
import DirtyFieldMarker from '@/components/shared/DirtyFieldMarker';

function renderMarker(dirtyFields: unknown, revertField = vi.fn()) {
  return render(
    <FormChangeProvider dirtyFields={dirtyFields} revertField={revertField}>
      <DirtyFieldMarker name="title" label="Title">
        <input data-testid="title-input" />
      </DirtyFieldMarker>
    </FormChangeProvider>,
  );
}

describe('DirtyFieldMarker', () => {
  it('always renders its child field', () => {
    renderMarker({});
    expect(screen.getByTestId('title-input')).toBeInTheDocument();
  });

  it('shows a change indicator and revert control only when the field is dirty', () => {
    const { rerender } = renderMarker({ title: true });
    expect(screen.getByTestId('field-marker-title')).toBeInTheDocument();
    expect(screen.getByTestId('field-revert-title')).toBeInTheDocument();

    rerender(
      <FormChangeProvider dirtyFields={{}} revertField={vi.fn()}>
        <DirtyFieldMarker name="title" label="Title">
          <input data-testid="title-input" />
        </DirtyFieldMarker>
      </FormChangeProvider>,
    );
    expect(screen.queryByTestId('field-marker-title')).not.toBeInTheDocument();
    expect(screen.queryByTestId('field-revert-title')).not.toBeInTheDocument();
  });

  it('reverts the field when the revert control is clicked', async () => {
    const revertField = vi.fn();
    renderMarker({ title: true }, revertField);
    await userEvent.click(screen.getByTestId('field-revert-title'));
    expect(revertField).toHaveBeenCalledWith('title');
  });
});
