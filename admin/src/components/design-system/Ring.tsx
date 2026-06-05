export interface RingProps {
  value: number;
  max?: number;
  size?: number;
  stroke?: number;
  color?: string;
  bg?: string;
  label?: string;
}

/**
 * Circular progress ring used for "X of Y" counts on the dashboard and
 * settings storage-quota indicator. The transition on strokeDashoffset
 * animates the fill smoothly when value changes.
 */
export function Ring({
  value,
  max = 1,
  size = 72,
  stroke = 8,
  color = 'var(--primary)',
  bg = 'var(--outline-variant)',
  label,
}: RingProps) {
  const clamped = Math.max(0, Math.min(value, max));
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (clamped / max) * c;

  return (
    <svg
      width={size}
      height={size}
      role={label ? 'img' : undefined}
      aria-label={label}
      aria-hidden={label ? undefined : true}
      style={{ transform: 'rotate(-90deg)' }}
    >
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke={bg}
        strokeWidth={stroke}
        fill="none"
      />
      <circle
        cx={size / 2}
        cy={size / 2}
        r={r}
        stroke={color}
        strokeWidth={stroke}
        fill="none"
        strokeDasharray={c}
        strokeDashoffset={offset}
        strokeLinecap="round"
        style={{ transition: 'stroke-dashoffset 600ms ease' }}
      />
    </svg>
  );
}
