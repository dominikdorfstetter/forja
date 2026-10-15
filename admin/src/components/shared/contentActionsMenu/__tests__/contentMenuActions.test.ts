import { describe, it, expect, vi } from 'vitest';
import type { ContentStatus } from '@/types/api';
import { visibleContentMenuActions, type ContentMenuHandlers } from '../contentMenuActions';

const allHandlers: ContentMenuHandlers<unknown> = {
  edit: vi.fn(),
  publish: vi.fn(),
  unpublish: vi.fn(),
  archive: vi.fn(),
  restore: vi.fn(),
};

const ids = (status: ContentStatus, canWrite: boolean, handlers = allHandlers) =>
  visibleContentMenuActions(status, canWrite, handlers).map((a) => a.id);

describe('visibleContentMenuActions', () => {
  it.each<[ContentStatus, string[]]>([
    ['Draft', ['edit', 'publish']],
    ['Scheduled', ['edit', 'publish', 'unpublish', 'archive']],
    ['Published', ['edit', 'unpublish', 'archive']],
    ['Archived', ['edit', 'restore']],
  ])('writer on %s gets the lifecycle actions in menu order', (status, expected) => {
    expect(ids(status, true)).toEqual(expected);
  });

  it('read-only users get no lifecycle actions', () => {
    expect(ids('Scheduled', false)).toEqual([]);
  });

  it('omits actions the caller did not wire a handler for', () => {
    const withoutArchiveRestore = { ...allHandlers, archive: undefined, restore: undefined };
    expect(ids('Published', true, withoutArchiveRestore)).toEqual(['edit', 'unpublish']);
    expect(ids('Archived', true, withoutArchiveRestore)).toEqual(['edit']);
  });

  it('pairs each action with its own handler', () => {
    const [publish] = visibleContentMenuActions('Draft', true, { publish: allHandlers.publish });
    expect(publish).toEqual({ id: 'publish', handler: allHandlers.publish });
  });
});
