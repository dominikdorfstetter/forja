import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios, { AxiosError } from 'axios';

// The global test setup mocks `@/services/http` so consumer tests can mock
// per-resource modules cleanly. This test exercises the real transport.
vi.unmock('@/services/http');
vi.unmock('../http');

vi.mock('axios');
vi.mock('../apiKeyStorage', () => ({
  migrateApiKeyStorage: vi.fn(),
  getApiKey: vi.fn(),
}));

describe('http transport', () => {
  type RequestHandler = (
    config: Record<string, unknown> & { headers: Record<string, string> },
  ) => Promise<Record<string, unknown>>;
  let capturedRequest: RequestHandler | null = null;
  let mockAxiosInstance: { request: ReturnType<typeof vi.fn>; interceptors: { request: { use: ReturnType<typeof vi.fn> }; response: { use: ReturnType<typeof vi.fn> } } };

  beforeEach(async () => {
    vi.resetModules();
    capturedRequest = null;

    mockAxiosInstance = {
      request: vi.fn(),
      interceptors: {
        request: {
          use: vi.fn((handler: RequestHandler) => {
            capturedRequest = handler;
          }),
        },
        response: { use: vi.fn() },
      },
    };

    const create = vi.fn(() => mockAxiosInstance);
    (axios as unknown as { create: typeof create }).create = create;
    (axios as unknown as { isAxiosError: typeof axios.isAxiosError }).isAxiosError =
      ((value: unknown): value is AxiosError =>
        typeof value === 'object' && value !== null && 'isAxiosError' in value) as typeof axios.isAxiosError;
  });

  it('uses Clerk bearer token when getter is set and returns a token', async () => {
    const { setClerkTokenGetter } = await import('../http');
    setClerkTokenGetter(() => Promise.resolve('clerk-jwt-abc'));

    const config = { headers: {} as Record<string, string> };
    await capturedRequest!(config);

    expect(config.headers['Authorization']).toBe('Bearer clerk-jwt-abc');
    expect(config.headers['X-API-Key']).toBeUndefined();
  });

  it('falls back to API key when Clerk getter throws', async () => {
    const { setClerkTokenGetter } = await import('../http');
    const { getApiKey } = await import('../apiKeyStorage');
    vi.mocked(getApiKey).mockReturnValue('dk_test_xyz');

    setClerkTokenGetter(() => Promise.reject(new Error('clerk down')));

    const config = { headers: {} as Record<string, string> };
    await capturedRequest!(config);

    expect(config.headers['Authorization']).toBeUndefined();
    expect(config.headers['X-API-Key']).toBe('dk_test_xyz');
  });

  it('maps an axios error response body into the thrown value', async () => {
    await import('../http');
    const { apiRequest } = await import('../http');

    const errorBody = { error: 'Validation', message: 'bad input' };
    const axiosError = Object.assign(new Error('boom'), {
      isAxiosError: true,
      response: { data: errorBody, status: 400 },
    });
    mockAxiosInstance.request.mockRejectedValueOnce(axiosError);

    await expect(apiRequest('POST', '/blogs', { slug: '' })).rejects.toEqual(errorBody);
  });

  it('returns response.data on success', async () => {
    const { apiRequest } = await import('../http');
    mockAxiosInstance.request.mockResolvedValueOnce({ data: { id: 'site-1' } });

    const result = await apiRequest<{ id: string }>('GET', '/sites/site-1');

    expect(result).toEqual({ id: 'site-1' });
    expect(mockAxiosInstance.request).toHaveBeenCalledWith(
      expect.objectContaining({ method: 'GET', url: '/sites/site-1' }),
    );
  });
});
