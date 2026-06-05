import sanitizeHtmlLib, { type IOptions } from 'sanitize-html';

/**
 * Allowlist mirrored from `templates/astro-blog/src/lib/markdown.ts` so the
 * shipped components are safe-by-default rather than relying on every consumer
 * to sanitize the pre-rendered HTML they bind to section props.
 */
const SANITIZE_CONFIG: IOptions = {
  allowedTags: [...sanitizeHtmlLib.defaults.allowedTags, 'img', 'figure', 'figcaption'],
  allowedAttributes: {
    ...sanitizeHtmlLib.defaults.allowedAttributes,
    img: ['src', 'alt', 'title', 'width', 'height', 'loading'],
    a: ['href', 'title', 'name', 'target', 'rel'],
    code: ['class'],
    span: ['class'],
    div: ['class'],
  },
  allowedSchemes: ['http', 'https', 'mailto'],
  allowedSchemesAppliedToAttributes: ['href', 'src', 'cite'],
  allowProtocolRelative: false,
  // Defense-in-depth for GHSA-rpr9-rxv7-x643: pin the discard-contents list so
  // raw-text elements (xmp, textarea, etc.) can never smuggle live markup back
  // into output, even if the upstream default regresses.
  nonTextTags: ['script', 'style', 'textarea', 'option', 'xmp'],
};

/**
 * Sanitize pre-rendered HTML before it is written to the DOM via `innerHTML`.
 * Strips scripts, event handlers, and dangerous URL schemes while preserving
 * benign rich text (headings, lists, links, images). Returns `''` for falsy
 * input.
 */
export function sanitizeHtml(html: string | null | undefined): string {
  if (!html) return '';
  return sanitizeHtmlLib(html, SANITIZE_CONFIG);
}
