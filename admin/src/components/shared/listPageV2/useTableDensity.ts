import { useContext } from 'react';
import { ThemeModeContext, type Density } from '@/theme/ThemeContext';

export interface TableDensity {
  /** Active density, defaulting to 'comfortable' when no ThemeModeProvider is present. */
  density: Density;
  /** MUI `<Table size>` prop driving cell padding. */
  size: 'small' | 'medium';
  /** Body row height in px, matching DataTableV2's density variants (40 compact / 52 comfortable). */
  rowHeight: number;
}

/**
 * Density signal for the hand-built drag-to-reorder tables (CV, Projects,
 * Navigation, Social Links) that can't use DataTableV2 because it has no row
 * reordering. Centralises the one density→size/height mapping so the four
 * tables stay consistent with DataTableV2 instead of each hardcoding
 * `size="small"`.
 *
 * Reads ThemeModeContext directly (not via useThemeMode, which throws) so it
 * tolerates a missing provider exactly like DataTableV2 — the four tables then
 * render in test harnesses that don't wrap with ThemeModeProvider.
 */
export function useTableDensity(): TableDensity {
  const ctx = useContext(ThemeModeContext);
  const density = ctx?.density ?? 'comfortable';
  return {
    density,
    size: density === 'compact' ? 'small' : 'medium',
    rowHeight: density === 'compact' ? 40 : 52,
  };
}
