import { useTranslation } from 'react-i18next';
import { Box, Stack, Typography } from '@mui/material';
import ShieldRoundedIcon from '@mui/icons-material/ShieldRounded';
import BoltRoundedIcon from '@mui/icons-material/BoltRounded';
import LayersRoundedIcon from '@mui/icons-material/LayersRounded';
import CodeRoundedIcon from '@mui/icons-material/CodeRounded';
import EditNoteRoundedIcon from '@mui/icons-material/EditNoteRounded';
import type { SvgIconComponent } from '@mui/icons-material';
import SectionHeader from './primitives/SectionHeader';
import WelcomeSection from './primitives/WelcomeSection';

/** Compliance leads — the rest support it. Order is intentional (#810). */
const GROUPS: { key: string; Icon: SvgIconComponent }[] = [
  { key: 'compliance', Icon: ShieldRoundedIcon },
  { key: 'performance', Icon: BoltRoundedIcon },
  { key: 'multiSite', Icon: LayersRoundedIcon },
  { key: 'developer', Icon: CodeRoundedIcon },
  { key: 'authoring', Icon: EditNoteRoundedIcon },
];

/**
 * Honest v1.8.0 capability grid (#810): compliance-by-construction first, then
 * Rust performance, multi-site, developer-first and authoring. Every bullet
 * maps to a shipped feature — no vaporware. Token-driven cards (12px radius,
 * elevated surface); icons are decorative (aria-hidden), the text is the name.
 */
export default function WelcomeCapabilities() {
  const { t } = useTranslation();
  const headingId = 'welcome-capabilities-heading';

  return (
    <WelcomeSection labelledBy={headingId} data-testid="welcome.section.capabilities">
      <SectionHeader
        id={headingId}
        eyebrow={t('welcome.features.eyebrow')}
        title={t('welcome.features.title')}
        lead={t('welcome.features.lead')}
      />

      <Box
        sx={{
          display: 'grid',
          gap: 3,
          gridTemplateColumns: { xs: '1fr', md: 'repeat(2, 1fr)', lg: 'repeat(3, 1fr)' },
        }}
      >
        {GROUPS.map(({ key, Icon }, index) => {
          const items = t(`welcome.features.${key}.items`, { returnObjects: true }) as string[];
          return (
            <Box
              key={key}
              sx={{
                gridColumn: index === 0 ? { xs: 'auto', md: '1 / -1', lg: 'span 1' } : 'auto',
                p: 3,
                borderRadius: 'var(--w-radius-xl)',
                backgroundColor: 'var(--w-bg-elevated)',
                border: '1px solid var(--w-border)',
              }}
            >
              <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', mb: 2 }}>
                <Icon aria-hidden sx={{ fontSize: 24, color: 'var(--w-primary)' }} />
                <Typography
                  component="h3"
                  sx={{
                    fontFamily: 'var(--w-font-display)',
                    fontSize: 'var(--w-text-xl)',
                    fontWeight: 700,
                    fontVariationSettings: 'normal',
                    color: 'var(--w-fg)',
                  }}
                >
                  {t(`welcome.features.${key}.title`)}
                </Typography>
              </Stack>
              <Stack component="ul" spacing={1} sx={{ listStyle: 'none', p: 0, m: 0 }}>
                {(Array.isArray(items) ? items : []).map((item) => (
                  <Typography
                    key={item}
                    component="li"
                    sx={{ fontSize: 'var(--w-text-base)', color: 'var(--w-fg-muted)' }}
                  >
                    {item}
                  </Typography>
                ))}
              </Stack>
            </Box>
          );
        })}
      </Box>
    </WelcomeSection>
  );
}
