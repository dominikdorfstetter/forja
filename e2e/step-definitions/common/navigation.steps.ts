import { When, Then, Given } from '@cucumber/cucumber';
import { ForjaWorld } from '../../support/world';
import { config } from '../../support/config';

// Map friendly page names to URL paths
const pageRoutes: Record<string, string> = {
  dashboard: 'dashboard',
  sites: 'sites',
  blogs: 'blogs',
  pages: 'pages',
  media: 'media',
  documents: 'documents',
  legal: 'legal',
  cv: 'cv',
  navigation: 'navigation',
  taxonomy: 'taxonomy',
  'social-links': 'social-links',
  redirects: 'redirects',
  webhooks: 'webhooks',
  'api-keys': 'api-keys',
  members: 'members',
  'clerk-users': 'clerk-users',
  analytics: 'analytics',
  activity: 'activity',
  notifications: 'notifications',
  settings: 'settings',
  profile: 'profile',
  'my-drafts': 'my-drafts',
};

When('I navigate to {string}', async function (this: ForjaWorld, pageName: string) {
  const route = pageRoutes[pageName] ?? pageName;
  await this.navigateTo(route);

  // After navigating, wait for the page content to stabilise.
  // Look for a heading, a data-testid, or the main content area.
  await this.page
    .locator('[role="main"] *, main *, [data-testid]')
    .first()
    .waitFor({ state: 'visible', timeout: 10000 })
    .catch(() => {
      // Acceptable — some pages may have no matching selector during load
    });
});

Given('I am on site {string}', async function (this: ForjaWorld, siteName: string) {
  this.currentSiteName = siteName;
  await this.page.waitForLoadState('domcontentloaded');

  // Fast path: the sidebar already shows the target site.
  const sidebarName = this.page.locator('[data-testid="layout.site-name"]');
  if (
    (await sidebarName.isVisible().catch(() => false)) &&
    (await sidebarName.textContent())?.includes(siteName)
  ) {
    return;
  }

  // Otherwise enter it from the launcher. With more than one site nothing
  // auto-selects, so picking the card is the canonical way in; with a single
  // site the launcher auto-redirects straight to its dashboard.
  await this.page.goto(`${config.baseUrl}/dashboard/sites`, { waitUntil: 'domcontentloaded' });
  const card = this.page
    .locator('[data-testid^="site-card-"]')
    .filter({ hasText: siteName })
    .first();
  const dashboardNav = this.page.locator('[data-testid="layout.nav.dashboard"]');

  // Race: the launcher card (multi-site) or the dashboard (auto-entered).
  await Promise.race([
    card.waitFor({ state: 'visible', timeout: config.timeout }),
    dashboardNav.waitFor({ state: 'visible', timeout: config.timeout }),
  ]).catch(() => {});

  if (await card.isVisible().catch(() => false)) {
    await card.click();
  }
  await dashboardNav.waitFor({ state: 'visible', timeout: config.timeout });
});

When('I navigate to site {string}', async function (this: ForjaWorld, siteName: string) {
  this.currentSiteName = siteName;
  await this.navigateTo('sites');
  await this.page.locator(`text=${siteName}`).click();
  await this.page.waitForLoadState('networkidle');
});

Then('I should see the dashboard', async function (this: ForjaWorld) {
  // system_admin has no site membership, so its post-login surface is the
  // site launcher rather than a site dashboard.
  await this.page.waitForSelector(
    '[data-testid="layout.nav.dashboard"], [data-testid="site-launcher"]',
  );
});

Then('I should be redirected to the login page', async function (this: ForjaWorld) {
  // Unauthenticated users may land on /login, /sign-in, or the signed-out
  // Welcome surface (whose hero offers "Log in" / "Sign up").
  await this.page.waitForLoadState('networkidle');
  const onLoginPage = this.page.url().includes('/login') || this.page.url().includes('/sign-in');
  if (onLoginPage) return;

  const signInBtn = this.page.getByRole('button', { name: /sign in|log in/i })
    .or(this.page.getByRole('link', { name: /sign in|log in/i }));
  await signInBtn.first().waitFor({ state: 'visible', timeout: 10000 });
});

Then('I should be redirected to the sites list', async function (this: ForjaWorld) {
  await this.page.waitForURL('**/sites');
});

Then('I should not see {string} in the navigation', async function (this: ForjaWorld, itemText: string) {
  const navItem = this.page.locator('nav[aria-label="Main navigation"]').locator(`text=${itemText}`);
  await navItem.waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {});
  const isVisible = await navItem.isVisible();
  if (isVisible) {
    throw new Error(`Expected nav item "${itemText}" to be hidden but it is visible`);
  }
});

Then('I should not see {string} in the global navigation', async function (this: ForjaWorld, itemText: string) {
  const navItem = this.page.locator('nav[aria-label="Main navigation"]').locator(`text=${itemText}`);
  await navItem.waitFor({ state: 'hidden', timeout: 3000 }).catch(() => {});
  const isVisible = await navItem.isVisible();
  if (isVisible) {
    throw new Error(`Expected global nav item "${itemText}" to be hidden but it is visible`);
  }
});
