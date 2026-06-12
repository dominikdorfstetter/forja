/**
 * TanStack Query hooks for custom types ("Collections", #789): schema (type)
 * list/detail/mutations, entry list/detail/mutations + publish actions, and
 * the RoPA export. Mutations invalidate the relevant query keys.
 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  createCustomType,
  createEntry,
  deleteCustomType,
  deleteEntry,
  eraseEntryPii,
  getCustomType,
  getEntry,
  getRopa,
  listCustomTypes,
  listEntries,
  publishEntry,
  unpublishEntry,
  updateCustomType,
  updateEntry,
  type EntryListParams,
} from '@/services/customTypes';
import type {
  CreateCustomTypeRequest,
  CustomEntryRequest,
  UpdateCustomTypeRequest,
} from '@/types/customTypes';
import { queryKeys } from '@/lib/queryKeys';

// ── Types (schema) ───────────────────────────────────────────────────────────

export function useCustomTypes(siteId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.customTypes(siteId ?? ''),
    queryFn: () => listCustomTypes(siteId as string),
    enabled: !!siteId,
  });
}

export function useCustomType(siteId: string | null | undefined, key: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.customType(siteId ?? '', key ?? ''),
    queryFn: () => getCustomType(siteId as string, key as string),
    enabled: !!siteId && !!key,
  });
}

export function useCreateCustomType(siteId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateCustomTypeRequest) => createCustomType(siteId, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.customTypes(siteId) }),
  });
}

export function useUpdateCustomType(siteId: string, key: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (data: UpdateCustomTypeRequest) => updateCustomType(siteId, key, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.customTypes(siteId) });
      qc.invalidateQueries({ queryKey: queryKeys.customType(siteId, key) });
    },
  });
}

export function useDeleteCustomType(siteId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ key, force }: { key: string; force?: boolean }) =>
      deleteCustomType(siteId, key, force),
    onSuccess: () => qc.invalidateQueries({ queryKey: queryKeys.customTypes(siteId) }),
  });
}

// ── Entries ────────────────────────────────────────────────────────────────

export function useCustomEntries(siteId: string, key: string, params?: EntryListParams) {
  return useQuery({
    queryKey: queryKeys.customEntries(siteId, key, params ?? {}),
    queryFn: () => listEntries(siteId, key, params),
    enabled: !!siteId && !!key,
  });
}

export function useCustomEntry(siteId: string, key: string, id: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.customEntry(siteId, key, id ?? ''),
    queryFn: () => getEntry(siteId, key, id as string),
    enabled: !!siteId && !!key && !!id,
  });
}

/** Create / update / delete / publish / unpublish / erase, all invalidating
 * the entry list (and the affected entry) for the type. */
export function useCustomEntryMutations(siteId: string, key: string) {
  const qc = useQueryClient();
  const invalidate = (id?: string) => {
    qc.invalidateQueries({ queryKey: queryKeys.customEntries(siteId, key) });
    if (id) qc.invalidateQueries({ queryKey: queryKeys.customEntry(siteId, key, id) });
  };
  return {
    create: useMutation({
      mutationFn: (data: CustomEntryRequest) => createEntry(siteId, key, data),
      onSuccess: () => invalidate(),
    }),
    update: useMutation({
      mutationFn: ({ id, data }: { id: string; data: CustomEntryRequest }) =>
        updateEntry(siteId, key, id, data),
      onSuccess: (_d, { id }) => invalidate(id),
    }),
    remove: useMutation({
      mutationFn: (id: string) => deleteEntry(siteId, key, id),
      onSuccess: (_d, id) => invalidate(id),
    }),
    publish: useMutation({
      mutationFn: (id: string) => publishEntry(siteId, key, id),
      onSuccess: (_d, id) => invalidate(id),
    }),
    unpublish: useMutation({
      mutationFn: (id: string) => unpublishEntry(siteId, key, id),
      onSuccess: (_d, id) => invalidate(id),
    }),
    erasePii: useMutation({
      mutationFn: (id: string) => eraseEntryPii(siteId, key, id),
      onSuccess: (_d, id) => invalidate(id),
    }),
  };
}

// ── RoPA ─────────────────────────────────────────────────────────────────────

export function useRopa(siteId: string | null | undefined) {
  return useQuery({
    queryKey: queryKeys.ropa(siteId),
    queryFn: () => getRopa(siteId as string),
    enabled: !!siteId,
  });
}
