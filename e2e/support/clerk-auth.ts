import * as fs from 'fs';
import * as path from 'path';
import { type BrowserContext } from 'playwright';
import { clerk, setupClerkTestingToken } from '@clerk/testing/playwright';
import { config } from './config';

/**
 * Authenticates as a given role using @clerk/testing's official helpers.
 *
 * Uses ticket-based sign-in via Clerk's Backend API — no form automation needed.
 * The flow:
 * 1. setupClerkTestingToken() — sets the __clerk_testing_token cookie
 * 2. clerk.signIn({ emailAddress, page }) — creates a sign-in token and authenticates
 * 3. Session state is cached per role for reuse across scenarios
 *
 * @see https://clerk.com/docs/testing/playwright
 */
export async function loginAs(
  context: BrowserContext,
  role: string,
): Promise<void> {
  const credentials = config.roles[role];
  if (!credentials) {
    throw new Error(`Unknown role: "${role}". Valid roles: ${Object.keys(config.roles).join(', ')}`);
  }

  if (!credentials.email || !credentials.password) {
    throw new Error(`Missing credentials for role "${role}". Check your .env file.`);
  }

  const stateFile = path.join(config.authStatesDir, `${role}.json`);

  // Try cached state first
  if (fs.existsSync(stateFile)) {
    const stateData = JSON.parse(fs.readFileSync(stateFile, 'utf-8'));
    await context.addCookies(stateData.cookies ?? []);

    const page = await context.newPage();
    await page.goto(`${config.baseUrl}/dashboard/dashboard`, { waitUntil: 'networkidle' });
    try {
      await page.waitForSelector('[data-testid="layout.nav.dashboard"]', { timeout: 10000 });
      await page.close();
      return;
    } catch {
      await page.close();
      // Session expired — create a fresh one below
    }
  }

  // Fresh login using @clerk/testing
  const page = await context.newPage();

  // Navigate to a page that loads Clerk (required before signIn)
  await page.goto(`${config.baseUrl}/dashboard/login`);

  // Set up testing token — this allows Clerk to render in Playwright
  await setupClerkTestingToken({ page });

  // Wait for Clerk to load
  await clerk.loaded({ page });

  // Sign in using email-based ticket strategy (no form needed)
  await clerk.signIn({
    page,
    emailAddress: credentials.email,
  });

  // Navigate to dashboard and wait for it to load
  await page.goto(`${config.baseUrl}/dashboard/dashboard`, { waitUntil: 'networkidle' });
  await page.waitForSelector('[data-testid="layout.nav.dashboard"]', { timeout: 15000 });

  // Cache the auth state
  fs.mkdirSync(config.authStatesDir, { recursive: true });
  const storageState = await context.storageState();
  fs.writeFileSync(stateFile, JSON.stringify(storageState));

  await page.close();
}
