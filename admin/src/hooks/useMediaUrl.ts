import { useQuery } from '@tanstack/react-query';
import apiService from '@/services/api';

/**
 * Returns the public_url for a media file given its ID.
 * Caches aggressively since media URLs rarely change.
 */
export function useMediaUrl(mediaId: string | null | undefined): string | undefined {
  const { data } = useQuery({
    queryKey: ['media', mediaId],
    queryFn: () => apiService.getMediaById(mediaId!),
    enabled: !!mediaId,
    staleTime: 5 * 60 * 1000,
  });
  return data?.public_url ?? undefined;
}
