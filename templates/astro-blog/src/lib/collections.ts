// ---------------------------------------------------------------------------
// Custom-type ("Collections", #801) consumption helpers.
//
// A site declares which collection keys to publish as pages via the
// `CMS_PAGE_COLLECTIONS` env var (comma-separated). Auto-discovery would need
// a public "list collections" endpoint — a documented fast-follow. Only
// `content_kind === "page"` collections are routed; data-only ones are
// skipped (never rendered).
// ---------------------------------------------------------------------------

import type {
  PublicCollectionEntry,
  PublicCollectionField,
  PublicCollectionSchema,
} from "@forjacms/client";

/** Candidate collection keys from `CMS_PAGE_COLLECTIONS` (comma-separated). */
export function getPageCollectionKeys(): string[] {
  const raw = (import.meta.env.CMS_PAGE_COLLECTIONS as string | undefined) ?? "";
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Page collections get public routes; data-only ones do not. */
export function isPageCollection(schema: PublicCollectionSchema | null): boolean {
  return !!schema && schema.content_kind === "page";
}

/** A single routable entry: which collection + slug it lives at. */
export interface CollectionPath {
  params: { collection: string; slug: string };
  props: { typeKey: string; entry: PublicCollectionEntry; schema: PublicCollectionSchema };
}

/**
 * Build Astro static paths for every page collection's published entries.
 * Pure: takes already-fetched schemas + entries so it is unit-testable.
 * Data-only collections and entries without a slug are skipped.
 */
export function buildCollectionStaticPaths(
  collections: { typeKey: string; schema: PublicCollectionSchema | null; entries: PublicCollectionEntry[] }[],
): CollectionPath[] {
  const paths: CollectionPath[] = [];
  for (const { typeKey, schema, entries } of collections) {
    if (!isPageCollection(schema) || !schema) continue;
    for (const entry of entries) {
      if (!entry.slug) continue;
      paths.push({ params: { collection: typeKey, slug: entry.slug }, props: { typeKey, entry, schema } });
    }
  }
  return paths;
}

/**
 * Render a single field value to a display string per its declared type.
 * Generic — no per-type code. Booleans → Yes/No, dates → locale date,
 * everything else → string. Missing values → "".
 */
export function formatFieldValue(field: PublicCollectionField, value: unknown): string {
  if (value === null || value === undefined) return "";
  switch (field.field_type) {
    case "boolean":
      return value ? "Yes" : "No";
    case "date": {
      const d = new Date(String(value));
      return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString();
    }
    case "number":
      return String(value);
    default:
      return String(value);
  }
}

/** The entry's heading — the value of the designated title field. */
export function entryTitle(
  schema: PublicCollectionSchema,
  entry: PublicCollectionEntry,
): string {
  const titleField = schema.fields.find((f) => f.is_title);
  const raw = titleField ? entry.data[titleField.key] : undefined;
  return raw != null ? String(raw) : (entry.slug ?? "");
}

/** Ordered, render-ready (label, value) pairs for an entry, skipping the
 * title field (rendered as the heading) and empty values. */
export function entryDisplayFields(
  schema: PublicCollectionSchema,
  entry: PublicCollectionEntry,
): { key: string; label: string; value: string; isRichtext: boolean }[] {
  return schema.fields
    .filter((f) => !f.is_title)
    .map((f) => ({
      key: f.key,
      label: f.label,
      value: formatFieldValue(f, entry.data[f.key]),
      isRichtext: f.field_type === "richtext",
    }))
    .filter((f) => f.value !== "");
}
