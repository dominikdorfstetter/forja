import { useTranslation } from 'react-i18next';
import { Box, Typography } from '@mui/material';
import BoltRoundedIcon from '@mui/icons-material/BoltRounded';
import ShieldRoundedIcon from '@mui/icons-material/ShieldRounded';
import PublicRoundedIcon from '@mui/icons-material/PublicRounded';
import TranslateRoundedIcon from '@mui/icons-material/TranslateRounded';

const FEATURES = [
  { key: 'Fast', icon: BoltRoundedIcon, color: '#f5a623' },
  { key: 'Secure', icon: ShieldRoundedIcon, color: '#34d399' },
  { key: 'Federation', icon: PublicRoundedIcon, color: '#818cf8' },
  { key: 'Multilingual', icon: TranslateRoundedIcon, color: '#f472b6' },
] as const;

interface WelcomeFeatureGridProps {
  mounted: boolean;
  isSmall: boolean;
}

export default function WelcomeFeatureGrid({ mounted, isSmall }: WelcomeFeatureGridProps) {
  const { t } = useTranslation();

  return (
    <Box
      sx={{
        display: 'grid',
        gridTemplateColumns: isSmall ? 'repeat(2, 1fr)' : 'repeat(4, 1fr)',
        gap: isSmall ? 1.5 : 2,
        width: '100%',
        maxWidth: 640,
        mb: 5,
      }}
    >
      {FEATURES.map((feat, i) => {
        const Icon = feat.icon;
        return (
          <Box
            key={feat.key}
            sx={{
              p: isSmall ? 2 : 2.5,
              borderRadius: 2.5,
              bgcolor: 'rgba(255,255,255,0.03)',
              border: '1px solid rgba(255,255,255,0.06)',
              backdropFilter: 'blur(12px)',
              textAlign: 'center',
              opacity: mounted ? 1 : 0,
              transform: mounted ? 'translateY(0)' : 'translateY(24px)',
              transition: `all 0.7s cubic-bezier(0.16, 1, 0.3, 1) ${0.5 + i * 0.08}s`,
              '&:hover': {
                bgcolor: 'rgba(255,255,255,0.06)',
                borderColor: 'rgba(255,255,255,0.12)',
                transform: 'translateY(-2px)',
              },
            }}
          >
            <Icon sx={{ fontSize: 28, color: feat.color, mb: 1 }} />
            <Typography
              sx={{
                fontSize: '0.8rem',
                fontWeight: 600,
                color: 'rgba(255,255,255,0.85)',
                mb: 0.5,
              }}
            >
              {t(`welcome.feature${feat.key}`)}
            </Typography>
            <Typography
              sx={{
                fontSize: '0.7rem',
                color: 'rgba(255,255,255,0.4)',
                lineHeight: 1.4,
              }}
            >
              {t(`welcome.feature${feat.key}Desc`)}
            </Typography>
          </Box>
        );
      })}
    </Box>
  );
}
