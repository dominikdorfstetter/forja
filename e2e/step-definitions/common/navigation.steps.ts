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

  // Wait briefly for the layout to settle so the selector can appear
  await this.page.waitForLoadState('domcontentloaded');

  const siteSelector = this.page.locator('[data-testid="layout.site-selector"]');

  // Give the selector a moment to render (it may not exist if there is only one site)
  const isSelectorVisible = await siteSelector
    .waitFor({ state: 'visible', timeout: 5000 })
    .then(() => true)
    .catch(() => false);

  if (isSelectorVisible) {
    // Check whether the desired site is already selected
    const currentText = await siteSelector.textContent();
    if (currentText?.includes(siteName)) {
      // Already on the right site — nothing to do
      return;
    }

    await siteSelector.click();
    await this.page
      .locator('[data-testid="layout.site-option"]')
      .filter({ hasText: siteName })
      .click();
    await this.page.waitForLoadState('networkidle');
  }
  // If the selector is not visible there is only one site — assume it matches
});

When('I navigate to site {string}', async function (this: ForjaWorld, siteName: string) {
  this.currentSiteName = siteName;
  await this.navigateTo('sites');
  await this.page.locator(`text=${siteName}`).click();
  await this.page.waitForLoadState('networkidle');
});

Then('I should see the dashboard', async function (this: ForjaWorld) {
  await this.page.waitForSelector('[data-testid="layout.nav.dashboard"]');
});

Then('I should be redirected to the login page', async function (this: ForjaWorld) {
  // Unauthenticated users may land on /login, /sign-in, or a landing page
  // The landing page has "Sign In" and "Create Account" buttons
  await this.page.waitForLoadState('networkidle');
  const onLoginPage = this.page.url().includes('/login') || this.page.url().includes('/sign-in');
  if (onLoginPage) return;

  // Check for landing page with sign-in option
  const signInBtn = this.page.getByRole('button', { name: /sign in/i })
    .or(this.page.getByRole('link', { name: /sign in/i }));
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
