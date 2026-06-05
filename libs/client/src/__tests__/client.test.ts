import { describe, expect, it } from 'vitest';
import { ForjaClient } from '../client.js';

describe('ForjaClient', () => {
  it('exposes all resource accessors', () => {
    const client = new ForjaClient({
      baseUrl: 'https://api.example.com/api/v1',
      apiKey: 'test-key',
      siteId: 'site-1',
    });

    expect(client.blogs).toBeDefined();
    expect(client.pages).toBeDefined();
    expect(client.navigation).toBeDefined();
    expect(client.taxonomy).toBeDefined();
    expect(client.analytics).toBeDefined();
    expect(client.cv).toBeDefined();
    expect(client.legal).toBeDefined();
    expect(client.site).toBeDefined();
    expect(client.media).toBeDefined();
    expect(client.social).toBeDefined();
  });

  it('accepts custom fetch implementation', () => {
    const customFetch = async () => new Response('{}');

    // Should not throw
    const client = new ForjaClient({
      baseUrl: 'https://api.example.com/api/v1',
      apiKey: 'test-key',
      siteId: 'site-1',
      fetch: customFetch,
    });

    expect(client).toBeDefined();
  });
});
