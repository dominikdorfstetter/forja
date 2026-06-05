import { signal, type Signal } from '@angular/core';

/**
 * A reactive resource that wraps an async operation with Angular signals.
 *
 * Provides `value`, `isLoading`, and `error` signals for template binding,
 * plus a `reload()` method to re-execute the loader.
 *
 * @typeParam T - The type of the resolved value.
 */
export interface ForjaResource<T> {
  /** The resolved value, or `undefined` while loading or after an error. */
  readonly value: Signal<T | undefined>;
  /** `true` while the loader is executing. */
  readonly isLoading: Signal<boolean>;
  /** The error if the loader rejected, or `null` on success. */
  readonly error: Signal<Error | null>;
  /** Re-execute the loader, resetting `isLoading` and clearing `error`. */
  readonly reload: () => void;
}

/**
 * Create a signal-based resource from an async loader function.
 *
 * Immediately invokes the loader and exposes the result via Angular signals.
 * Use in Angular components to bind async SDK calls to templates without
 * manual subscribe/unsubscribe boilerplate.
 *
 * @typeParam T - The type returned by the loader promise.
 * @param loader - A function that returns a `Promise<T>`. Called immediately and on each `reload()`.
 * @returns A {@link ForjaResource} with reactive `value`, `isLoading`, and `error` signals.
 *
 * @example
 * ```typescript
 * import { Component } from '@angular/core';
 * import { injectForja, forjaResource } from '@forjacms/client/angular';
 *
 * @Component({
 *   template: `
 *     @if (blogs.isLoading()) {
 *       <p>Loading...</p>
 *     } @else if (blogs.error()) {
 *       <p>Error: {{ blogs.error()!.message }}</p>
 *     } @else {
 *       @for (blog of blogs.value()!.data; track blog.id) {
 *         <article>{{ blog.slug }}</article>
 *       }
 *     }
 *     <button (click)="blogs.reload()">Refresh</button>
 *   `,
 * })
 * export class BlogListComponent {
 *   private forja = injectForja();
 *   blogs = forjaResource(() => this.forja.blogs.listPublished({ page: 1 }));
 * }
 * ```
 *
 * @example
 * ```typescript
 * // Fetch a single resource
 * const blog = forjaResource(() => forja.blogs.getBySlug('my-post'));
 *
 * // Access in template
 * // blog.value()?.localizations[0]?.title
 * // blog.isLoading()
 * // blog.error()?.message
 * ```
 */
export function forjaResource<T>(loader: () => Promise<T>): ForjaResource<T> {
  const value = signal<T | undefined>(undefined);
  const isLoading = signal(true);
  const error = signal<Error | null>(null);

  const load = () => {
    isLoading.set(true);
    error.set(null);
    loader()
      .then((v) => value.set(v))
      .catch((e) => error.set(e instanceof Error ? e : new Error(String(e))))
      .finally(() => isLoading.set(false));
  };

  load();

  return {
    value: value.asReadonly(),
    isLoading: isLoading.asReadonly(),
    error: error.asReadonly(),
    reload: load,
  };
}
