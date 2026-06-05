import type { ReactNode } from 'react';
import { Box, Typography } from '@mui/material';
import Eyebrow from './Eyebrow';
import GradientHeading from './GradientHeading';

interface SectionHeaderProps {
  /** Heading id the section's region landmark is labelled by. */
  id: string;
  /** Short teal kicker above the title. */
  eyebrow: ReactNode;
  /** The gradient h2 title — one fixed size across every section. */
  title: ReactNode;
  /** Optional supporting line beneath the title. */
  lead?: ReactNode;
  'data-lead-testid'?: string;
}

/**
 * The single section-header pattern for the Welcome surface: an {@link Eyebrow}
 * kicker, a gradient `h2` at one fixed size (`--w-text-4xl`), and an optional
 * lead. Left-aligned with a fixed bottom rhythm so every section opens
 * identically — this is what makes the page read as one designed system rather
 * than a stack of differently-sized headings.
 */
export default function SectionHeader({
  id,
  eyebrow,
  title,
  lead,
  'data-lead-testid': leadTestId,
}: SectionHeaderProps) {
  return (
    <Box sx={{ maxWidth: '52ch', mb: { xs: 5, md: 8 } }}>
      <Eyebrow sx={{ mb: 2.5 }}>{eyebrow}</Eyebrow>
      <GradientHeading id={id} fontSize="var(--w-text-4xl)">
        {title}
      </GradientHeading>
      {lead && (
        <Typography
          data-testid={leadTestId}
          sx={{
            mt: 3,
            fontSize: 'var(--w-text-lg)',
            lineHeight: 'var(--w-leading-base)',
            color: 'var(--w-fg-muted)',
          }}
        >
          {lead}
        </Typography>
      )}
    </Box>
  );
}
