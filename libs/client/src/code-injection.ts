import type { CodeInjection } from './types.js';

/**
 * Render code injection as HTML strings ready for embedding.
 *
 * Returns `{ head, footer }` where each is safe to insert via
 * `set:html` in Astro or innerHTML in a trusted template context.
 *
 * **Important:** Code injection values come from the site's admin
 * settings and are considered trusted (admin-authored) content.
 *
 * This is deliberately a thin pass-through to provide a clear API
 * surface and a single place to add sanitization later.
 *
 * @example
 * ```astro
 * ---
 * const injection = await forja.site.getCodeInjection();
 * const { head, footer } = renderCodeInjection(injection);
 * ---
 * <head>
 *   <Fragment set:html={head} />
 * </head>
 * <body>
 *   <!-- page content -->
 *   <Fragment set:html={footer} />
 * </body>
 * ```
 */
export function renderCodeInjection(injection: CodeInjection): { head: string; footer: string } {
  return {
    head: injection.code_injection_head,
    footer: injection.code_injection_footer,
  };
}
