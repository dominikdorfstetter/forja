import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

// @clerk/testing expects CLERK_SECRET_KEY in process.env
if (process.env.E2E_CLERK_SECRET_KEY && !process.env.CLERK_SECRET_KEY) {
  process.env.CLERK_SECRET_KEY = process.env.E2E_CLERK_SECRET_KEY;
}

function env(key: string, fallback?: string): string {
  const value = process.env[key] ?? fallback;
  if (value === undefined) {
    throw new Error(`Missing required env var: ${key}. Copy .env.example to .env and fill in values.`);
  }
  return value;
}

export const config = {
  baseUrl: env('E2E_BASE_URL', 'http://localhost:3000'),
  apiUrl: env('E2E_API_URL', 'http://localhost:8000'),

  headless: env('E2E_HEADLESS', 'true') === 'true',
  slowMo: parseInt(env('E2E_SLOW_MO', '0'), 10),
  timeout: parseInt(env('E2E_TIMEOUT', '30000'), 10),

  clerkSecretKey: env('E2E_CLERK_SECRET_KEY', ''),
  clerkPublishableKey: env('E2E_CLERK_PUBLISHABLE_KEY', ''),

  screenshotDir: path.resolve(__dirname, '..', '..', 'docs', 'screenshots'),
  authStatesDir: path.resolve(__dirname, '..', 'auth-states'),

  roles: {
    viewer: {
      email: env('E2E_VIEWER_EMAIL', ''),
      password: env('E2E_VIEWER_PASSWORD', ''),
    },
    reviewer: {
      email: env('E2E_REVIEWER_EMAIL', ''),
      password: env('E2E_REVIEWER_PASSWORD', ''),
    },
    author: {
      email: env('E2E_AUTHOR_EMAIL', ''),
      password: env('E2E_AUTHOR_PASSWORD', ''),
    },
    editor: {
      email: env('E2E_EDITOR_EMAIL', ''),
      password: env('E2E_EDITOR_PASSWORD', ''),
    },
    admin: {
      email: env('E2E_ADMIN_EMAIL', ''),
      password: env('E2E_ADMIN_PASSWORD', ''),
    },
    owner: {
      email: env('E2E_OWNER_EMAIL', ''),
      password: env('E2E_OWNER_PASSWORD', ''),
    },
    system_admin: {
      email: env('E2E_SYSTEM_ADMIN_EMAIL', ''),
      password: env('E2E_SYSTEM_ADMIN_PASSWORD', ''),
    },
  } as Record<string, { email: string; password: string }>,
};
