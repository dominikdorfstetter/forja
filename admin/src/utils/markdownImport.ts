export interface MarkdownParseResult {
  title: string;
  body: string;
  excerpt: string;
  slug: string;
  meta_title: string;
}

const MAX_TITLE_LENGTH = 500;
const MAX_BODY_LENGTH = 200_000;
const MAX_EXCERPT_LENGTH = 200;
const MAX_META_TITLE_LENGTH = 200;
const MAX_SLUG_LENGTH = 80;

/**
 * Validates a File object before reading its content.
 * Returns an i18n error key or null if valid.
 */
export function validateMarkdownFile(file: File): string | null {
  const name = file.name.toLowerCase();
  if (!name.endsWith('.md') && !name.endsWith('.markdown')) {
    return 'markdownImport.errors.invalidExtension';
  }
  if (file.size === 0) {
    return 'markdownImport.errors.emptyFile';
  }
  return null;
}

/**
 * Converts text to a URL-friendly slug.
 */
export function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // strip diacritics
    .replace(/[^\w\s-]/g, '')        // strip non-word chars
    .replace(/[\s_]+/g, '-')         // spaces/underscores → hyphens
    .replace(/-+/g, '-')             // collapse consecutive hyphens
    .replace(/^-|-$/g, '')           // trim leading/trailing hyphens
    .slice(0, MAX_SLUG_LENGTH);
}

/**
 * Parses markdown content and extracts structured data.
 * Returns parsed result or an i18n error key.
 */
export function parseMarkdown(content: string): { result?: MarkdownParseResult; error?: string } {
  // Strip BOM
  let text = content.replace(/^\uFEFF/, '');

  // Strip optional YAML frontmatter
  text = text.replace(/^---\r?\n[\s\S]*?\r?\n---\r?\n?/, '');

  // Find H1 headings
  const h1Regex = /^# (.+)$/gm;
  const h1Matches = [...text.matchAll(h1Regex)];

  if (h1Matches.length === 0) {
    return { error: 'markdownImport.errors.noH1' };
  }
  if (h1Matches.length > 1) {
    return { error: 'markdownImport.errors.multipleH1' };
  }

  const title = h1Matches[0][1].trim();

  if (title.length > MAX_TITLE_LENGTH) {
    return { error: 'markdownImport.errors.titleTooLong' };
  }

  // Body is everything except the H1 line
  const body = text
    .replace(/^# .+$/m, '')
    .replace(/^\n+/, '')
    .trimEnd();

  if (body.length > MAX_BODY_LENGTH) {
    return { error: 'markdownImport.errors.bodyTooLong' };
  }

  // Extract excerpt: first non-empty, non-heading paragraph line
  const lines = body.split('\n');
  let excerpt = '';
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed && !trimmed.startsWith('#')) {
      excerpt = trimmed.slice(0, MAX_EXCERPT_LENGTH);
      break;
    }
  }

  const slug = slugify(title) + '-' + Date.now();
  const meta_title = title.slice(0, MAX_META_TITLE_LENGTH);

  return {
    result: { title, body, excerpt, slug, meta_title },
  };
}
