import React from 'react';
import ReactDOM from 'react-dom/client';
import { ClerkProvider } from '@clerk/clerk-react';
import './i18n';
import App from './App';

interface AppConfig {
  clerk_publishable_key: string;
  app_name: string;
}

async function bootstrap() {
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

    root.render(
      <React.StrictMode>
        <ClerkProvider publishableKey={config.clerk_publishable_key}>
          <App />
        </ClerkProvider>
      </React.StrictMode>,
    );
  } catch (err) {
    console.error('Failed to load application config:', err);
    root.render(
      <div style={{
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
