import { useTranslation } from 'react-i18next';
import { Box, Stack, Typography } from '@mui/material';
import PersonRoundedIcon from '@mui/icons-material/PersonRounded';
import GroupRoundedIcon from '@mui/icons-material/GroupRounded';
import BusinessRoundedIcon from '@mui/icons-material/BusinessRounded';
import SecurityRoundedIcon from '@mui/icons-material/SecurityRounded';
import type { SvgIconComponent } from '@mui/icons-material';
import SectionHeader from './primitives/SectionHeader';
import WelcomeSection from './primitives/WelcomeSection';

const USE_CASES: { key: string; Icon: SvgIconComponent }[] = [
  { key: 'solo', Icon: PersonRoundedIcon },
  { key: 'teams', Icon: GroupRoundedIcon },
  { key: 'agencies', Icon: BusinessRoundedIcon },
  { key: 'enterprise', Icon: SecurityRoundedIcon },
];

/** Who Forja is for (#810) — restyled with the brand tokens. */
export default function WelcomeUseCases() {
  const { t } = useTranslation();
  const headingId = 'welcome-usecases-heading';

  return (
    <WelcomeSection labelledBy={headingId} data-testid="welcome.section.usecases">
      <SectionHeader
        id={headingId}
        eyebrow={t('welcome.useCases.eyebrow')}
        title={t('welcome.builtFor')}
        lead={t('welcome.useCases.lead')}
      />

      <Box
        sx={{
          display: 'grid',
          gap: 2,
          gridTemplateColumns: { xs: '1fr', sm: 'repeat(2, 1fr)', lg: 'repeat(4, 1fr)' },
        }}
      >
        {USE_CASES.map(({ key, Icon }) => (
          <Stack
            key={key}
            data-testid={`welcome.usecase.${key}`}
            spacing={1.5}
            sx={{
              p: 3,
              borderRadius: 'var(--w-radius-xl)',
              backgroundColor: 'var(--w-bg-elevated)',
              border: '1px solid var(--w-border)',
            }}
          >
            <Box
              aria-hidden
              sx={{
                width: 40,
                height: 40,
                borderRadius: 'var(--w-radius-md)',
                backgroundColor: 'var(--w-primary-soft)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Icon sx={{ fontSize: 22, color: 'var(--w-primary)' }} />
            </Box>
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
              {t(`welcome.useCases.${key}`)}
            </Typography>
            <Typography sx={{ fontSize: 'var(--w-text-sm)', color: 'var(--w-fg-muted)', lineHeight: 'var(--w-leading-base)' }}>
              {t(`welcome.useCases.${key}Desc`)}
            </Typography>
          </Stack>
        ))}
      </Box>
    </WelcomeSection>
  );
}
