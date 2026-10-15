import { useQuery } from '@tanstack/react-query';
import { getMediaById, getMediaMetadata, getMediaTags, getMediaUsage, getSiteTags } from '@/services/media';
import { getSiteLocales } from '@/services/siteLocales';
import { getSiteSettings } from '@/services/sites';
import type { MediaMetadataResponse, SiteSettingsResponse, SiteTagItem } from '@/types/api';
import { queryKeys } from '@/lib/queryKeys';

const EMPTY_METADATA: MediaMetadataResponse[] = [];
const EMPTY_TAGS: string[] = [];
const EMPTY_SITE_TAGS: SiteTagItem[] = [];

/** Server state shown in the media detail dialog for one file on one site. */
export function useMediaDetailQueries(mediaId: string | undefined, siteId: string) {
  const { data: siteSettings } = useQuery<SiteSettingsResponse>({
    queryKey: queryKeys.siteSettings(siteId),
    queryFn: () => getSiteSettings(siteId),
    enabled: !!siteId,
  });

  const { data: siteLocales = [] } = useQuery({
    queryKey: queryKeys.siteLocales(siteId),
    queryFn: () => getSiteLocales(siteId),
    enabled: !!siteId,
  });

  const { data: metadata = EMPTY_METADATA } = useQuery({
    queryKey: queryKeys.mediaMetadata(mediaId),
    queryFn: () => getMediaMetadata(mediaId!),
    enabled: !!mediaId,
  });

  const { data: mediaTags = EMPTY_TAGS } = useQuery<string[]>({
    queryKey: queryKeys.mediaTags(mediaId),
    queryFn: () => getMediaTags(mediaId!).then((r) => r.tags),
    enabled: !!mediaId,
  });

  const { data: siteTags = EMPTY_SITE_TAGS } = useQuery({
    queryKey: queryKeys.siteTags(siteId),
    queryFn: () => getSiteTags(siteId).then((r) => r.tags),
    enabled: !!siteId,
  });

  const { data: mediaDetail } = useQuery({
    queryKey: queryKeys.mediaDetail(mediaId),
    queryFn: () => getMediaById(mediaId!),
    enabled: !!mediaId,
  });

  const { data: mediaUsage } = useQuery({
    queryKey: queryKeys.mediaUsage(mediaId),
    queryFn: () => getMediaUsage(mediaId!),
    enabled: !!mediaId,
  });

  return { siteSettings, siteLocales, metadata, mediaTags, siteTags, mediaDetail, mediaUsage };
}
