import { describe, it, expect } from 'vitest';
import {
  buildMediaQueryParams,
  hasActiveMediaFilters,
  initialMediaPageState,
  mediaReducer,
  needsMediaTabRedirect,
  resolveMediaTab,
} from '../mediaLibraryState';

describe('mediaReducer', () => {
  it('toggling a filter tag adds/removes it and resets to page 1', () => {
    const added = mediaReducer({ ...initialMediaPageState, page: 3 }, { type: 'TOGGLE_FILTER_TAG', payload: 'cats' });
    expect(added).toMatchObject({ filterTags: ['cats'], page: 1 });
    expect(mediaReducer(added, { type: 'TOGGLE_FILTER_TAG', payload: 'cats' }).filterTags).toEqual([]);
  });

  it('toggling the active MIME category clears it', () => {
    const image = mediaReducer(initialMediaPageState, { type: 'TOGGLE_MIME_CATEGORY', payload: 'image' });
    expect(image.mimeCategory).toBe('image');
    expect(mediaReducer(image, { type: 'TOGGLE_MIME_CATEGORY', payload: 'image' }).mimeCategory).toBeNull();
  });
});

describe('buildMediaQueryParams', () => {
  it('sends only paging when no filters are set', () => {
    expect(buildMediaQueryParams(initialMediaPageState)).toEqual({ page: 1, page_size: 25 });
  });

  it('adds every active filter', () => {
    expect(buildMediaQueryParams({
      ...initialMediaPageState,
      debouncedSearch: 'logo',
      mimeCategory: 'image',
      selectedFolderId: 'f1',
      filterTags: ['a', 'b'],
    })).toEqual({ page: 1, page_size: 25, search: 'logo', mime_category: 'image', folder_id: 'f1', tags: 'a,b' });
  });
});

describe('hasActiveMediaFilters', () => {
  it('is false by default and true for any single filter', () => {
    expect(hasActiveMediaFilters(initialMediaPageState)).toBe(false);
    expect(hasActiveMediaFilters({ ...initialMediaPageState, debouncedSearch: 'x' })).toBe(true);
    expect(hasActiveMediaFilters({ ...initialMediaPageState, mimeCategory: 'video' })).toBe(true);
    expect(hasActiveMediaFilters({ ...initialMediaPageState, selectedFolderId: 'f' })).toBe(true);
    expect(hasActiveMediaFilters({ ...initialMediaPageState, filterTags: ['t'] })).toBe(true);
  });
});

describe('media tab routing', () => {
  it('shows documents only when the module is enabled', () => {
    expect(resolveMediaTab('documents', true)).toBe('documents');
    expect(resolveMediaTab('documents', false)).toBe('library');
    expect(resolveMediaTab(undefined, true)).toBe('library');
  });

  it('redirects missing, unknown, or disabled tabs to the library', () => {
    expect(needsMediaTabRedirect(undefined, true)).toBe(true);
    expect(needsMediaTabRedirect('bogus', true)).toBe(true);
    expect(needsMediaTabRedirect('documents', false)).toBe(true);
    expect(needsMediaTabRedirect('documents', true)).toBe(false);
    expect(needsMediaTabRedirect('library', false)).toBe(false);
  });
});
