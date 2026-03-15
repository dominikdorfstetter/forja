import { useTranslation } from 'react-i18next';
import { Box, Typography } from '@mui/material';
import BoltRoundedIcon from '@mui/icons-material/BoltRounded';
import ShieldRoundedIcon from '@mui/icons-material/ShieldRounded';
import PublicRoundedIcon from '@mui/icons-material/PublicRounded';
import TranslateRoundedIcon from '@mui/icons-material/TranslateRounded';
import StorageRoundedIcon from '@mui/icons-material/StorageRounded';
import ApiRoundedIcon from '@mui/icons-material/ApiRounded';
import DashboardRoundedIcon from '@mui/icons-material/DashboardRounded';
import SearchRoundedIcon from '@mui/icons-material/SearchRounded';
import type { SvgIconComponent } from '@mui/icons-material';

interface Feature {
  key: string;
  icon: SvgIconComponent;
  color: string;
}

const FEATURES: Feature[] = [
  { key: 'Fast', icon: BoltRoundedIcon, color: '#f5a623' },
  { key: 'Secure', icon: ShieldRoundedIcon, color: '#34d399' },
  { key: 'Federation', icon: PublicRoundedIcon, color: '#818cf8' },
  { key: 'Multilingual', icon: TranslateRoundedIcon, color: '#f472b6' },
  { key: 'Api', icon: ApiRoundedIcon, color: '#60a5fa' },
  { key: 'MultiSite', icon: DashboardRoundedIcon, color: '#fbbf24' },
  { key: 'Storage', icon: StorageRoundedIcon, color: '#a78bfa' },
  { key: 'Seo', icon: SearchRoundedIcon, color: '#fb923c' },
];

interface WelcomeFeatureGridProps {
  mounted: boolean;
}

function FeatureCard({ feat }: { feat: Feature }) {
  const { t } = useTranslation();
  const Icon = feat.icon;

  return (
    <Box
      sx={{
        flex: '0 0 auto',
        width: 200,
        p: 2.5,
        borderRadius: 3,
        bgcolor: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.07)',
        backdropFilter: 'blur(12px)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        gap: 1,
      }}
    >
      <Icon sx={{ fontSize: 24, color: feat.color }} />
      <Typography sx={{ fontSize: '0.85rem', fontWeight: 600, color: 'rgba(255,255,255,0.9)' }}>
        {t(`welcome.feature${feat.key}`)}
      </Typography>
      <Typography sx={{ fontSize: '0.75rem', color: 'rgba(255,255,255,0.4)', lineHeight: 1.5 }}>
        {t(`welcome.feature${feat.key}Desc`)}
      </Typography>
    </Box>
  );
}

export default function WelcomeFeatureGrid({ mounted }: WelcomeFeatureGridProps) {
  // Double the features for seamless loop
  const items = [...FEATURES, ...FEATURES];

  return (
    <Box
      sx={{
        width: '100vw',
        overflow: 'hidden',
        mb: 5,
        opacity: mounted ? 1 : 0,
        transition: 'opacity 0.8s ease 0.5s',
        maskImage:
          'linear-gradient(to right, transparent, black 10%, black 90%, transparent)',
        WebkitMaskImage:
          'linear-gradient(to right, transparent, black 10%, black 90%, transparent)',
      }}
    >
      <Box
        sx={{
          display: 'flex',
          gap: 2,
          animation: mounted ? 'welcomeScroll 30s linear infinite' : 'none',
          '&:hover': { animationPlayState: 'paused' },
          '@keyframes welcomeScroll': {
            '0%': { transform: 'translateX(0)' },
            '100%': { transform: `translateX(-${FEATURES.length * (200 + 16)}px)` },
          },
        }}
      >
        {items.map((feat, i) => (
          <FeatureCard key={`${feat.key}-${i}`} feat={feat} />
        ))}
      </Box>
    </Box>
  );
}
