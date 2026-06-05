import { Given, When, Then } from '@cucumber/cucumber';
import { ForjaWorld } from '../../support/world';
import { config } from '../../support/config';

Given('I am logged in as {string}', async function (this: ForjaWorld, role: string) {
  await this.loginAs(role);
});

Given('I am on the login page', async function (this: ForjaWorld) {
  await this.page.goto(`${config.baseUrl}/dashboard/login`);
  await this.page.waitForLoadState('networkidle');
});

Given('I am not logged in', async function (this: ForjaWorld) {
  // Clear all cookies and storage to ensure unauthenticated state
  await this.context.clearCookies();
  await this.page.goto(`${config.baseUrl}/dashboard/login`);
});

When('I log in as {string}', async function (this: ForjaWorld, role: string) {
  await this.loginAs(role);
});

When('I reload the page', async function (this: ForjaWorld) {
  await this.page.reload();
  await this.page.waitForLoadState('networkidle');
});

When('I log out', async function (this: ForjaWorld) {
  await this.page.click('[data-testid="layout.btn.logout"]');
  await this.page.waitForURL('**/login**');
  this.currentRole = null;
});

Then('I should be logged out', async function (this: ForjaWorld) {
  await this.page.waitForURL('**/login**');
});

Then('I should still be on the dashboard', async function (this: ForjaWorld) {
  await this.page.waitForSelector('[data-testid="layout.nav.dashboard"]');
});
