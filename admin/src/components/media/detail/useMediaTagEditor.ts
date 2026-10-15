import { useCallback } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { updateMediaTags } from '@/services/media';
import { queryKeys } from '@/lib/queryKeys';

/** Tag edits on a media file — every change is persisted immediately. */
export function useMediaTagEditor(mediaId: string | undefined, siteId: string, mediaTags: string[]) {
  const queryClient = useQueryClient();

  const { mutate: saveTags, isPending: saving } = useMutation({
    mutationFn: (tags: string[]) => updateMediaTags(mediaId!, tags),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.mediaTags(mediaId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.media(siteId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.siteTags(siteId) });
    },
  });

  const handleTagsChange = useCallback((newTags: string[]) => saveTags(newTags), [saveTags]);

  const addTag = useCallback((tag: string) => {
    if (!mediaTags.includes(tag)) saveTags([...mediaTags, tag]);
  }, [mediaTags, saveTags]);

  const mergeTags = useCallback((tags: string[]) => {
    saveTags([...new Set([...mediaTags, ...tags])]);
  }, [mediaTags, saveTags]);

  return { saving, handleTagsChange, addTag, mergeTags };
}
