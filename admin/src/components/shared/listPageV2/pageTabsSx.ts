/**
 * Canonical sx block for M3-styled page-level Tabs. Every list page that
 * renders a status / category tab bar (Blogs, Pages, Legal, Portfolio,
 * Media, Navigation) composes from this constant so tab height, indicator
 * stroke, label case, and the outline-variant divider under the bar stay
 * aligned across routes.
 *
 * Hoisted (not inlined per render) so emotion's cache stays warm across
 * route changes.
 */
export const pageTabsSx = {
  mb: 3,
  minHeight: 48,
  borderBottom: '1px solid var(--outline-variant)',
  '& .MuiTabs-indicator': {
    height: 3,
    borderRadius: '3px 3px 0 0',
    backgroundColor: 'var(--primary)',
  },
  '& .MuiTab-root': {
    textTransform: 'uppercase',
    fontSize: 12,
    fontWeight: 600,
    letterSpacing: 1,
    color: 'var(--on-surface-variant)',
    minHeight: 48,
    px: 2.5,
    gap: 0.75,
    fontVariationSettings: '"wght" 600, "opsz" 12',
    '&.Mui-selected': { color: 'var(--primary)' },
  },
} as const;
