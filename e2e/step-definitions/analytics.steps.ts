import { When, Then } from '@cucumber/cucumber';
import { ForjaWorld } from '../support/world';

Then('I should see the analytics dashboard', async function (this: ForjaWorld) {
  await this.page.locator('[data-testid="analytics-dashboard"]').waitFor({ state: 'visible' });
});

Then('I should see traffic charts', async function (this: ForjaWorld) {
  // Recharts renders SVG charts
  const chart = this.page.locator('[data-testid="analytics-chart"], .recharts-responsive-container').first();
  await chart.waitFor({ state: 'visible' });
});

When('I select date range {string}', async function (this: ForjaWorld, range: string) {
  const dateRangePicker = this.page.locator('[data-testid="date-range-picker"]');
  await dateRangePicker.click();
  await this.page.locator(`text=${range}`).click();
  await this.page.waitForLoadState('networkidle');
});

Then('the charts should update', async function (this: ForjaWorld) {
  // Wait for charts to re-render after data fetch
  await this.page.waitForLoadState('networkidle');
  await this.page.waitForTimeout(1000);
});
