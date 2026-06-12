import { describe, expect, it, vi } from 'vitest';

/**
 * Guard: every module under src/services must be globally mocked in
 * test/setup.ts, and the mock must cover every function the real module
 * exports. A service missing here means component tests silently hit the
 * network (or crash on undefined) unless each test re-mocks it locally.
 */
const serviceModules = import.meta.glob('../services/*.ts');

/**
 * Intentionally unmocked: pure browser-storage utilities with no network
 * I/O, covered by their own unit tests against the real implementation
 * (services/__tests__/). Add a module here only if it performs no requests.
 */
const UNMOCKED_ALLOWLIST = new Set(['../services/apiKeyStorage.ts']);

describe('global service mocks (test/setup.ts)', () => {
  it('mocks every function export of every service module', async () => {
    const paths = Object.keys(serviceModules).filter((p) => !UNMOCKED_ALLOWLIST.has(p));
    expect(paths.length).toBeGreaterThan(0);

    const gaps: string[] = [];
    for (const path of paths) {
      const mocked = (await serviceModules[path]()) as Record<string, unknown>;
      const actual = (await vi.importActual(path)) as Record<string, unknown>;

      const functionExports = Object.entries(actual)
        .filter(([, value]) => typeof value === 'function')
        .map(([name]) => name);

      for (const name of functionExports) {
        if (!vi.isMockFunction(mocked[name])) {
          gaps.push(`${path} → ${name}`);
        }
      }
    }

    expect(gaps, 'unmocked service functions').toEqual([]);
  });
});
