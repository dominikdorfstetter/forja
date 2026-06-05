import { describe, it } from "node:test";
import assert from "node:assert/strict";
import type {
  PublicCollectionEntry,
  PublicCollectionField,
  PublicCollectionSchema,
} from "@forjacms/client";
import {
  buildCollectionStaticPaths,
  entryDisplayFields,
  entryTitle,
  formatFieldValue,
  isPageCollection,
} from "../collections.ts";

function field(p: Partial<PublicCollectionField> & { key: string }): PublicCollectionField {
  return { label: p.key, field_type: "text", localized: false, is_title: false, ...p };
}

const recipeSchema: PublicCollectionSchema = {
  key: "recipe",
  name: "Recipe",
  content_kind: "page",
  fields: [
    field({ key: "title", label: "Title", is_title: true }),
    field({ key: "servings", label: "Servings", field_type: "number" }),
    field({ key: "vegan", label: "Vegan", field_type: "boolean" }),
  ],
};

const dataSchema: PublicCollectionSchema = { ...recipeSchema, key: "leads", content_kind: "data" };

function entry(slug: string | null, data: Record<string, unknown>): PublicCollectionEntry {
  return { slug, status: "published", published_at: null, locale: "en", data };
}

describe("isPageCollection", () => {
  it("is true for page, false for data or null", () => {
    assert.equal(isPageCollection(recipeSchema), true);
    assert.equal(isPageCollection(dataSchema), false);
    assert.equal(isPageCollection(null), false);
  });
});

describe("buildCollectionStaticPaths", () => {
  it("routes page collections by slug, skipping data-only + slugless entries", () => {
    const paths = buildCollectionStaticPaths([
      {
        typeKey: "recipe",
        schema: recipeSchema,
        entries: [entry("spaghetti", { title: "Spaghetti" }), entry(null, { title: "x" })],
      },
      { typeKey: "leads", schema: dataSchema, entries: [entry("lead-1", {})] },
    ]);
    assert.equal(paths.length, 1);
    assert.deepEqual(paths[0].params, { collection: "recipe", slug: "spaghetti" });
    assert.equal(paths[0].props.typeKey, "recipe");
  });
});

describe("formatFieldValue", () => {
  it("formats per type and treats missing as empty", () => {
    assert.equal(formatFieldValue(field({ key: "v", field_type: "boolean" }), true), "Yes");
    assert.equal(formatFieldValue(field({ key: "v", field_type: "boolean" }), false), "No");
    assert.equal(formatFieldValue(field({ key: "v", field_type: "number" }), 4), "4");
    assert.equal(formatFieldValue(field({ key: "v" }), null), "");
  });
});

describe("entry rendering", () => {
  it("uses the title field as heading and lists the rest", () => {
    const e = entry("spaghetti", { title: "Spaghetti", servings: 4, vegan: false });
    assert.equal(entryTitle(recipeSchema, e), "Spaghetti");
    const fields = entryDisplayFields(recipeSchema, e);
    assert.deepEqual(
      fields.map((f) => f.key),
      ["servings", "vegan"],
    );
    assert.equal(fields.find((f) => f.key === "servings")?.value, "4");
    assert.equal(fields.find((f) => f.key === "vegan")?.value, "No");
  });
});
