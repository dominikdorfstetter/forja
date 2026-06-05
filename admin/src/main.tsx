import ReactDOM from 'react-dom/client';
import createCache from '@emotion/cache';
import { CacheProvider } from '@emotion/react';
import { ClerkProvider } from '@clerk/clerk-react';
import i18n from './i18n';
import App from './App';
import { cspNonce } from './utils/cspNonce';
import { appConfig } from './appConfig';

const emotionCache = createCache({ key: 'css', nonce: cspNonce });

interface AppConfig {
  clerk_publishable_key: string;
  app_name: string;
  demo_mode: boolean;
}

async function bootstrap() {
  // Sync document lang with i18n language
  document.documentElement.lang = i18n.language || 'en';
  i18n.on('languageChanged', (lng) => {
    document.documentElement.lang = lng;
  });

  const root = ReactDOM.createRoot(document.getElementById('root')!);

  try {
    const res = await fetch('/api/v1/config');
    if (!res.ok) {
      throw new Error(`Config fetch failed: ${res.status}`);
    }
    const config: AppConfig = await res.json();

    if (!config.clerk_publishable_key) {
      throw new Error('Server returned empty clerk_publishable_key. Check CLERK_PUBLISHABLE_KEY in backend env.');
    }

    appConfig.demoMode = config.demo_mode ?? false;

    // StrictMode removed: Clerk v5 injects DOM nodes that conflict with
    // React 19 StrictMode's double-invoke behavior, causing removeChild
    // errors when guest mode changes the rendered subtree.
    root.render(
      <CacheProvider value={emotionCache}>
        <ClerkProvider publishableKey={config.clerk_publishable_key} nonce={cspNonce}>
          <App />
        </ClerkProvider>
      </CacheProvider>,
    );
  } catch (err) {
    console.error('Failed to load application config:', err);
    root.render(
      // Error fallback renders OUTSIDE MUI's ThemeProvider (config failed to
      // load), so sx/theme aren't available — inline styles are correct here.
      // react-doctor-disable-next-line no-inline-exhaustive-style
      <div
        role="alert"
        data-testid="app.error.config"
        style={{
        fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        margin: 0,
        background: 'linear-gradient(135deg, #1a237e 0%, #0d47a1 50%, #01579b 100%)',
        color: 'white',
        textAlign: 'center',
        padding: '2rem',
      }}>
        <div>
          <h1>Failed to Load Configuration</h1>
          <p>Could not reach the backend API at <code>/api/v1/config</code>.</p>
          <p style={{ opacity: 0.8 }}>
            {err instanceof Error ? err.message : 'Unknown error'}
          </p>
        </div>
      </div>,
    );
  }
}

bootstrap();
