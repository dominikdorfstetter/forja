import { useEffect, useState } from 'react';
import WelcomeSurface from '@/components/welcome/theme/WelcomeSurface';
import UnderwaterBackdrop from '@/components/welcome/theme/UnderwaterBackdrop';
import WelcomeLanguageSelector from '@/components/welcome/WelcomeLanguageSelector';
import WelcomeHero from '@/components/welcome/WelcomeHero';
import WelcomeProductPreview from '@/components/welcome/WelcomeProductPreview';
import WelcomeWhatIs from '@/components/welcome/WelcomeWhatIs';
import WelcomeCapabilities from '@/components/welcome/WelcomeCapabilities';
import WelcomeComparison from '@/components/welcome/WelcomeComparison';
import WelcomeUseCases from '@/components/welcome/WelcomeUseCases';
import WelcomeFooter from '@/components/welcome/WelcomeFooter';
import { getGuestToken } from '@/services/auth';
import { markCurrentKeyAsGuest, setApiKey } from '@/services/apiKeyStorage';
import { useAuth } from '@/store/AuthContext';

/**
 * Signed-out Welcome surface (the `<SignedOut>` fallback at `/dashboard`).
 * Rebuilt in the brand language (epic #806): a scoped OKLCH token surface that
 * follows `prefers-color-scheme`, leading with a plain-language explainer.
 * Capability sections (#810) slot between the explainer and the footer.
 */
export default function WelcomePage() {
  const [mounted, setMounted] = useState(false);
  const [demoLoading, setDemoLoading] = useState(false);
  const { refreshAuth } = useAuth();

  const handleTryDemo = async () => {
    setDemoLoading(true);
    try {
      const { api_key, site_id } = await getGuestToken();
      setApiKey(api_key);
      // Explicit marker — the demo key is randomly generated server-side
      // so prefix-sniffing no longer identifies it. `isGuestApiKey()` reads it.
      markCurrentKeyAsGuest();
      localStorage.setItem('selectedSiteId', site_id);
      await refreshAuth();
    } finally {
      setDemoLoading(false);
    }
  };

  useEffect(() => {
    const timer = setTimeout(() => setMounted(true), 50);
    return () => clearTimeout(timer);
  }, []);

  return (
    <WelcomeSurface aria-label="Forja">
      <UnderwaterBackdrop />
      <WelcomeLanguageSelector mounted={mounted} />
      <WelcomeHero onTryDemo={handleTryDemo} demoLoading={demoLoading} />
      <WelcomeProductPreview />
      <WelcomeWhatIs />
      <WelcomeCapabilities />
      <WelcomeComparison />
      <WelcomeUseCases />
      <WelcomeFooter mounted={mounted} />
    </WelcomeSurface>
  );
}
