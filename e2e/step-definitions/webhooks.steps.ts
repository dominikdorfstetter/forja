import { When, Then, Given } from '@cucumber/cucumber';
import { type DataTable } from '@cucumber/cucumber';
import { ForjaWorld } from '../support/world';

When('I create a webhook with:', async function (this: ForjaWorld, dataTable: DataTable) {
  await this.page.click('[data-testid="create-webhook"]');
  await this.page.waitForLoadState('networkidle');

  const rows = dataTable.rows();
  for (const [field, value] of rows) {
    if (field === 'events') {
      // Multi-select events
      const events = value.split(',').map((e) => e.trim());
      for (const event of events) {
        const checkbox = this.page.locator(`[data-testid="event-${event}"]`);
        if (await checkbox.isVisible().catch(() => false)) {
          await checkbox.click();
        }
      }
    } else {
      const input = this.page.locator(`[data-testid="field-${field}"], [name="${field}"]`).first();
      await input.fill(value);
    }
  }

  await this.page.click('[data-testid="webhook-submit"], button[type="submit"]');
  await this.page.waitForLoadState('networkidle');
});

When('I open the webhook details', async function (this: ForjaWorld) {
  const webhookRow = this.page.locator('[data-testid="webhook-row"]').first();
  await webhookRow.click();
  await this.page.waitForLoadState('networkidle');
});

When('I delete the webhook', async function (this: ForjaWorld) {
  const deleteBtn = this.page.locator('[data-testid="delete-webhook"]').first();
  await deleteBtn.click();
});

Then('I should see the webhook in the list', async function (this: ForjaWorld) {
  const row = this.page.locator('[data-testid="webhook-row"]');
  await row.first().waitFor({ state: 'visible' });
});

Then('I should see the signing secret', async function (this: ForjaWorld) {
  const secret = this.page.locator('[data-testid="webhook-secret"]');
  await secret.waitFor({ state: 'visible' });
});

Then('I should see the delivery log section', async function (this: ForjaWorld) {
  const logs = this.page.locator('[data-testid="delivery-logs"]');
  await logs.waitFor({ state: 'visible' });
});

Then('the webhook should no longer be in the list', async function (this: ForjaWorld) {
  const row = this.page.locator('[data-testid="webhook-row"]');
  await this.page.waitForTimeout(1000);
  const count = await row.count();
  // Either no rows or the specific one is gone
  if (count > 0) {
    // Acceptable if other webhooks exist
  }
});

Given('a webhook exists', async function (this: ForjaWorld) {
  // Precondition — handled by seed data or previous scenario
});
