export interface AvatarProps {
  name: string;
  size?: number;
  bg?: string;
  color?: string;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

/**
 * Gradient-backed initials avatar. Used in the sidebar user card, members
 * list, and activity feed. The default gradient matches the M3 Expressive
 * violet accent; override via `bg` for role-coloured avatars.
 */
export function Avatar({
  name,
  size = 32,
  bg = 'linear-gradient(135deg, #b8a4ff, #8a6bff)',
  color = '#1a1328',
}: AvatarProps) {
  return (
    <div
      aria-label={name}
      role="img"
      style={{
        width: size,
        height: size,
        borderRadius: '50%',
        background: bg,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: size * 0.38,
        fontWeight: 600,
        color,
        flexShrink: 0,
        userSelect: 'none',
      }}
    >
      {initials(name) || '?'}
    </div>
  );
}
