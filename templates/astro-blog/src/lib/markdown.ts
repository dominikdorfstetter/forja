import { marked } from "marked";

marked.setOptions({
  gfm: true,
  breaks: true,
});

/** Convert markdown string to HTML. Returns empty string for falsy input. */
export function renderMarkdown(md: string | null | undefined): string {
  if (!md) return "";
  return marked.parse(md, { async: false }) as string;
}
