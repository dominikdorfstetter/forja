import { Box, Typography, type SxProps, type Theme } from '@mui/material';

interface BrowserFrameProps {
  /** Fake address-bar text, e.g. `cms.dorfstetter.at/dashboard`. */
  url: string;
  /** Root-absolute path to the WebP source (preferred format). */
  webp: string;
  /** Root-absolute path to the PNG fallback. */
  png: string;
  /** Descriptive alt text for the screenshot. */
  alt: string;
  /** Intrinsic pixel dimensions — set on `<img>` to reserve space (no CLS). */
  width: number;
  height: number;
  sx?: SxProps<Theme>;
}

const TRAFFIC_LIGHTS = ['#ff5f57', '#febc2e', '#28c840'] as const;

/**
 * A browser-style window frame around a product screenshot. Renders an
 * art-directed `<picture>` (WebP with a PNG fallback) that lazy-loads and
 * reserves its box via intrinsic `width`/`height`. Shared by the Welcome
 * showcase so the window chrome is defined once, not per screenshot.
 */
export default function BrowserFrame({ url, webp, png, alt, width, height, sx }: BrowserFrameProps) {
  return (
    <Box
      sx={{
        borderRadius: 'var(--w-radius-lg)',
        overflow: 'hidden',
        border: '1px solid var(--w-border)',
        backgroundColor: 'var(--w-bg-elevated)',
        boxShadow: '0 30px 90px -20px rgba(0, 0, 0, 0.55)',
        ...sx,
      }}
    >
      {/* Title bar: traffic lights + address pill */}
      <Box
        sx={{
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          px: 2,
          py: 1,
          backgroundColor: 'var(--w-bg-elevated)',
          borderBottom: '1px solid var(--w-border)',
        }}
      >
        <Box aria-hidden sx={{ display: 'flex', gap: 0.75 }}>
          {TRAFFIC_LIGHTS.map((color) => (
            <Box key={color} sx={{ width: 11, height: 11, borderRadius: '50%', backgroundColor: color }} />
          ))}
        </Box>
        <Box
          sx={{
            flex: 1,
            mx: { xs: 1, sm: 4 },
            px: 1.5,
            py: 0.4,
            borderRadius: 'var(--w-radius-full)',
            backgroundColor: 'var(--w-bg)',
          }}
        >
          <Typography
            sx={{ fontSize: 'var(--w-text-xs)', color: 'var(--w-fg-subtle)', textAlign: 'center' }}
          >
            {url}
          </Typography>
        </Box>
      </Box>

      {/* Screenshot — only the chosen <source> is fetched (WebP for ~all browsers) */}
      <picture>
        <source srcSet={webp} type="image/webp" />
        <Box
          component="img"
          src={png}
          alt={alt}
          width={width}
          height={height}
          loading="lazy"
          decoding="async"
          sx={{ display: 'block', width: '100%', height: 'auto' }}
        />
      </picture>
    </Box>
  );
}
