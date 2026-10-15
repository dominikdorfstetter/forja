/** Client-side guard rails for media uploads (the server re-validates). */

export const MAX_MEDIA_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

export const ACCEPTED_IMAGE_TYPES = [
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/avif',
  'image/svg+xml',
];

export const ACCEPTED_MEDIA_TYPES = [
  ...ACCEPTED_IMAGE_TYPES,
  'application/pdf', 'text/plain', 'text/markdown',
  'video/mp4', 'video/webm',
  'audio/mpeg', 'audio/wav', 'audio/ogg',
];

export type MediaFileIssue = 'tooLarge' | 'invalidType';

/**
 * First reason a file can't be uploaded, or null when it's acceptable.
 * Files without a MIME type pass the type check — the server sniffs them.
 */
export function checkMediaFile(file: File, acceptedTypes: readonly string[]): MediaFileIssue | null {
  if (file.size > MAX_MEDIA_FILE_SIZE) return 'tooLarge';
  if (file.type && !acceptedTypes.includes(file.type)) return 'invalidType';
  return null;
}
