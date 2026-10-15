import { describe, it, expect, vi } from 'vitest';
import type { ContentStatus } from '@/types/api';
import { visibleContentMenuActions, type ContentMenuHandlers } from '../contentMenuActions';

const allHandlers: ContentMenuHandlers<unknown> = {
  view: vi.fn(),
  edit: vi.fn(),
  publish: vi.fn(),
  unpublish: vi.fn(),
  clone: vi.fn(),
  archive: vi.fn(),
  restore: vi.fn(),
};

const ids = (status: ContentStatus, canWrite: boolean, handlers = allHandlers) =>
  visibleContentMenuActions(status, canWrite, handlers).map((a) => a.id);

describe('visibleContentMenuActions', () => {
  it.each<[ContentStatus, string[]]>([
    ['Draft', ['view', 'edit', 'publish', 'clone']],
    ['Scheduled', ['view', 'edit', 'publish', 'unpublish', 'clone', 'archive']],
    ['Published', ['view', 'edit', 'unpublish', 'clone', 'archive']],
    ['Archived', ['view', 'edit', 'clone', 'restore']],
  ])('writer on %s gets the lifecycle actions in menu order', (status, expected) => {
    expect(ids(status, true)).toEqual(expected);
  });

  it('read-only users only get View', () => {
    expect(ids('Scheduled', false)).toEqual(['view']);
  });

  it('omits actions the caller did not wire a handler for', () => {
    const withoutArchiveRestoreView = { ...allHandlers, archive: undefined, restore: undefined, view: undefined };
    expect(ids('Published', true, withoutArchiveRestoreView)).toEqual(['edit', 'unpublish', 'clone']);
    expect(ids('Archived', true, withoutArchiveRestoreView)).toEqual(['edit', 'clone']);
  });

  it('pairs each action with its own handler', () => {
    const [publish] = visibleContentMenuActions('Draft', true, { publish: allHandlers.publish });
    expect(publish).toEqual({ id: 'publish', handler: allHandlers.publish });
  });
});
