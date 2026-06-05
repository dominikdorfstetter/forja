import {
  inject,
  InjectionToken,
  makeEnvironmentProviders,
  type EnvironmentProviders,
} from '@angular/core';
import { ForjaClient } from '../client.js';
import type { ForjaClientConfig } from '../types.js';

/**
 * Angular injection token for the {@link ForjaClient} instance.
 *
 * You don't need to use this directly — use {@link provideForja} and
 * {@link injectForja} instead.
 */
export const FORJA_CLIENT = new InjectionToken<ForjaClient>('ForjaClient');

/**
 * Provide the Forja SDK client to Angular's dependency injection system.
 *
 * Call this in your application's `providers` array (typically in `app.config.ts`)
 * to make the {@link ForjaClient} available via {@link injectForja}.
 *
 * @param config - API connection settings.
 * @param config.baseUrl - Full URL to the Forja API (e.g. `https://cms.example.com/api/v1`).
 * @param config.apiKey - API key with at least `Read` permission.
 * @param config.siteId - UUID of the site to query.
 * @returns Angular environment providers to include in your app config.
 *
 * @example
 * ```typescript
 * // app.config.ts
 * import { provideForja } from '@forjacms/client/angular';
 *
 * export const appConfig: ApplicationConfig = {
 *   providers: [
 *     provideForja({
 *       baseUrl: environment.cmsApiUrl,
 *       apiKey: environment.cmsApiKey,
 *       siteId: environment.cmsSiteId,
 *     }),
 *   ],
 * };
 * ```
 */
export function provideForja(config: ForjaClientConfig): EnvironmentProviders {
  return makeEnvironmentProviders([
    { provide: FORJA_CLIENT, useFactory: () => new ForjaClient(config) },
  ]);
}

/**
 * Inject the {@link ForjaClient} instance from Angular's DI system.
 *
 * Must be called in an injection context (component constructor, `inject()` call,
 * or factory function). Requires {@link provideForja} to be configured in the
 * application's providers.
 *
 * @returns The configured {@link ForjaClient} instance.
 * @throws If called outside an injection context or without {@link provideForja}.
 *
 * @example
 * ```typescript
 * import { Component } from '@angular/core';
 * import { injectForja, forjaResource } from '@forjacms/client/angular';
 *
 * @Component({
 *   template: `
 *     @if (blogs.isLoading()) { <p>Loading...</p> }
 *     @for (blog of blogs.value()?.data ?? []; track blog.id) {
 *       <p>{{ blog.slug }}</p>
 *     }
 *   `,
 * })
 * export class BlogListComponent {
 *   private forja = injectForja();
 *   blogs = forjaResource(() => this.forja.blogs.listPublished({ page: 1 }));
 * }
 * ```
 */
export function injectForja(): ForjaClient {
  return inject(FORJA_CLIENT);
}
