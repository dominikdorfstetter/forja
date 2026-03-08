import { describe, it, expect, vi, beforeEach, afterEach, type Mock } from 'vitest';

let fetchMock: Mock;
let originalPushState: typeof history.pushState;
let originalReplaceState: typeof history.replaceState;

beforeEach(() => {
  vi.resetModules();
  vi.restoreAllMocks();

  fetchMock = vi.fn().mockResolvedValue(new Response());
  vi.stubGlobal('fetch', fetchMock);

  // Save the real history methods before each test
  originalPushState = history.pushState.bind(history);
  originalReplaceState = history.replaceState.bind(history);

  Object.defineProperty(navigator, 'webdriver', {
    value: false,
    configurable: true,
  });

  Object.defineProperty(document, 'referrer', {
    value: '',
    configurable: true,
  });
});

afterEach(() => {
  // Restore original history methods to prevent cross-test pollution
  history.pushState = originalPushState;
  history.replaceState = originalReplaceState;
});

const testConfig = {
  siteId: 'site-123',
  apiKey: 'key-456',
  endpoint: 'https://api.example.com/api/v1',
};

describe('init', () => {
  it('stores config and does not log when debug is off', async () => {
    const consoleSpy = vi.spyOn(console, 'log');
    const { init, trackPageview } = await import('../index');

    init({ ...testConfig });

    // Verify config was stored by confirming trackPageview works (no warn)
    const warnSpy = vi.spyOn(console, 'warn');
    trackPageview('/test');
    expect(warnSpy).not.toHaveBeenCalled();

    // No debug log
    expect(consoleSpy).not.toHaveBeenCalled();
  });

  it('logs when debug mode is enabled', async () => {
    const consoleSpy = vi.spyOn(console, 'log');
    const { init } = await import('../index');

    init({ ...testConfig, debug: true });

    expect(consoleSpy).toHaveBeenCalledWith(
      '[forja-analytics]',
      'Initialized',
      { siteId: testConfig.siteId, endpoint: testConfig.endpoint },
    );
  });
});

describe('trackPageview', () => {
  it('warns and returns early when not initialized', async () => {
    const warnSpy = vi.spyOn(console, 'warn');
    const { trackPageview } = await import('../index');

    trackPageview();

    expect(warnSpy).toHaveBeenCalledWith(
      '[forja-analytics] Not initialized. Call init() first.',
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('returns early when window is undefined', async () => {
    const { init, trackPageview } = await import('../index');
    init({ ...testConfig });

    const savedWindow = globalThis.window;
    // @ts-expect-error -- simulating non-browser environment
    delete globalThis.window;

    trackPageview();

    expect(fetchMock).not.toHaveBeenCalled();

    globalThis.window = savedWindow;
  });

  it('returns early when navigator.webdriver is true', async () => {
    Object.defineProperty(navigator, 'webdriver', {
      value: true,
      configurable: true,
    });

    const { init, trackPageview } = await import('../index');
    init({ ...testConfig });

    trackPageview();

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('uses window.location.pathname when no path is given', async () => {
    const { init, trackPageview } = await import('../index');
    init({ ...testConfig });

    trackPageview();

    expect(fetchMock).toHaveBeenCalledWith(
      `${testConfig.endpoint}/sites/${testConfig.siteId}/analytics/pageview`,
      expect.objectContaining({
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-API-Key': testConfig.apiKey,
        },
        body: JSON.stringify({
          path: window.location.pathname,
          referrer: undefined,
        }),
        keepalive: true,
      }),
    );
  });

  it('uses the provided custom path', async () => {
    const { init, trackPageview } = await import('../index');
    init({ ...testConfig });

    trackPageview('/custom-page');

    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: JSON.stringify({
          path: '/custom-page',
          referrer: undefined,
        }),
      }),
    );
  });

  it('sends document.referrer when present', async () => {
    Object.defineProperty(document, 'referrer', {
      value: 'https://google.com',
      configurable: true,
    });

    const { init, trackPageview } = await import('../index');
    init({ ...testConfig });

    trackPageview('/page');

    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: JSON.stringify({
          path: '/page',
          referrer: 'https://google.com',
        }),
      }),
    );
  });

  it('sends undefined for referrer when document.referrer is empty', async () => {
    Object.defineProperty(document, 'referrer', {
      value: '',
      configurable: true,
    });

    const { init, trackPageview } = await import('../index');
    init({ ...testConfig });

    trackPageview('/page');

    expect(fetchMock).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: JSON.stringify({
          path: '/page',
          referrer: undefined,
        }),
      }),
    );
  });

  it('sends fetch with correct URL, headers, body, and keepalive', async () => {
    const { init, trackPageview } = await import('../index');
    init({ ...testConfig });

    trackPageview('/check');

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, options] = fetchMock.mock.calls[0];
    expect(url).toBe(
      'https://api.example.com/api/v1/sites/site-123/analytics/pageview',
    );
    expect(options.method).toBe('POST');
    expect(options.headers).toEqual({
      'Content-Type': 'application/json',
      'X-API-Key': 'key-456',
    });
    expect(options.keepalive).toBe(true);
    expect(JSON.parse(options.body)).toEqual({
      path: '/check',
    });
  });

  it('logs when debug mode is enabled', async () => {
    const consoleSpy = vi.spyOn(console, 'log');
    const { init, trackPageview } = await import('../index');
    init({ ...testConfig, debug: true });

    consoleSpy.mockClear();
    trackPageview('/debug-page');

    expect(consoleSpy).toHaveBeenCalledWith(
      '[forja-analytics]',
      'Tracking pageview',
      expect.objectContaining({ path: '/debug-page' }),
    );
  });

  it('silently catches fetch errors', async () => {
    fetchMock.mockRejectedValueOnce(new Error('Network error'));

    const { init, trackPageview } = await import('../index');
    init({ ...testConfig });

    // Should not throw
    trackPageview('/error-page');

    // Wait for the promise rejection to be caught
    await vi.waitFor(() => {
      expect(fetchMock).toHaveBeenCalledOnce();
    });
  });
});

describe('autoTrack', () => {
  it('returns noop cleanup when window is undefined', async () => {
    const { autoTrack } = await import('../index');

    const savedWindow = globalThis.window;
    // @ts-expect-error -- simulating non-browser environment
    delete globalThis.window;

    const cleanup = autoTrack();

    expect(typeof cleanup).toBe('function');
    expect(fetchMock).not.toHaveBeenCalled();

    // Noop cleanup should not throw
    cleanup();

    globalThis.window = savedWindow;
  });

  it('tracks initial pageview on call', async () => {
    const { init, autoTrack } = await import('../index');
    init({ ...testConfig });

    const cleanup = autoTrack();

    expect(fetchMock).toHaveBeenCalledOnce();
    cleanup();
  });

  it('tracks on popstate event', async () => {
    const { init, autoTrack } = await import('../index');
    init({ ...testConfig });

    const cleanup = autoTrack();
    fetchMock.mockClear();

    window.dispatchEvent(new Event('popstate'));

    expect(fetchMock).toHaveBeenCalledOnce();
    cleanup();
  });

  it('tracks on history.pushState', async () => {
    const { init, autoTrack } = await import('../index');
    init({ ...testConfig });

    const cleanup = autoTrack();
    fetchMock.mockClear();

    history.pushState({}, '', '/new-page');

    expect(fetchMock).toHaveBeenCalledOnce();
    cleanup();
  });

  it('tracks on history.replaceState', async () => {
    const { init, autoTrack } = await import('../index');
    init({ ...testConfig });

    const cleanup = autoTrack();
    fetchMock.mockClear();

    history.replaceState({}, '', '/replaced-page');

    expect(fetchMock).toHaveBeenCalledOnce();
    cleanup();
  });

  it('cleanup removes popstate listener', async () => {
    const { init, autoTrack } = await import('../index');
    init({ ...testConfig });

    const cleanup = autoTrack();
    cleanup();
    fetchMock.mockClear();

    window.dispatchEvent(new Event('popstate'));

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('cleanup restores original pushState and replaceState', async () => {
    const { init, autoTrack } = await import('../index');
    init({ ...testConfig });

    const cleanup = autoTrack();

    // After cleanup, pushState/replaceState should no longer trigger tracking
    cleanup();
    fetchMock.mockClear();

    history.pushState({}, '', '/after-cleanup');
    history.replaceState({}, '', '/after-cleanup-2');

    expect(fetchMock).not.toHaveBeenCalled();
  });
});
