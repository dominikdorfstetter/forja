import { z } from 'zod';
import { CONTENT_STATUSES } from '@/utils/enumValues';

// Issue #623 Slice 4: shape sourced from generated types; Zod for refinements.

export const legalContentSchema = z.object({
  // Per-locale content
  title: z.string().min(1),
  body: z.string(),
  meta_title: z.string().max(60).optional().default(''),
  meta_description: z.string().max(160).optional().default(''),
  // Legal-doc-specific field (from doc_localizations)
  intro: z.string().optional().default(''),
  // Document-level metadata
  status: z.enum(CONTENT_STATUSES),
  publish_start: z.string().nullable().optional(),
  publish_end: z.string().nullable().optional(),
});

export type LegalContentFormData = z.infer<typeof legalContentSchema>;
