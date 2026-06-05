/**
 * Custom-type ("Collections", #789) admin types — mirror of the backend DTOs
 * in `backend/src/dto/custom_type.rs`, `custom_entry.rs`, and `ropa.rs`.
 */

export type CustomFieldType =
  | 'text'
  | 'richtext'
  | 'number'
  | 'boolean'
  | 'date'
  | 'enum'
  | 'media';

export type CustomContentKind = 'page' | 'data';

/** Field definition sent when creating/editing a type. */
export interface CustomFieldInput {
  /** Present (with a changed key) on update = rename; absent = new field. */
  id?: string;
  key: string;
  label: string;
  labels?: Record<string, string> | null;
  field_type: CustomFieldType;
  required?: boolean;
  localized?: boolean;
  is_title?: boolean;
  is_pii?: boolean;
  data_category?: string | null;
  processing_purpose?: string | null;
  legal_basis?: string | null;
  enum_options?: string[] | null;
  min?: number | null;
  max?: number | null;
  min_length?: number | null;
  max_length?: number | null;
  pattern?: string | null;
  is_unique?: boolean;
  display_order?: number;
}

export interface CustomFieldResponse {
  id: string;
  key: string;
  label: string;
  labels: Record<string, string> | null;
  field_type: CustomFieldType;
  required: boolean;
  localized: boolean;
  is_title: boolean;
  is_pii: boolean;
  data_category: string | null;
  processing_purpose: string | null;
  legal_basis: string | null;
  enum_options: string[] | null;
  min: number | null;
  max: number | null;
  min_length: number | null;
  max_length: number | null;
  pattern: string | null;
  is_unique: boolean;
  display_order: number;
  deprecated_at: string | null;
}

export interface CustomTypeResponse {
  id: string;
  site_id: string;
  key: string;
  name: string;
  retention_days: number | null;
  is_publicly_readable: boolean;
  content_kind: CustomContentKind;
  schema_version: number;
  fields: CustomFieldResponse[];
  created_at: string;
  updated_at: string;
}

export interface CustomTypeSummary {
  id: string;
  key: string;
  name: string;
  content_kind: CustomContentKind;
  is_publicly_readable: boolean;
  schema_version: number;
  field_count: number;
  created_at: string;
  updated_at: string;
}

export interface CreateCustomTypeRequest {
  key: string;
  name: string;
  retention_days?: number | null;
  is_publicly_readable?: boolean;
  content_kind?: CustomContentKind;
  fields: CustomFieldInput[];
}

export interface UpdateCustomTypeRequest {
  name: string;
  retention_days?: number | null;
  is_publicly_readable?: boolean;
  content_kind?: CustomContentKind;
  fields: CustomFieldInput[];
}

// ── Entries ────────────────────────────────────────────────────────────────

export interface CustomEntryRequest {
  slug?: string | null;
  shared: Record<string, unknown>;
  localized: Record<string, Record<string, unknown>>;
}

export interface CustomEntryResponse {
  id: string;
  type_key: string;
  slug: string | null;
  status: string;
  published_at: string | null;
  shared: Record<string, unknown>;
  localized: Record<string, Record<string, unknown>>;
  created_at: string;
  updated_at: string;
}

export interface CustomEntrySummary {
  id: string;
  slug: string | null;
  status: string;
  title: string | null;
  published_at: string | null;
  updated_at: string;
}

// ── RoPA (GDPR Art. 30) ──────────────────────────────────────────────────────

export interface RopaFieldEntry {
  key: string;
  label: string;
  data_category: string | null;
  processing_purpose: string | null;
  legal_basis: string | null;
}

export interface RopaTypeEntry {
  key: string;
  name: string;
  retention_days: number | null;
  is_publicly_readable: boolean;
  record_count: number;
  pii_fields: RopaFieldEntry[];
}

export interface RopaReport {
  site_id: string;
  generated_at: string;
  processing_activities: RopaTypeEntry[];
}
