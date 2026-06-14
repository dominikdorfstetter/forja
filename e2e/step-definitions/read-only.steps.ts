import { Then } from '@cucumber/cucumber';
import assert from 'node:assert/strict';
import { ForjaWorld } from '../support/world';

/**
 * Read-only enforcement (#6). The Layout treatment for `!canWrite` users hides
 * write-action buttons by the `btn.*` data-testid convention (display:none) and
 * makes inputs inert. A viewer must therefore see none of these affordances, and
 * the global save bar — which only appears on a dirty form a viewer cannot
 * produce — must be absent. The real defence is API-side RBAC (403); this gate
 * is the UI half of the double-belt.
 */
const WRITE_CONTROL_SELECTORS = [
  '[data-testid*="btn.create"]',
  '[data-testid*="btn.add"]',
  '[data-testid*="btn.delete"]',
  '[data-testid*="btn.save"]',
  '[data-testid*="btn.submit"]',
  '[data-testid="global-save-bar"]',
];

Then('I should not see any write controls', async function (this: ForjaWorld) {
  for (const selector of WRITE_CONTROL_SELECTORS) {
    const locator = this.page.locator(selector);
    const total = await locator.count();
    let visible = 0;
    for (let i = 0; i < total; i++) {
      if (await locator.nth(i).isVisible()) visible += 1;
    }
    assert.equal(
      visible,
      0,
      `read-only page exposed ${visible} visible write control(s) matching ${selector}`,
    );
  }
});
