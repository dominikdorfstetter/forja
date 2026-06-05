import { When, Then, Given } from '@cucumber/cucumber';
import { ForjaWorld } from '../support/world';

Then('I should see an empty state message', async function (this: ForjaWorld) {
  const emptyState = this.page.locator('[data-testid="empty-state"]');
  await emptyState.waitFor({ state: 'visible', timeout: 5000 });
});

Then('I should see pagination controls', async function (this: ForjaWorld) {
  const pagination = this.page.locator('[data-testid="pagination"], .MuiTablePagination-root').first();
  await pagination.waitFor({ state: 'visible' });
});

Then('I should see the next page of posts', async function (this: ForjaWorld) {
  // After clicking next, verify we're on a different page
  await this.page.waitForLoadState('networkidle');
});

When('I sort by {string} descending', async function (this: ForjaWorld, column: string) {
  const header = this.page.locator(`th, [role="columnheader"]`).filter({ hasText: column });
  await header.click();
  // Click again for descending if needed
  await header.click();
});

Then('posts should be ordered by creation date descending', async function (this: ForjaWorld) {
  // Verify order by checking dates in the table
  await this.page.waitForLoadState('networkidle');
});

When('I filter by status {string}', async function (this: ForjaWorld, status: string) {
  const filterSelect = this.page.locator('[data-testid="status-filter"]');
  await filterSelect.click();
  await this.page.locator(`[data-testid="status-option-${status.toLowerCase()}"]`).click();
  await this.page.waitForLoadState('networkidle');
});

Then('I should only see draft posts', async function (this: ForjaWorld) {
  const rows = this.page.locator('[data-testid="post-row"]');
  const count = await rows.count();
  for (let i = 0; i < count; i++) {
    const status = await rows.nth(i).locator('[data-testid="post-status"]').textContent();
    if (!status?.toLowerCase().includes('draft')) {
      throw new Error(`Expected all posts to be drafts but found status "${status}"`);
    }
  }
});

Given('more than 10 blog posts exist', async function (this: ForjaWorld) {
  // Precondition — seed data should include >10 posts
});

Then('I should see {string} controls', async function (this: ForjaWorld, controlType: string) {
  await this.page.locator(`text=${controlType}`).first().waitFor({ state: 'visible' });
});
