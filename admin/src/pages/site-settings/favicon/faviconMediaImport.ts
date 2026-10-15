import { getMediaById } from '@/services/media';

export type MediaImageImport =
  | { ok: true; file: File }
  | { ok: false; reason: 'noPublicUrl' }
  | { ok: false; reason: 'fetchFailed'; status: number }
  | { ok: false; reason: 'notImage' };

/**
 * Download a media-library item as an image `File` for favicon generation.
 * Expected failures come back as a reason; network/API errors still throw.
 */
export async function loadMediaAsImageFile(mediaId: string): Promise<MediaImageImport> {
  const media = await getMediaById(mediaId);
  if (!media.public_url) return { ok: false, reason: 'noPublicUrl' };

  const response = await fetch(media.public_url);
  if (!response.ok) return { ok: false, reason: 'fetchFailed', status: response.status };

  const blob = await response.blob();
  if (!blob.type.startsWith('image/')) return { ok: false, reason: 'notImage' };

  const extension = media.original_filename.split('.').pop() ?? 'png';
  const file = new File([blob], media.original_filename, {
    type: blob.type || `image/${extension}`,
  });
  return { ok: true, file };
}
