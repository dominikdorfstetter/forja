import { Box, type SxProps, type Theme } from '@mui/material';

export interface ForjaBrandMarkProps {
  /** Rendered tile size in CSS pixels. The internal 512×512 viewBox
   * scales proportionally, so the F stays crisp at any size. */
  size?: number;
  /** Optional additional sx overrides (margin, drop shadow, etc.). */
  sx?: SxProps<Theme>;
}

/**
 * Canonical Forja brand tile: a rounded puzzle-notched container tinted
 * with `--primary` and a "F" glyph filled with `--primary-c`.
 *
 * The F is live SVG text — variable Roboto Flex at weight 700 via the
 * shared --font-sans token — with a hard-coded fallback chain so the
 * mark reads the same whether or not the variable font has finished
 * loading. Both colours pull from the active accent tokens so any
 * flavor/accent change re-tints the mark without code edits.
 */
export function ForjaBrandMark({ size = 32, sx }: ForjaBrandMarkProps) {
  return (
    <Box
      component="svg"
      aria-hidden="true"
      viewBox="0 0 512 512"
      sx={{ width: size, height: size, display: 'block', ...sx }}
    >
      <path
        d="M72,48 H392 A24,24 0 0,1 416,72 V188 A44,44 0 0,1 416,276 V392 A24,24 0 0,1 392,416 H272 A40,40 0 0,0 192,416 H72 A24,24 0 0,1 48,392 V72 A24,24 0 0,1 72,48 Z"
        fill="var(--primary)"
      />
      <text
        x="232"
        y="310"
        fontFamily="var(--font-sans, 'Roboto Flex', 'Roboto', system-ui, sans-serif)"
        fontWeight="700"
        fontSize="220"
        fill="var(--primary-c)"
        textAnchor="middle"
      >
        F
      </text>
    </Box>
  );
}
