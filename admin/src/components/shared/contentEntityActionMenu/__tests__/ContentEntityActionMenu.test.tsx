import { describe, it, expect, vi } from 'vitest';
import { renderWithProviders, screen, userEvent, within } from '@/test/test-utils';
import type { ContentStatus } from '@/types/api';
import { ContentEntityActionMenu } from '../ContentEntityActionMenu';

type Status = ContentStatus;

interface FakeEntity {
  id: string;
  status: Status;
}

function entity(status: Status, id = 'e-1'): FakeEntity {
  return { id, status };
}

interface RenderOpts {
  kind?: 'blog' | 'page' | 'legal';
  status?: Status;
  canWrite?: boolean;
  isAdmin?: boolean;
  cloneDisabled?: boolean;
  withClone?: boolean;
}

function setup(opts: RenderOpts = {}) {
  const handlers = {
    onView: vi.fn(),
    onPublish: vi.fn(),
    onUnpublish: vi.fn(),
    onArchive: vi.fn(),
    onRestore: vi.fn(),
    onDelete: vi.fn(),
    onClone: vi.fn(),
  };
  const kind = opts.kind ?? 'blog';
  const e = entity(opts.status ?? 'Draft');
  renderWithProviders(
    <ContentEntityActionMenu
      kind={kind}
      entity={e}
      canWrite={opts.canWrite ?? true}
      isAdmin={opts.isAdmin ?? true}
      onView={handlers.onView}
      onPublish={handlers.onPublish}
      onUnpublish={handlers.onUnpublish}
      onArchive={handlers.onArchive}
      onRestore={handlers.onRestore}
      onDelete={handlers.onDelete}
      onClone={opts.withClone === false ? undefined : handlers.onClone}
      cloneDisabled={opts.cloneDisabled}
    />,
  );
  return { handlers, entity: e, kind };
}

async function openMenu(kind: 'blog' | 'page' | 'legal') {
  const trigger = screen.getByTestId(`${kind}-actions.btn.menu`);
  await userEvent.click(trigger);
  return screen.getByRole('menu');
}

function labelOf(item: Element): string {
  const spans = Array.from(item.querySelectorAll('span'));
  const labelSpan = spans.find((s) => !s.classList.contains('material-symbols-rounded'));
  return labelSpan?.textContent?.trim() ?? '';
}

function menuLabels(menu: HTMLElement): string[] {
  return within(menu).getAllByRole('menuitem').map(labelOf);
}

function menuItem(menu: HTMLElement, label: string): HTMLElement {
  const items = within(menu).getAllByRole('menuitem');
  const match = items.find((it) => labelOf(it) === label);
  if (!match) throw new Error(`No menuitem with label "${label}". Found: ${items.map(labelOf).join(', ')}`);
  return match;
}

describe('ContentEntityActionMenu — tracer bullet', () => {
  it('blog Draft (admin + writer) exposes View, Publish, Clone, Delete and dispatches Publish', async () => {
    const { handlers, entity: e } = setup({ kind: 'blog', status: 'Draft' });

    const menu = await openMenu('blog');
    const labels = menuLabels(menu);

    expect(labels).toEqual(
      expect.arrayContaining(['View details', 'Publish', 'Clone', 'Delete']),
    );
    expect(labels).not.toContain('Unpublish');
    expect(labels).not.toContain('Archive');
    expect(labels).not.toContain('Restore');

    await userEvent.click(menuItem(menu, 'Publish'));
    expect(handlers.onPublish).toHaveBeenCalledWith(e);
  });
});

// --- transitions matrix ---

interface MatrixRow {
  status: Status;
  expected: Partial<Record<'Publish' | 'Unpublish' | 'Archive' | 'Restore', boolean>>;
}

const blogPageMatrix: MatrixRow[] = [
  { status: 'Draft', expected: { Publish: true, Unpublish: false, Archive: false, Restore: false } },
  { status: 'Scheduled', expected: { Publish: true, Unpublish: true, Archive: true, Restore: false } },
  { status: 'Published', expected: { Publish: false, Unpublish: true, Archive: true, Restore: false } },
  { status: 'Archived', expected: { Publish: false, Unpublish: false, Archive: false, Restore: true } },
];

const legalMatrix: MatrixRow[] = [
  { status: 'Draft', expected: { Publish: true, Unpublish: false, Archive: true, Restore: false } },
  { status: 'InReview', expected: { Publish: true, Unpublish: false, Archive: true, Restore: false } },
  { status: 'Published', expected: { Publish: false, Unpublish: true, Archive: true, Restore: false } },
  { status: 'Archived', expected: { Publish: false, Unpublish: false, Archive: false, Restore: true } },
];

describe.each(['blog', 'page'] as const)('ContentEntityActionMenu — %s transitions', (kind) => {
  it.each(blogPageMatrix)('status=$status surfaces correct transitions', async ({ status, expected }) => {
    setup({ kind, status });
    const menu = await openMenu(kind);
    const labels = menuLabels(menu);

    for (const [label, shouldShow] of Object.entries(expected)) {
      if (shouldShow) {
        expect(labels).toContain(label);
      } else {
        expect(labels).not.toContain(label);
      }
    }
  });
});

describe('ContentEntityActionMenu — legal transitions', () => {
  it.each(legalMatrix)('status=$status surfaces correct transitions', async ({ status, expected }) => {
    setup({ kind: 'legal', status });
    const menu = await openMenu('legal');
    const labels = menuLabels(menu);

    for (const [label, shouldShow] of Object.entries(expected)) {
      if (shouldShow) {
        expect(labels).toContain(label);
      } else {
        expect(labels).not.toContain(label);
      }
    }
  });
});

describe('ContentEntityActionMenu — kind-specific actions', () => {
  it('legal never shows Clone even when canWrite', async () => {
    setup({ kind: 'legal', status: 'Draft', canWrite: true, withClone: false });
    const menu = await openMenu('legal');
    expect(menuLabels(menu)).not.toContain('Clone');
  });

  it('blog shows Clone when onClone provided and canWrite', async () => {
    setup({ kind: 'blog', status: 'Draft', canWrite: true });
    const menu = await openMenu('blog');
    expect(menuLabels(menu)).toContain('Clone');
  });

  it('page shows Clone when onClone provided and canWrite', async () => {
    setup({ kind: 'page', status: 'Draft', canWrite: true });
    const menu = await openMenu('page');
    expect(menuLabels(menu)).toContain('Clone');
  });
});

describe('ContentEntityActionMenu — RBAC', () => {
  it('canWrite=false hides Publish/Unpublish/Clone/Archive/Restore', async () => {
    setup({ kind: 'blog', status: 'Scheduled', canWrite: false, isAdmin: true });
    const menu = await openMenu('blog');
    const labels = menuLabels(menu);
    expect(labels).toContain('View details');
    expect(labels).toContain('Delete');
    expect(labels).not.toContain('Publish');
    expect(labels).not.toContain('Unpublish');
    expect(labels).not.toContain('Clone');
    expect(labels).not.toContain('Archive');
  });

  it('isAdmin=false hides Delete', async () => {
    setup({ kind: 'blog', status: 'Draft', canWrite: true, isAdmin: false });
    const menu = await openMenu('blog');
    expect(menuLabels(menu)).not.toContain('Delete');
  });
});

describe('ContentEntityActionMenu — cloneDisabled', () => {
  it('renders Clone as disabled when cloneDisabled=true', async () => {
    setup({ kind: 'blog', status: 'Draft', cloneDisabled: true });
    const menu = await openMenu('blog');
    const clone = menuItem(menu, 'Clone');
    expect(clone).toBeDisabled();
  });
});

describe('ContentEntityActionMenu — dispatch', () => {
  it('clicking each action invokes its callback with the entity', async () => {
    const { handlers, entity: e } = setup({ kind: 'blog', status: 'Scheduled' });
    const menu = await openMenu('blog');

    await userEvent.click(menuItem(menu, 'View details'));
    expect(handlers.onView).toHaveBeenCalledWith(e);
  });
});
