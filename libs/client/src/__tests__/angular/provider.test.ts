import { describe, expect, it } from 'vitest';
import {
  Injector,
  createEnvironmentInjector,
  runInInjectionContext,
  type EnvironmentInjector,
} from '@angular/core';
import { FORJA_CLIENT, injectForja, provideForja } from '../../angular/provider.js';
import { ForjaClient } from '../../client.js';

describe('FORJA_CLIENT', () => {
  it('is an InjectionToken with description', () => {
    expect(FORJA_CLIENT).toBeDefined();
    expect(FORJA_CLIENT.toString()).toContain('ForjaClient');
  });
});

describe('provideForja', () => {
  it('returns an EnvironmentProviders object', () => {
    const result = provideForja({
      baseUrl: 'https://api.example.com/api/v1',
      apiKey: 'test-key',
      siteId: 'site-1',
    });

    // EnvironmentProviders has a ɵproviders brand property
    expect(result).toBeDefined();
    expect(typeof result).toBe('object');
  });

  it('factory builds a ForjaClient when the token is resolved through DI', () => {
    // Use the bare DI primitives (no zone.js / no TestBed) to exercise the
    // factory function provided by provideForja and the injectForja helper.
    const providers = provideForja({
      baseUrl: 'https://api.example.com/api/v1',
      apiKey: 'test-key',
      siteId: 'site-1',
    });
    // `createEnvironmentInjector` types the parent as `EnvironmentInjector`,
    // but Angular accepts any `Injector` at runtime — it only uses the
    // parent for lookup chaining. `Injector.NULL` gives us a null lookup
    // root without bootstrapping a full application. Cast is intentional.
    const injector = createEnvironmentInjector(
      [providers],
      Injector.NULL as unknown as EnvironmentInjector,
    );

    const client = runInInjectionContext(injector, () => injectForja());

    expect(client).toBeInstanceOf(ForjaClient);
  });
});
