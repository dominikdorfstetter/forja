import { useTranslation } from 'react-i18next';
import { Box, Stack, Typography } from '@mui/material';
import { useScrollReveal } from '@/hooks/useScrollReveal';
import WelcomeSection from './primitives/WelcomeSection';
import SectionHeader from './primitives/SectionHeader';
import BrowserFrame from './primitives/BrowserFrame';

const reveal = (visible: boolean, delay = 0) => ({
  opacity: visible ? 1 : 0,
  transform: visible ? 'translateY(0)' : 'translateY(32px)',
  transition: `opacity 0.9s cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms, transform 0.9s cubic-bezier(0.16, 1, 0.3, 1) ${delay}ms`,
});

// Public assets live under Vite's base (the app is served at /dashboard/).
const asset = (file: string) => `${import.meta.env.BASE_URL}${file}`;

/**
 * Product showcase (#806 slot): two real, framed screenshots of the running
 * app — the dashboard "workbench" as the base and the multilingual content
 * editor floating over its corner — revealed on scroll, with a legend beneath
 * explaining each. Sits right after the hero for immediate visual proof.
 */
export default function WelcomeProductPreview() {
  const { t } = useTranslation();
  const headingId = 'welcome-showcase-heading';
  const [dashRef, dashVisible] = useScrollReveal(0.15);
  const [editorRef, editorVisible] = useScrollReveal(0.15);

  const legend = [
    { dot: 'var(--w-primary)', text: t('welcome.showcase.dashboardCaption') },
    { dot: 'var(--w-primary-light)', text: t('welcome.showcase.editorCaption') },
  ];

  return (
    <WelcomeSection labelledBy={headingId} maxWidth="lg" data-testid="welcome.section.showcase">
      <SectionHeader
        id={headingId}
        eyebrow={t('welcome.showcase.eyebrow')}
        title={t('welcome.showcase.heading')}
        lead={t('welcome.showcase.lead')}
      />

      {/* Layered composition: the dashboard is the base; the editor floats over
          its lower-right corner on desktop. On mobile it degrades to a clean,
          equal-width centred stack. */}
      <Box
        sx={{
          position: 'relative',
          maxWidth: 1080,
          mx: 'auto',
          display: { xs: 'flex', md: 'block' },
          flexDirection: 'column',
          alignItems: 'center',
          gap: { xs: 4, md: 0 },
        }}
      >
        {/* Dashboard — base, left-anchored on desktop */}
        <Box
          ref={dashRef}
          data-testid="welcome.showcase.dashboard"
          sx={{ width: { xs: '100%', md: '80%' }, ...reveal(dashVisible) }}
        >
          <BrowserFrame
            url="cms.dorfstetter.at/dashboard"
            webp={asset('welcome-dashboard.webp')}
            png={asset('welcome-dashboard.png')}
            alt={t('welcome.showcase.dashboardAlt')}
            width={1600}
            height={1000}
          />
        </Box>

        {/* Editor — floats over the dashboard's lower-right corner on desktop */}
        <Box
          ref={editorRef}
          data-testid="welcome.showcase.editor"
          sx={{
            width: { xs: '100%', md: '48%' },
            position: { md: 'absolute' },
            right: { md: 0 },
            bottom: { md: 0 },
            zIndex: 2,
            ...reveal(editorVisible, 150),
          }}
        >
          <BrowserFrame
            url="cms.dorfstetter.at/blogs"
            webp={asset('welcome-editor.webp')}
            png={asset('welcome-editor.png')}
            alt={t('welcome.showcase.editorAlt')}
            width={1600}
            height={1000}
            sx={{
              // On desktop, a bg-coloured ring carves a clean gap against the
              // dashboard and a deeper shadow lifts the editor forward.
              boxShadow: {
                xs: '0 30px 90px -20px rgba(0, 0, 0, 0.55)',
                md: '0 0 0 6px var(--w-bg), 0 40px 100px -24px rgba(0, 0, 0, 0.65)',
              },
            }}
          />
        </Box>
      </Box>

      {/* Legend — explains each screenshot beneath the composition */}
      <Box
        sx={{
          maxWidth: 1080,
          mx: 'auto',
          mt: { xs: 5, md: 7 },
          display: 'grid',
          gap: { xs: 2, md: 4 },
          gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' },
        }}
      >
        {legend.map((item) => (
          <Stack key={item.text} direction="row" spacing={1.5} sx={{ alignItems: 'flex-start' }}>
            <Box
              aria-hidden
              sx={{ width: 9, height: 9, borderRadius: '50%', backgroundColor: item.dot, mt: '7px', flexShrink: 0 }}
            />
            <Typography sx={{ fontSize: 'var(--w-text-sm)', lineHeight: 'var(--w-leading-base)', color: 'var(--w-fg-muted)' }}>
              {item.text}
            </Typography>
          </Stack>
        ))}
      </Box>
    </WelcomeSection>
  );
}
