import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { FormChangeProvider, useFieldDirty } from '@/store/FormChangeContext';

function Probe({ name }: { name: string }) {
  const { isDirty, revert } = useFieldDirty(name);
  return (
    <button data-testid={`probe-${name}`} data-dirty={isDirty} onClick={revert}>
      {name}
    </button>
  );
}

describe('useFieldDirty', () => {
  it('reports a flat field as dirty', () => {
    render(
      <FormChangeProvider dirtyFields={{ title: true }} revertField={vi.fn()}>
        <Probe name="title" />
        <Probe name="body" />
      </FormChangeProvider>,
    );
    expect(screen.getByTestId('probe-title').dataset.dirty).toBe('true');
    expect(screen.getByTestId('probe-body').dataset.dirty).toBe('false');
  });

  it('resolves dotted paths into nested dirtyFields', () => {
    render(
      <FormChangeProvider dirtyFields={{ seo: { title: true } }} revertField={vi.fn()}>
        <Probe name="seo.title" />
        <Probe name="seo.description" />
      </FormChangeProvider>,
    );
    expect(screen.getByTestId('probe-seo.title').dataset.dirty).toBe('true');
    expect(screen.getByTestId('probe-seo.description').dataset.dirty).toBe('false');
  });

  it('revert calls revertField with the field name', async () => {
    const revertField = vi.fn();
    render(
      <FormChangeProvider dirtyFields={{ title: true }} revertField={revertField}>
        <Probe name="title" />
      </FormChangeProvider>,
    );
    await userEvent.click(screen.getByTestId('probe-title'));
    expect(revertField).toHaveBeenCalledWith('title');
  });

  it('degrades gracefully with no provider (never dirty, revert is a no-op)', async () => {
    render(<Probe name="title" />);
    expect(screen.getByTestId('probe-title').dataset.dirty).toBe('false');
    await userEvent.click(screen.getByTestId('probe-title')); // must not throw
  });
});
