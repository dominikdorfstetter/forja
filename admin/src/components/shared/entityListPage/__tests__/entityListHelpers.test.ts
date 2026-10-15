import { describe, it, expect, vi } from 'vitest';
import {
  buildListQueryParams,
  bulkRequestFor,
  bulkToolbarHandlers,
  entityRoutePath,
  nextSortDir,
  resolveListView,
} from '../entityListHelpers';

const base = {
  page: 2,
  pageSize: 25,
  search: '',
  isArchived: false,
  statusFilter: '',
  sortBy: 'updated_at',
  sortDir: 'desc' as const,
};

describe('buildListQueryParams', () => {
  it('excludes archived rows on the Active tab and drops empty search/filter', () => {
    expect(buildListQueryParams(base)).toEqual({
      page: 2,
      page_size: 25,
      search: undefined,
      status: undefined,
      sort_by: 'updated_at',
      sort_dir: 'desc',
      exclude_status: 'Archived',
    });
  });

  it('applies the chip filter and search on the Active tab', () => {
    const params = buildListQueryParams({ ...base, search: 'hello', statusFilter: 'Draft' });
    expect(params).toMatchObject({ search: 'hello', status: 'Draft', exclude_status: 'Archived' });
  });

  it('pins status=Archived on the Archived tab, ignoring the chip filter', () => {
    const params = buildListQueryParams({ ...base, isArchived: true, statusFilter: 'Draft' });
    expect(params).toMatchObject({ status: 'Archived', exclude_status: undefined });
  });

  it('merges adapter-specific extras', () => {
    expect(buildListQueryParams({ ...base, extra: { page_type: 'landing' } })).toMatchObject({ page_type: 'landing' });
  });
});

describe('nextSortDir', () => {
  it('starts a new column ascending', () => {
    expect(nextSortDir({ sortBy: 'title', sortDir: 'desc' }, 'created_at')).toBe('asc');
  });

  it('flips the direction of the sorted column', () => {
    expect(nextSortDir({ sortBy: 'title', sortDir: 'asc' }, 'title')).toBe('desc');
    expect(nextSortDir({ sortBy: 'title', sortDir: 'desc' }, 'title')).toBe('asc');
  });
});

describe('bulkRequestFor', () => {
  it('maps delete to the Delete action', () => {
    expect(bulkRequestFor('delete', ['a'])).toEqual({ ids: ['a'], action: 'Delete' });
  });

  it.each([
    ['publish', 'Published'],
    ['archive', 'Archived'],
    ['unpublish', 'Draft'],
    ['restore', 'Draft'],
  ] as const)('maps %s to UpdateStatus %s', (action, status) => {
    expect(bulkRequestFor(action, ['a', 'b'])).toEqual({ ids: ['a', 'b'], action: 'UpdateStatus', status });
  });
});

describe('entityRoutePath', () => {
  const adapter = { entityKey: 'blog', getItemId: (i: { id: string }) => i.id };

  it('defaults to /${entityKey}s/${id}', () => {
    expect(entityRoutePath(adapter, { id: '42' })).toBe('/blogs/42');
  });

  it('honours the adapter routePath override', () => {
    expect(entityRoutePath({ ...adapter, routePath: (i) => `/legal/${i.id}` }, { id: '42' })).toBe('/legal/42');
  });
});

describe('resolveListView', () => {
  const ready = { hasSite: true, isLoading: false, hasError: false, itemCount: 3, pristine: true };

  it('resolves in precedence order: noSite → loading → error → empty → ready', () => {
    expect(resolveListView({ ...ready, hasSite: false, isLoading: true })).toBe('noSite');
    expect(resolveListView({ ...ready, isLoading: true, hasError: true })).toBe('loading');
    expect(resolveListView({ ...ready, hasError: true, itemCount: 0 })).toBe('error');
    expect(resolveListView({ ...ready, itemCount: 0 })).toBe('empty');
    expect(resolveListView(ready)).toBe('ready');
  });

  it('keeps the table for a filtered/searched miss', () => {
    expect(resolveListView({ ...ready, itemCount: 0, pristine: false })).toBe('ready');
  });
});

describe('bulkToolbarHandlers', () => {
  const actions = {
    openBulkPublish: vi.fn(),
    openBulkUnpublish: vi.fn(),
    openBulkArchive: vi.fn(),
    openBulkRestore: vi.fn(),
    openBulkDelete: vi.fn(),
    closeAllBulk: vi.fn(),
  };

  it('offers publish/unpublish/archive on the Active tab', () => {
    expect(bulkToolbarHandlers(false, actions)).toEqual({
      onPublish: actions.openBulkPublish,
      onUnpublish: actions.openBulkUnpublish,
      onArchive: actions.openBulkArchive,
      onRestore: undefined,
    });
  });

  it('offers only restore on the Archived tab', () => {
    expect(bulkToolbarHandlers(true, actions)).toEqual({
      onPublish: undefined,
      onUnpublish: undefined,
      onArchive: undefined,
      onRestore: actions.openBulkRestore,
    });
  });
});
