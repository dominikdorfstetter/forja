import { Typography } from '@mui/material';

interface CharCounterProps {
  current: number;
  max: number;
}

export default function CharCounter({ current, max }: CharCounterProps) {
  const ratio = current / max;
  const color = ratio > 1 ? 'error.main' : ratio > 0.9 ? 'warning.main' : 'success.main';

  return (
    <Typography
      variant="caption"
      sx={{ color, fontVariantNumeric: 'tabular-nums' }}
    >
      {current}/{max}
    </Typography>
  );
}
