import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getMedia, getMediaCategoryCounts, getMediaFolders, getSiteTags } from '@/services/media';
import type { MediaFolder } from '@/types/api';
import { queryKeys } from '@/lib/queryKeys';
import { buildMediaQueryParams, type MediaListFilters } from './mediaLibraryState';

const EMPTY_FOLDERS: MediaFolder[] = [];

/** Server state of the media library: the filtered page, facet counts, tags and folders. */
export function useMediaLibraryQueries(siteId: string, filters: MediaListFilters) {
  const { data: mediaData, isLoading, error } = useQuery({
    queryKey: queryKeys.media(siteId, filters.debouncedSearch, filters.mimeCategory, filters.selectedFolderId, filters.filterTags, filters.page, filters.pageSize),
    queryFn: () => getMedia(siteId, buildMediaQueryParams(filters)),
    enabled: !!siteId,
  });

  const { data: mediaCategoryCounts } = useQuery({
    queryKey: queryKeys.mediaCategoryCounts(siteId),
    queryFn: () => getMediaCategoryCounts(siteId),
    enabled: !!siteId,
    placeholderData: (prev) => prev,
  });

  const { data: siteTagsData, isLoading: siteTagsLoading } = useQuery({
    queryKey: queryKeys.siteTags(siteId),
    queryFn: () => getSiteTags(siteId, { limit: 10 }),
    enabled: !!siteId,
    // Keep the previous tag list visible while a refetch runs so the
    // filter strip doesn't flash empty between site switches / tag
    // refreshes — the user was seeing the chips "sometimes not
    // loading" because every refetch momentarily emptied the data.
    placeholderData: (prev) => prev,
  });

  const { data: folders = EMPTY_FOLDERS } = useQuery({
    queryKey: queryKeys.mediaFolders(siteId),
    queryFn: () => getMediaFolders(siteId),
    enabled: !!siteId,
  });

  const mediaFiles = useMemo(() => mediaData?.data || [], [mediaData?.data]);

  return {
    mediaFiles,
    pageMeta: mediaData?.meta,
    isLoading,
    error,
    mediaCategoryCounts,
    siteTags: siteTagsData?.tags ?? [],
    siteTagsLoading,
    folders,
  };
}
