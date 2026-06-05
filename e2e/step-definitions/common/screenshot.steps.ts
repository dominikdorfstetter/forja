import { Then } from '@cucumber/cucumber';
import { ForjaWorld } from '../../support/world';

Then('I take a screenshot {string}', async function (this: ForjaWorld, name: string) {
  // Small delay to ensure animations have completed
  await this.page.waitForTimeout(500);
  await this.takeScreenshot(name);
});
