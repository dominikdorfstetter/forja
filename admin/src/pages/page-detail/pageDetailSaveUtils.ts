import type { UpdatePageRequest } from '@/types/api';
import type { PageDetailFormData } from './pageDetailSchema';

interface PageData {
  route: string;
  slug?: string;
  page_type: string;
  template?: string;
  status: string;
  is_in_navigation: boolean;
  navigation_order?: number;
  parent_page_id?: string;
  publish_start?: string;
  publish_end?: string;
}

interface LocalizationData {
  id: string;
  meta_title?: string | null;
  meta_description?: string | null;
  excerpt?: string | null;
}

export function buildPageUpdates(values: PageDetailFormData, page: PageData): UpdatePageRequest {
  const updates: UpdatePageRequest = {};

  if (values.route !== page.route) updates.route = values.route;
  if (values.slug !== (page.slug ?? '')) updates.slug = values.slug;
  if (values.page_type !== page.page_type) updates.page_type = values.page_type;
  if ((values.template ?? '') !== (page.template ?? '')) updates.template = values.template || undefined;
  if (values.status !== page.status) updates.status = values.status;
  if (values.is_in_navigation !== page.is_in_navigation) updates.is_in_navigation = values.is_in_navigation;

  const navOrder = values.navigation_order === '' ? undefined : Number(values.navigation_order);
  if (navOrder !== page.navigation_order) updates.navigation_order = navOrder;

  const parentId = values.parent_page_id || undefined;
  if (parentId !== page.parent_page_id) updates.parent_page_id = parentId;

  const formStart = values.publish_start || null;
  const formEnd = values.publish_end || null;
  if (formStart !== (page.publish_start ?? null)) updates.publish_start = formStart;
  if (formEnd !== (page.publish_end ?? null)) updates.publish_end = formEnd;

  return updates;
}

export function buildSeoLocalizationData(values: PageDetailFormData) {
  return {
    meta_title: values.meta_title || undefined,
    meta_description: values.meta_description || undefined,
    excerpt: values.excerpt || undefined,
  };
}

export function hasSeoChanges(values: PageDetailFormData, localization: LocalizationData | undefined): boolean {
  return (
    values.meta_title !== (localization?.meta_title ?? '') ||
    values.meta_description !== (localization?.meta_description ?? '') ||
    values.excerpt !== (localization?.excerpt ?? '')
  );
}
