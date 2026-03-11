import { z } from 'zod';
import { requiredString, slugField, optionalString, nonNegativeInt } from '@/utils/validation';

export const pageDetailSchema = z.object({
  route: requiredString(255),
  slug: slugField,
  page_type: z.enum(['Static', 'Landing', 'Contact', 'BlogIndex', 'Custom']),
  template: optionalString(100),
  status: z.enum(['Draft', 'InReview', 'Scheduled', 'Published', 'Archived']),
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
