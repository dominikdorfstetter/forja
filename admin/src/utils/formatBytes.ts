const UNITS = ['B', 'KB', 'MB', 'GB', 'TB'] as const;

/** Human-readable binary size: whole bytes below 1 KB, then one decimal in the largest fitting unit (1.5 KB, 2.0 GB). */
export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), UNITS.length - 1);
  return `${(bytes / 1024 ** exponent).toFixed(1)} ${UNITS[exponent]}`;
}
