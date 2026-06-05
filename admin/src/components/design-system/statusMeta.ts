/**
 * Shared status metadata. StatusPill, dashboard focus cards, and row chips
 * all pull their colours and labels from this single map so the visual
 * language stays consistent across surfaces.
 *
 * Each status maps to CSS custom properties driven by buildTokenCss, so
 * the palette auto-adapts per flavor — on Catppuccin light flavors the
 * on-container foreground darkens below the container tint to clear
 * WCAG AA, and dark flavors keep the saturated accent-on-tint pairing.
 * Hardcoded hex values used to live here (tuned only for M3 Expressive
 * Dark) and produced green-on-green / orange-on-orange pills under Latte,
 * Dawn, and Nord.
 */

export type ContentStatus = 'Draft' | 'InReview' | 'Scheduled' | 'Published' | 'Archived';

export interface StatusMeta {
  label: string;
  dot: string;
  bg: string;
  color: string;
}

export const STATUS_META: Record<ContentStatus, StatusMeta> = {
  Draft: {
    label: 'Draft',
    dot: 'var(--on-surface-variant)',
    bg: 'color-mix(in oklch, var(--on-surface-variant) 16%, transparent)',
    color: 'var(--on-surface-variant)',
  },
  InReview: {
    label: 'In review',
    dot: 'var(--on-warn-container)',
    bg: 'var(--warn-container)',
    color: 'var(--on-warn-container)',
  },
  Scheduled: {
    label: 'Scheduled',
    dot: 'var(--info)',
    bg: 'color-mix(in oklch, var(--info) 18%, transparent)',
    color: 'var(--info)',
  },
  Published: {
    label: 'Published',
    dot: 'var(--on-tertiary-container)',
    bg: 'var(--tertiary-container)',
    color: 'var(--on-tertiary-container)',
  },
  Archived: {
    label: 'Archived',
    dot: 'var(--on-surface-variant)',
    bg: 'color-mix(in oklch, var(--on-surface-variant) 14%, transparent)',
    color: 'var(--on-surface-variant)',
  },
};
