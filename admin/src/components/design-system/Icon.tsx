import type { CSSProperties } from 'react';

export interface IconProps {
  name: string;
  size?: number;
  filled?: boolean;
  color?: string;
  style?: CSSProperties;
  ariaLabel?: string;
}

/**
 * Material Symbols Rounded wrapper. `filled` toggles the FILL axis (0 ↔ 1).
 * When no aria-label is provided the icon is presented as decorative
 * (`aria-hidden`) so screen readers don't announce the ligature text.
 */
export function Icon({ name, size = 20, filled = false, color, style, ariaLabel }: IconProps) {
  const fontVariationSettings = filled
    ? "'FILL' 1, 'wght' 400, 'GRAD' 0, 'opsz' 24"
    : "'FILL' 0, 'wght' 400, 'GRAD' 0, 'opsz' 24";

  return (
    <span
      className="material-symbols-rounded"
      aria-label={ariaLabel}
      aria-hidden={ariaLabel ? undefined : true}
      role={ariaLabel ? 'img' : undefined}
      style={{
        fontFamily: "'Material Symbols Rounded'",
        fontVariationSettings,
        fontSize: size,
        color: color || 'inherit',
        lineHeight: 1,
        display: 'inline-block',
        userSelect: 'none',
        ...style,
      }}
    >
      {name}
    </span>
  );
}
