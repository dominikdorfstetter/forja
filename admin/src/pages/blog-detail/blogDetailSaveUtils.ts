import type { BlogDetailResponse } from '@/types/api';
import type { BlogContentFormData } from './blogDetailSchema';
import { calculateReadingTime } from './blogDetailSchema';

export function buildBlogUpdates(
  values: BlogContentFormData,
  blogDetail: BlogDetailResponse,
): Record<string, unknown> {
  const updates: Record<string, unknown> = {};

  if (values.status !== blogDetail.status) updates.status = values.status;
  if (values.author !== blogDetail.author) updates.author = values.author;
  if (values.published_date !== blogDetail.published_date?.split('T')[0]) updates.published_date = values.published_date;
  if (values.is_featured !== blogDetail.is_featured) updates.is_featured = values.is_featured;
  if (values.allow_comments !== blogDetail.allow_comments) updates.allow_comments = values.allow_comments;

  const readingTime = values.reading_time_override ? values.reading_time_minutes : calculateReadingTime(values.body);
  if (readingTime && readingTime !== blogDetail.reading_time_minutes) updates.reading_time_minutes = readingTime;

  const formStart = values.publish_start || null;
  const formEnd = values.publish_end || null;
  if (formStart !== (blogDetail.publish_start ?? null)) updates.publish_start = formStart;
  if (formEnd !== (blogDetail.publish_end ?? null)) updates.publish_end = formEnd;

  const formCoverImage = values.cover_image_id || null;
  const formHeaderImage = values.header_image_id || null;
  if (formCoverImage !== (blogDetail.cover_image_id ?? null)) updates.cover_image_id = formCoverImage;
  if (formHeaderImage !== (blogDetail.header_image_id ?? null)) updates.header_image_id = formHeaderImage;

  return updates;
}

export function buildLocalizationData(values: BlogContentFormData) {
  return {
    subtitle: values.subtitle || undefined,
    excerpt: values.excerpt || undefined,
    body: values.body || undefined,
    meta_title: values.meta_title || undefined,
    meta_description: values.meta_description || undefined,
  };
}
