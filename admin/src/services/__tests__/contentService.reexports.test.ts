import { describe, it, expect, beforeEach, vi } from 'vitest';

// The global test setup (src/test/setup.ts) auto-mocks the whole service
// modules. Un-mock them here so the REAL factory-backed implementations
// load, and mock only the http layer the factory calls through.
vi.unmock('@/services/blogs');
vi.unmock('@/services/cv');
vi.unmock('@/services/projects');
vi.unmock('@/services/legal');
vi.mock('@/services/http', () => ({ apiRequest: vi.fn() }));

import * as http from '@/services/http';
import { getBlogs, getBlogDetail } from '@/services/blogs';
import { getCvEntries, getCvEntryDetail } from '@/services/cv';
import { getProjects, getProject } from '@/services/projects';
import { getLegalDocuments, createLegalDocument } from '@/services/legal';

const apiRequest = vi.mocked(http.apiRequest);

describe('content service re-exports (factory-backed)', () => {
  beforeEach(() => {
    apiRequest.mockReset();
    apiRequest.mockResolvedValue(undefined as never);
  });

  it('getBlogs issues GET /sites/{siteId}/blogs', async () => {
    await getBlogs('site-1');
    expect(apiRequest).toHaveBeenCalledWith('GET', '/sites/site-1/blogs', undefined, {
      params: undefined,
    });
  });

  it('getBlogDetail issues GET /blogs/{id}/detail', async () => {
    await getBlogDetail('b1');
    expect(apiRequest).toHaveBeenCalledWith('GET', '/blogs/b1/detail');
  });

  it('getCvEntries issues GET /sites/{siteId}/cv', async () => {
    await getCvEntries('site-1', { entry_type: 'Work' });
    expect(apiRequest).toHaveBeenCalledWith('GET', '/sites/site-1/cv', undefined, {
      params: { entry_type: 'Work' },
    });
  });

  // Lockstep with ADR 0003: the detail re-point moves cv off the bare route.
  it('getCvEntryDetail now issues GET /cv/{id}/detail', async () => {
    await getCvEntryDetail('e1');
    expect(apiRequest).toHaveBeenCalledWith('GET', '/cv/e1/detail');
  });

  it('getProjects issues GET /sites/{siteId}/projects', async () => {
    await getProjects('site-1');
    expect(apiRequest).toHaveBeenCalledWith('GET', '/sites/site-1/projects', undefined, {
      params: undefined,
    });
  });

  // Lockstep with ADR 0003: getProject re-points to /detail so it keeps
  // returning the full relational graph after the bare route went light.
  it('getProject now issues GET /projects/{id}/detail', async () => {
    await getProject('p1');
    expect(apiRequest).toHaveBeenCalledWith('GET', '/projects/p1/detail');
  });

  it('getLegalDocuments issues GET /sites/{siteId}/legal', async () => {
    await getLegalDocuments('site-1');
    expect(apiRequest).toHaveBeenCalledWith('GET', '/sites/site-1/legal', undefined, {
      params: undefined,
    });
  });

  // Legal keeps its divergent, site-scoped create path (not the factory's).
  it('createLegalDocument keeps its site-scoped POST path', async () => {
    await createLegalDocument('site-1', { document_type: 'privacy' } as never);
    expect(apiRequest).toHaveBeenCalledWith('POST', '/sites/site-1/legal', {
      document_type: 'privacy',
    });
  });
});
