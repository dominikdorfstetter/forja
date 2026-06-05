import { When, Then } from '@cucumber/cucumber';
import { type DataTable } from '@cucumber/cucumber';
import { ForjaWorld } from '../support/world';

When('I add a social link:', async function (this: ForjaWorld, dataTable: DataTable) {
  await this.page.click('[data-testid="add-social-link"]');

  const rows = dataTable.rows();
  for (const [field, value] of rows) {
    if (field === 'platform') {
      const platformSelect = this.page.locator('[data-testid="field-platform"]');
      await platformSelect.click();
      await this.page.locator(`text=${value}`).click();
    } else {
      const input = this.page.locator(`[data-testid="field-${field}"], [name="${field}"]`).first();
      await input.fill(value);
    }
  }

  await this.page.click('[data-testid="social-link-submit"], button[type="submit"]');
  await this.page.waitForLoadState('networkidle');
});

When('I save social links', async function (this: ForjaWorld) {
  await this.page.click('[data-testid="save-social-links"], button[type="submit"]');
  await this.page.waitForLoadState('networkidle');
});

Then(
  'I should see {string} in the social links list',
  async function (this: ForjaWorld, platform: string) {
    const entry = this.page.locator('[data-testid="social-link-row"]').filter({ hasText: platform });
    await entry.waitFor({ state: 'visible' });
  },
);
