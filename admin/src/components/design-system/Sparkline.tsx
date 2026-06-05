export interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
  color?: string;
  ariaLabel?: string;
}

/**
 * Tiny SVG sparkline (line + faint filled area) for the dashboard analytics
 * strip and any inline trend indicator. Decorative by default; supply
 * ariaLabel to expose the summary value to assistive tech.
 */
export function Sparkline({
  data,
  width = 120,
  height = 32,
  color = 'var(--primary)',
  ariaLabel,
}: SparklineProps) {
  if (!data || data.length < 2) return null;

  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const step = width / (data.length - 1);
  const points = data
    .map((v, i) => `${i * step},${height - ((v - min) / range) * (height - 4) - 2}`)
    .join(' ');
  const area = `0,${height} ${points} ${width},${height}`;

  return (
    <svg
      width={width}
      height={height}
      role={ariaLabel ? 'img' : undefined}
      aria-label={ariaLabel}
      aria-hidden={ariaLabel ? undefined : true}
      style={{ display: 'block' }}
    >
      <polygon points={area} fill={color} opacity={0.12} />
      <polyline
        points={points}
        fill="none"
        stroke={color}
        strokeWidth={1.8}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
