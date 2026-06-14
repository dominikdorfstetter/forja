import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import { ThemeModeContext, type ThemeModeContextValue, type Density } from '@/theme/ThemeContext';
import { useTableDensity } from '../useTableDensity';

/** Minimal ThemeModeContext value — the hook only reads `density`. */
function ctx(density: Density): ThemeModeContextValue {
  return {
    themeId: 'system',
    setThemeId: () => {},
    resolvedFlavor: 'latte',
    options: [],
    accent: 'violet',
    setAccent: () => {},
    density,
    setDensity: () => {},
  };
}

function wrapper(density: Density) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return <ThemeModeContext.Provider value={ctx(density)}>{children}</ThemeModeContext.Provider>;
  };
}

describe('useTableDensity', () => {
  it('defaults to the comfortable (medium / 52px) variant when no ThemeModeProvider is present', () => {
    // Mirrors DataTableV2's null-tolerant read so the sortable tables still
    // render in lightweight test harnesses that omit ThemeModeProvider.
    const { result } = renderHook(() => useTableDensity());
    expect(result.current).toEqual({ density: 'comfortable', size: 'medium', rowHeight: 52 });
  });

  it('maps comfortable density to the taller medium variant (matches DataTableV2 52px)', () => {
    const { result } = renderHook(() => useTableDensity(), { wrapper: wrapper('comfortable') });
    expect(result.current).toEqual({ density: 'comfortable', size: 'medium', rowHeight: 52 });
  });

  it('maps compact density to the shorter small variant (matches DataTableV2 40px)', () => {
    const { result } = renderHook(() => useTableDensity(), { wrapper: wrapper('compact') });
    expect(result.current).toEqual({ density: 'compact', size: 'small', rowHeight: 40 });
  });
});
