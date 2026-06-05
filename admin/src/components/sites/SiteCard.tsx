import { Box, ButtonBase, Typography } from '@mui/material';
import { useTranslation } from 'react-i18next';
import type { Site, SiteRole } from '@/types/api';

interface SiteCardProps {
  site: Site;
  role: SiteRole | null;
  onSelect: (site: Site) => void;
}

export default function SiteCard({ site, role, onSelect }: SiteCardProps) {
  const { t } = useTranslation();
  const active = site.is_active;

  return (
    <Box data-testid="site-card" sx={{ height: '100%' }}>
      <ButtonBase
        data-testid={`site-card-${site.slug}`}
        onClick={() => onSelect(site)}
        focusRipple
        sx={{
          width: '100%',
          height: '100%',
          display: 'block',
          textAlign: 'left',
          p: 2.25,
          borderRadius: '16px',
          bgcolor: 'var(--surface-container-low)',
          border: '1px solid var(--outline-variant)',
          transition: 'background-color 140ms, border-color 140ms, transform 140ms',
          '&:hover': {
            bgcolor: 'var(--surface-container)',
            borderColor: 'color-mix(in srgb, var(--primary) 45%, var(--outline-variant))',
            transform: 'translateY(-1px)',
          },
          '&:focus-visible': {
            outline: '2px solid var(--primary)',
            outlineOffset: 2,
          },
        }}
      >
        <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 1.5, mb: 1 }}>
          <Typography
            component="div"
            noWrap
            sx={{
              fontSize: 18,
              fontWeight: 700,
              fontVariationSettings: '"wght" 700, "opsz" 18',
              color: 'var(--on-surface)',
              letterSpacing: -0.2,
              flex: 1,
              minWidth: 0,
            }}
          >
            {site.name}
          </Typography>
          <Box
            component="span"
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              px: 1,
              height: 22,
              borderRadius: '999px',
              border: active
                ? '1px solid color-mix(in srgb, var(--tertiary) 60%, var(--outline-variant))'
                : '1px solid var(--outline-variant)',
              color: active ? 'var(--tertiary)' : 'var(--on-surface-variant)',
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: 0.3,
              fontVariationSettings: '"wght" 600, "opsz" 11',
              whiteSpace: 'nowrap',
            }}
          >
            {active ? t('common.status.active') : t('common.status.inactive')}
          </Box>
        </Box>

        <Typography
          component="div"
          sx={{
            mb: 1.25,
            fontFamily: 'var(--font-mono, ui-monospace, monospace)',
            fontSize: 13,
            color: 'var(--on-surface-variant)',
          }}
          noWrap
        >
          {site.slug}
        </Typography>

        {role && (
          <Box
            component="span"
            data-testid="site-card-role"
            sx={{
              display: 'inline-flex',
              alignItems: 'center',
              px: 1.1,
              height: 22,
              borderRadius: '999px',
              bgcolor: 'var(--primary-container)',
              color: 'var(--on-primary-container)',
              fontSize: 11,
              fontWeight: 600,
              letterSpacing: 0.3,
              fontVariationSettings: '"wght" 600, "opsz" 11',
              textTransform: 'capitalize',
            }}
          >
            {role}
          </Box>
        )}
      </ButtonBase>
    </Box>
  );
}
