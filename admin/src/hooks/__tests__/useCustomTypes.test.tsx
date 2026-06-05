import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { type ReactNode, createElement } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import * as service from '@/services/customTypes';
import {
  useCustomType,
  useCustomTypes,
  useCreateCustomType,
} from '../useCustomTypes';
import type { CustomTypeResponse } from '@/types/customTypes';

vi.mock('@/services/customTypes');

let queryClient: QueryClient;

function wrapper({ children }: { children: ReactNode }) {
  return createElement(QueryClientProvider, { client: queryClient }, children);
}

beforeEach(() => {
  vi.clearAllMocks();
  queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
});

const recipe: CustomTypeResponse = {
  id: 'ct-1',
  site_id: 'site-1',
  key: 'recipe',
  name: 'Recipe',
  retention_days: null,
  is_publicly_readable: true,
  content_kind: 'page',
  schema_version: 1,
  fields: [
    {
      id: 'f-1',
      key: 'title',
      label: 'Title',
      labels: null,
      field_type: 'text',
      required: true,
      localized: false,
      is_title: true,
      is_pii: false,
      data_category: null,
      processing_purpose: null,
      legal_basis: null,
      enum_options: null,
      min: null,
      max: null,
      min_length: null,
      max_length: null,
      pattern: null,
      is_unique: false,
      display_order: 0,
      deprecated_at: null,
    },
  ],
  created_at: '2026-01-01T00:00:00Z',
  updated_at: '2026-01-01T00:00:00Z',
};

describe('useCustomType (tracer)', () => {
  it('returns a typed schema with field metadata', async () => {
    vi.mocked(service.getCustomType).mockResolvedValue(recipe);

    const { result } = renderHook(() => useCustomType('site-1', 'recipe'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(service.getCustomType).toHaveBeenCalledWith('site-1', 'recipe');
    const data = result.current.data!;
    expect(data.key).toBe('recipe');
    expect(data.content_kind).toBe('page');
    expect(data.fields[0]?.field_type).toBe('text');
    expect(data.fields[0]?.is_title).toBe(true);
  });

  it('is disabled until both siteId and key are present', () => {
    const { result } = renderHook(() => useCustomType(null, null), { wrapper });
    expect(result.current.fetchStatus).toBe('idle');
    expect(service.getCustomType).not.toHaveBeenCalled();
  });
});

describe('useCustomTypes', () => {
  it('returns an empty list', async () => {
    vi.mocked(service.listCustomTypes).mockResolvedValue([]);
    const { result } = renderHook(() => useCustomTypes('site-1'), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([]);
  });
});

describe('useCreateCustomType', () => {
  it('invalidates the type list on success', async () => {
    vi.mocked(service.createCustomType).mockResolvedValue(recipe);
    const spy = vi.spyOn(queryClient, 'invalidateQueries');

    const { result } = renderHook(() => useCreateCustomType('site-1'), { wrapper });
    result.current.mutate({ key: 'recipe', name: 'Recipe', fields: [] });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(spy).toHaveBeenCalledWith({ queryKey: ['custom-types', 'site-1'] });
  });
});
