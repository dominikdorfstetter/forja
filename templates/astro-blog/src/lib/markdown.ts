import { marked } from "marked";
import sanitizeHtml, { type IOptions } from "sanitize-html";

marked.setOptions({
  gfm: true,
  breaks: true,
});

const SANITIZE_CONFIG: IOptions = {
  allowedTags: [
    ...sanitizeHtml.defaults.allowedTags,
    "img",
    "figure",
    "figcaption",
  ],
  allowedAttributes: {
    ...sanitizeHtml.defaults.allowedAttributes,
    img: ["src", "alt", "title", "width", "height", "loading"],
    a: ["href", "title", "name", "target", "rel"],
    code: ["class"],
    span: ["class"],
    div: ["class"],
  },
  allowedSchemes: ["http", "https", "mailto"],
  allowedSchemesAppliedToAttributes: ["href", "src", "cite"],
  allowProtocolRelative: false,
  // Defense-in-depth for GHSA-rpr9-rxv7-x643: pin the discard-contents list so
  // raw-text elements (xmp, textarea, etc.) can never smuggle live markup
  // back into output, even if the upstream default regresses.
  nonTextTags: ["script", "style", "textarea", "option", "xmp"],
};

/** Convert markdown string to sanitized HTML. Returns empty string for falsy input. */
export function renderMarkdown(md: string | null | undefined): string {
  if (!md) return "";
  const html = marked.parse(md, { async: false }) as string;
  return sanitizeHtml(html, SANITIZE_CONFIG);
}
