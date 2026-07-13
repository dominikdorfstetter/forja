/**
 * Chrome strings for inline client-side scripts (data-attribute injection).
 *
 * Inline scripts run in the browser and cannot call the server-side `t()`,
 * so pages render the strings a script needs into a `data-i18n` JSON
 * attribute at render time (`data-i18n={JSON.stringify(...)}`) and the
 * script parses it once here. The literal fallbacks keep the script working
 * even when the attribute is missing or malformed.
 */

/** Parse a `data-i18n` attribute, overlaying `fallbacks` with server values. */
export function readI18n<T extends Record<string, string>>(
  raw: string | undefined,
  fallbacks: T,
): T {
  if (!raw) return fallbacks;
  try {
    return { ...fallbacks, ...(JSON.parse(raw) as Partial<T>) };
  } catch {
    return fallbacks;
  }
}

/** Fill the `{status}` placeholder in a chrome-string template. */
export function withStatus(template: string, status: number): string {
  return template.replace("{status}", String(status));
}
