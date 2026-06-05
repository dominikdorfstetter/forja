import { Box } from '@mui/material';

/**
 * "Sunlight through water" backdrop for the Welcome surface. Fixed to the
 * viewport so the light stays overhead at every scroll depth (the wow doesn't
 * scroll away). Layers: a teal surface glow, two sets of converging god-rays
 * (a conic gradient whose origin sits above the top edge, so beams fan out from
 * one point), and a faint caustic shimmer — all masked to fade by mid-screen so
 * the reading zone stays calm.
 *
 * The rays are warped by a static `feTurbulence` + `feDisplacementMap` filter so
 * the shafts ripple like light through a moving water surface rather than being
 * ruler-straight; two layers then wiggle on different axes and periods so the
 * motion never repeats. The warp is static (computed once, and survives
 * reduced-motion as a still wavy shape); only the CSS wiggle moves, so the
 * surface's `prefers-reduced-motion` block freezes it. Decorative + inert.
 */

// Fractal-noise net used as an alpha mask to tint a teal "caustic" layer.
const CAUSTIC_MASK =
  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='560' height='560'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.012 0.018' numOctaves='2' seed='7' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E\")";

// Converging rays: bright slivers radiating from a point just above top-centre.
const RAYS = `repeating-conic-gradient(from 175deg at 50% -12%,
  transparent 0deg,
  color-mix(in oklch, var(--w-primary) 16%, transparent) 1deg,
  color-mix(in oklch, var(--w-primary) 16%, transparent) 2deg,
  transparent 3.4deg,
  transparent 11deg)`;

const rayLayer = (opacity: number, lightOpacity: number, blur: number) =>
  ({
    position: 'absolute',
    inset: '-35%',
    opacity,
    '@media (prefers-color-scheme: light)': { opacity: lightOpacity },
    backgroundImage: RAYS,
    transformOrigin: '50% 0%',
    // Warp the straight shafts into rippling, smoky beams (static = cheap).
    filter: `url(#welcome-ray-warp) blur(${blur}px)`,
  }) as const;

export default function UnderwaterBackdrop() {
  return (
    <Box
      aria-hidden
      sx={{
        position: 'fixed',
        inset: 0,
        zIndex: 0,
        pointerEvents: 'none',
        overflow: 'hidden',
        // Strong overhead, gone by mid-viewport — keeps the reading zone calm.
        maskImage: 'linear-gradient(to bottom, #000 0%, #000 12%, rgba(0,0,0,0.4) 38%, transparent 64%)',
        WebkitMaskImage: 'linear-gradient(to bottom, #000 0%, #000 12%, rgba(0,0,0,0.4) 38%, transparent 64%)',
      }}
    >
      {/* SVG warp filter — turbulence displaces the rays into wavy shafts */}
      <Box
        component="svg"
        aria-hidden
        sx={{ position: 'absolute', width: 0, height: 0 }}
      >
        <filter id="welcome-ray-warp" x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency="0.008 0.013" numOctaves={2} seed={11} result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale={42} xChannelSelector="R" yChannelSelector="G" />
        </filter>
      </Box>

      {/* 1 — surface glow: brightest teal pool of light at the very top */}
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          backgroundImage:
            'radial-gradient(125% 70% at 50% -28%, color-mix(in oklch, var(--w-primary) 22%, transparent) 0%, transparent 60%)',
        }}
      />

      {/* 2a — primary rays: wide, slow, organic wiggle */}
      <Box
        sx={{
          ...rayLayer(0.5, 0.32, 7),
          animation: 'welcomeRaysA 19s ease-in-out infinite',
          '@keyframes welcomeRaysA': {
            '0%': { transform: 'rotate(-1.8deg) skewX(-1deg) translateX(-1%)' },
            '28%': { transform: 'rotate(0.7deg) skewX(0.9deg) translateX(0.7%)' },
            '54%': { transform: 'rotate(-0.4deg) skewX(-0.5deg) translateX(-0.4%)' },
            '79%': { transform: 'rotate(1.7deg) skewX(0.6deg) translateX(0.9%)' },
            '100%': { transform: 'rotate(-1.8deg) skewX(-1deg) translateX(-1%)' },
          },
        }}
      />

      {/* 2b — secondary rays: fainter, counter-phase, longer period → shimmer */}
      <Box
        sx={{
          ...rayLayer(0.26, 0.16, 11),
          animation: 'welcomeRaysB 27s ease-in-out infinite',
          '@keyframes welcomeRaysB': {
            '0%': { transform: 'rotate(2.2deg) skewX(1.1deg) translateX(1.2%)' },
            '33%': { transform: 'rotate(-0.8deg) skewX(-0.7deg) translateX(-0.6%)' },
            '66%': { transform: 'rotate(1deg) skewX(0.4deg) translateX(0.5%)' },
            '100%': { transform: 'rotate(2.2deg) skewX(1.1deg) translateX(1.2%)' },
          },
        }}
      />

      {/* 3 — caustic shimmer: a teal "net of light", masked by fractal noise */}
      <Box
        sx={{
          position: 'absolute',
          inset: 0,
          opacity: 0.1,
          '@media (prefers-color-scheme: light)': { opacity: 0.05 },
          backgroundColor: 'var(--w-primary)',
          maskImage: CAUSTIC_MASK,
          WebkitMaskImage: CAUSTIC_MASK,
          maskSize: '560px 560px',
          WebkitMaskSize: '560px 560px',
          animation: 'welcomeCaustic 26s linear infinite',
          '@keyframes welcomeCaustic': {
            from: { maskPosition: '0 0', WebkitMaskPosition: '0 0' },
            to: { maskPosition: '560px 280px', WebkitMaskPosition: '560px 280px' },
          },
        }}
      />
    </Box>
  );
}
