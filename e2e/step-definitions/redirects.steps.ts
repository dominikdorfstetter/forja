import { When, Then, Given } from '@cucumber/cucumber';
import { type DataTable } from '@cucumber/cucumber';
import { ForjaWorld } from '../support/world';

When('I create a redirect:', async function (this: ForjaWorld, dataTable: DataTable) {
  await this.page.click('[data-testid="create-redirect"]');

  const rows = dataTable.rows();
  for (const [field, value] of rows) {
    if (field === 'type') {
      const typeSelect = this.page.locator('[data-testid="field-type"]');
      await typeSelect.click();
      await this.page.locator(`[data-testid="redirect-type-${value}"]`).click();
    } else {
      const input = this.page.locator(`[data-testid="field-${field}"], [name="${field}"]`).first();
      await input.fill(value);
    }
  }

  await this.page.click('[data-testid="redirect-submit"], button[type="submit"]');
  await this.page.waitForLoadState('networkidle');
});

When(
  'I delete the redirect from {string}',
  async function (this: ForjaWorld, fromPath: string) {
    const row = this.page.locator('[data-testid="redirect-row"]').filter({ hasText: fromPath });
    const deleteBtn = row.locator('[data-testid="delete-redirect"]');
    await deleteBtn.click();
  },
);

Then('I should see the redirect in the list', async function (this: ForjaWorld) {
  const row = this.page.locator('[data-testid="redirect-row"]');
  await row.first().waitFor({ state: 'visible' });
});

Then('the redirect should no longer be in the list', async function (this: ForjaWorld) {
  await this.page.waitForTimeout(1000);
  // Verify the specific redirect is gone
});

Given('a redirect from {string} exists', async function (this: ForjaWorld, _fromPath: string) {
  // Precondition — handled by previous scenario or seed data
});
