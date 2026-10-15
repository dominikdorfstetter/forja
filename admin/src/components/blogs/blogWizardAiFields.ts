export type AiPhase = 'idea' | 'outline' | 'post';
export type OutlineItem = { id: number; value: string };
export type RegenerateField = 'body' | 'excerpt' | 'seo' | 'all';
export type RegenerableSection = Exclude<RegenerateField, 'all'>;

/** Field max lengths aligned with backend validation */
export const MAX = {
  title: 500,
  subtitle: 500,
  excerpt: 300,
  body: 200_000,
  metaTitle: 60,
  metaDescription: 160,
} as const;

export function charCounter(value: string, max: number) {
  const len = value.length;
  const ratio = len / max;
  return {
    text: `${len} / ${max}`,
    color: ratio > 0.9 ? 'error.main' : 'text.secondary',
  };
}

/**
 * Whether a post-phase section is read-only. While the wizard is busy every
 * section locks, except that regenerating one specific section leaves the
 * other sections editable.
 */
export function isAiSectionLocked(
  section: RegenerableSection,
  busy: boolean,
  regeneratingField: RegenerateField | null,
): boolean {
  return busy && (regeneratingField === null || regeneratingField === 'all' || regeneratingField === section);
}
