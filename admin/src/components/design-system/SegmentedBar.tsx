export interface BarSegment {
  value: number;
  color: string;
  label: string;
}

export interface SegmentedBarProps {
  segments: BarSegment[];
  height?: number;
  ariaLabel?: string;
}

/**
 * Multi-segment progress bar — used for "your work at a glance" on the
 * dashboard and content-status breakdowns. Segments with zero value collapse
 * to 0 width; the gap between segments remains constant.
 */
export function SegmentedBar({ segments, height = 10, ariaLabel }: SegmentedBarProps) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;

  return (
    <div
      role={ariaLabel ? 'img' : undefined}
      aria-label={ariaLabel}
      style={{
        display: 'flex',
        width: '100%',
        height,
        gap: 2,
        borderRadius: height,
        overflow: 'hidden',
      }}
    >
      {segments.map((seg) => (
        <div
          key={seg.label}
          title={`${seg.label}: ${seg.value}`}
          style={{
            flex: seg.value / total,
            background: seg.color,
            minWidth: seg.value > 0 ? 3 : 0,
          }}
        />
      ))}
    </div>
  );
}
