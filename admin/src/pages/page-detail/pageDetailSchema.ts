import { z } from 'zod';
import { requiredString, slugField, optionalString, nonNegativeInt } from '@/utils/validation';
import { CONTENT_STATUSES, PAGE_TYPES } from '@/utils/enumValues';

// Issue #623 Slice 4: shape sourced from generated types; Zod for refinements.

export const pageDetailSchema = z.object({
  route: requiredString(255),
  slug: slugField,
  page_type: z.enum(PAGE_TYPES),
  template: optionalString(100),
  status: z.enum(CONTENT_STATUSES),
  is_in_navigation: z.boolean(),
  navigation_order: z.union([nonNegativeInt, z.literal('')]),
  parent_page_id: z.string().optional().or(z.literal('')),
  publish_start: z.string().nullable().optional(),
  publish_end: z.string().nullable().optional(),
  // SEO metadata (from content localization)
  meta_title: z.string().max(60),
  meta_description: z.string().max(160),
  excerpt: z.string().max(300),
});

export type PageDetailFormData = z.infer<typeof pageDetailSchema>;
