import { describe, it, expect, beforeEach, vi } from 'vitest';

import * as http from '../http';
import { createContentService } from '../contentService';

// The global setup mocks the factory module; this file tests the REAL one.
vi.unmock('../contentService');
vi.mock('../http', () => ({ apiRequest: vi.fn() }));

const apiRequest = vi.mocked(http.apiRequest);

describe('createContentService', () => {
  beforeEach(() => {
    apiRequest.mockReset();
    apiRequest.mockResolvedValue(undefined as never);
  });

  const svc = createContentService({ base: 'blogs' });

  it('list issues GET /sites/{siteId}/{base} with params in config', async () => {
    await svc.list('site-1', { page: 1 });
    expect(apiRequest).toHaveBeenCalledWith('GET', '/sites/site-1/blogs', undefined, {
      params: { page: 1 },
    });
  });

  it('detail issues GET /{base}/{id}/detail', async () => {
    await svc.detail('b1');
    expect(apiRequest).toHaveBeenCalledWith('GET', '/blogs/b1/detail');
  });

  it('create issues POST /{base}', async () => {
    await svc.create({ slug: 'x' } as never);
    expect(apiRequest).toHaveBeenCalledWith('POST', '/blogs', { slug: 'x' });
  });

  it('update issues PUT /{base}/{id}', async () => {
    await svc.update('b1', { slug: 'y' } as never);
    expect(apiRequest).toHaveBeenCalledWith('PUT', '/blogs/b1', { slug: 'y' });
  });

  it('remove issues DELETE /{base}/{id}', async () => {
    await svc.remove('b1');
    expect(apiRequest).toHaveBeenCalledWith('DELETE', '/blogs/b1');
  });

  it('bulk issues POST /sites/{siteId}/{base}/bulk', async () => {
    await svc.bulk('site-1', { ids: ['b1'], action: 'publish' } as never);
    expect(apiRequest).toHaveBeenCalledWith('POST', '/sites/site-1/blogs/bulk', {
      ids: ['b1'],
      action: 'publish',
    });
  });

  it('review issues POST /{base}/{id}/review', async () => {
    await svc.review('b1', { action: 'approve' } as never);
    expect(apiRequest).toHaveBeenCalledWith('POST', '/blogs/b1/review', { action: 'approve' });
  });

  it('localization methods hit the conventional routes', async () => {
    await svc.getLocalizations('b1');
    expect(apiRequest).toHaveBeenCalledWith('GET', '/blogs/b1/localizations');

    await svc.createLocalization('b1', { locale_id: 'l1' } as never);
    expect(apiRequest).toHaveBeenCalledWith('POST', '/blogs/b1/localizations', {
      locale_id: 'l1',
    });

    await svc.updateLocalization('loc1', { title: 't' } as never);
    expect(apiRequest).toHaveBeenCalledWith('PUT', '/blogs/localizations/loc1', { title: 't' });

    await svc.deleteLocalization('loc1');
    expect(apiRequest).toHaveBeenCalledWith('DELETE', '/blogs/localizations/loc1');
  });

  it('threads the base segment through every route', async () => {
    const legal = createContentService({ base: 'legal' });
    await legal.detail('d1');
    expect(apiRequest).toHaveBeenCalledWith('GET', '/legal/d1/detail');
  });
});
