import { describe, expectTypeOf, it } from 'vitest';
import type { components } from '@/generated/api-types';
import type { BlogListItem } from '@/types/api';

// Tracer bullet for issue #623 Slice 1.
//
// Provenance check: the admin's BlogListItem must be sourced from the
// backend's OpenAPI spec. If anyone re-introduces a hand-typed
// interface, or the backend DTO drifts from the admin consumer,
// `tsc --noEmit` fails here before runtime.
describe('OpenAPI codegen — BlogListItem provenance', () => {
  it('admin BlogListItem matches generated components["schemas"]["BlogListItem"]', () => {
    expectTypeOf<BlogListItem>().toEqualTypeOf<components['schemas']['BlogListItem']>();
  });
});
