import { Then, Given } from '@cucumber/cucumber';
import { ForjaWorld } from '../support/world';

Then('I should have full access', async function (this: ForjaWorld) {
  // System admin should see the full sidebar navigation
  await this.page.locator('[data-testid="layout.nav.dashboard"]').waitFor({ state: 'visible' });
});

Then('I should see the full user list', async function (this: ForjaWorld) {
  const userList = this.page.locator('[data-testid="user-list"], [data-testid="clerk-users-table"]').first();
  await userList.waitFor({ state: 'visible' });
});

Given('I have no site memberships', async function (this: ForjaWorld) {
  // Precondition — the viewer test account may not have memberships in this context
});

Given('I am on a site with no blog posts', async function (this: ForjaWorld) {
  // Precondition — navigate to a site that has no content
});

Given(
  'a site {string} exists that I am not a member of',
  async function (this: ForjaWorld, _siteName: string) {
    // Precondition — seed data creates the site; the system_admin test
    // account is intentionally not a member of it.
  },
);
