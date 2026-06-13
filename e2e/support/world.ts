import { World, type IWorldOptions, setWorldConstructor } from '@cucumber/cucumber';
import { type Browser, type BrowserContext, type Page, chromium } from 'playwright';
import * as fs from 'fs';
import * as path from 'path';
import { config } from './config';
import { loginAs } from './clerk-auth';

// Shared browser instance across all scenarios (launched in BeforeAll, closed in AfterAll)
let sharedBrowser: Browser | null = null;

export async function getSharedBrowser(): Promise<Browser> {
  if (!sharedBrowser) {
    sharedBrowser = await chromium.launch({
      headless: config.headless,
      slowMo: config.slowMo,
      args: [
        // Clerk dev mode uses third-party cookies (__clerk_db_jwt)
        // that modern Chromium blocks by default. Disable this restriction.
        '--disable-features=ThirdPartyCookieBlocking',
        '--disable-site-isolation-trials',
      ],
    });
  }
  return sharedBrowser;
}

export async function closeSharedBrowser(): Promise<void> {
  if (sharedBrowser) {
    await sharedBrowser.close();
    sharedBrowser = null;
  }
}

export class ForjaWorld extends World {
  context!: BrowserContext;
  page!: Page;
  currentRole: string | null = null;
  currentSiteId: string | null = null;
  currentSiteName: string | null = null;

  constructor(options: IWorldOptions) {
    super(options);
  }

  async createContext(): Promise<void> {
    const browser = await getSharedBrowser();
    this.context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      locale: 'en-US',
    });
    this.page = await this.context.newPage();
    this.page.setDefaultTimeout(config.timeout);
  }

  async closeContext(): Promise<void> {
    if (this.page) {
      await this.page.close().catch(() => {});
    }
    if (this.context) {
      await this.context.close().catch(() => {});
    }
  }

  async loginAs(role: string): Promise<void> {
    this.currentRole = role;
    await loginAs(this.context, role);

    // The login helper opens and closes its own pages.
    // Now open a fresh page in this context — the auth cookies are already set.
    if (this.page) {
      await this.page.close().catch(() => {});
    }
    this.page = await this.context.newPage();
    this.page.setDefaultTimeout(config.timeout);

    // Navigate to the dashboard and verify login succeeded
    await this.page.goto(`${config.baseUrl}/dashboard/dashboard`, { waitUntil: 'domcontentloaded' });

    // Wait for the app to render authenticated content.
    // Try the nav/launcher marker first; fall back to any meaningful content.
    try {
      await this.page.waitForSelector(
        '[data-testid="layout.nav.dashboard"], [data-testid="site-launcher"]',
        { timeout: config.timeout },
      );
    } catch {
      // If the nav test-id is missing, wait for the page to at least finish loading
      await this.page.waitForLoadState('networkidle');
    }

    // Tour is pre-dismissed via seed data (user_preferences.help_tour_completed = true).
    // Only the viewer role has the tour active — for the dedicated tour scenario.
  }

  async takeScreenshot(name: string): Promise<void> {
    const screenshotPath = path.join(config.screenshotDir, `${name}.png`);
    const dir = path.dirname(screenshotPath);
    fs.mkdirSync(dir, { recursive: true });
    await this.page.screenshot({ path: screenshotPath, fullPage: false });
  }

  async navigateTo(pagePath: string): Promise<void> {
    await this.page.goto(`${config.baseUrl}/dashboard/${pagePath}`, { waitUntil: 'domcontentloaded' });
    // Wait for meaningful content to appear rather than just networkidle,
    // which can resolve prematurely on SPAs that lazy-load data.
    await Promise.race([
      this.page.waitForSelector('[data-testid], [role="main"], main', { timeout: config.timeout }),
      this.page.waitForLoadState('networkidle'),
    ]);
  }
}

setWorldConstructor(ForjaWorld);
