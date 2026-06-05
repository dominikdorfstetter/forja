import { Then } from '@cucumber/cucumber';
import { ForjaWorld } from '../../support/world';

Then('I should see {string}', async function (this: ForjaWorld, text: string) {
  await this.page.locator(`text=${text}`).first().waitFor({ state: 'visible', timeout: 10000 });
});

Then('I should not see {string}', async function (this: ForjaWorld, text: string) {
  const locator = this.page.locator(`text=${text}`).first();

  // First, wait for the page to settle (loading spinners, transitions, etc.)
  await this.page.waitForLoadState('domcontentloaded');

  // Try to wait for the element to be hidden/detached (handles the case where
  // text appears briefly during loading and then disappears)
  try {
    await locator.waitFor({ state: 'hidden', timeout: 5000 });
  } catch {
    // If it timed out waiting for hidden, it is still visible — that is a failure
    const isVisible = await locator.isVisible().catch(() => false);
    if (isVisible) {
      throw new Error(`Expected text "${text}" to not be visible, but it was found on the page`);
    }
  }
});

Then('I should see a validation error for {string}', async function (this: ForjaWorld, field: string) {
  // MUI form fields show errors via aria-invalid or helper text
  const fieldError = this.page.locator(
    `[data-testid="${field}-error"], [id="${field}-helper-text"], .Mui-error`,
  ).first();
  await fieldError.waitFor({ state: 'visible', timeout: 5000 });
});

Then('I should see an error about {string}', async function (this: ForjaWorld, errorText: string) {
  await this.page.locator(`text=${errorText}`).first().waitFor({ state: 'visible', timeout: 5000 });
});

Then('the editor should be read-only', async function (this: ForjaWorld) {
  const editor = this.page.locator('[data-testid="editor-content"]');
  const isEditable = await editor.getAttribute('contenteditable');
  if (isEditable === 'true') {
    throw new Error('Expected editor to be read-only but it is editable');
  }
});
