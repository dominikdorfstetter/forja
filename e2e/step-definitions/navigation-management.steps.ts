import { When, Then, Given } from '@cucumber/cucumber';
import { type DataTable } from '@cucumber/cucumber';
import { ForjaWorld } from '../support/world';

When('I add a navigation item:', async function (this: ForjaWorld, dataTable: DataTable) {
  await this.page.click('[data-testid="add-nav-item"]');

  const rows = dataTable.rows();
  for (const [field, value] of rows) {
    const input = this.page.locator(`[data-testid="field-${field}"], [name="${field}"]`).first();
    await input.fill(value);
  }

  await this.page.click('[data-testid="nav-item-submit"], button[type="submit"]');
  await this.page.waitForLoadState('networkidle');
});

When('I save navigation', async function (this: ForjaWorld) {
  await this.page.click('[data-testid="save-navigation"], button[type="submit"]');
  await this.page.waitForLoadState('networkidle');
});

When(
  'I drag {string} above {string}',
  async function (this: ForjaWorld, item: string, target: string) {
    const sourceRow = this.page.locator('[data-testid="nav-row"]').filter({ hasText: item });
    const targetRow = this.page.locator('[data-testid="nav-row"]').filter({ hasText: target });

    const sourceBbox = await sourceRow.boundingBox();
    const targetBbox = await targetRow.boundingBox();

    if (sourceBbox && targetBbox) {
      await this.page.mouse.move(
        sourceBbox.x + sourceBbox.width / 2,
        sourceBbox.y + sourceBbox.height / 2,
      );
      await this.page.mouse.down();
      await this.page.mouse.move(
        targetBbox.x + targetBbox.width / 2,
        targetBbox.y - 5,
      );
      await this.page.mouse.up();
    }
  },
);

When('I delete navigation item {string}', async function (this: ForjaWorld, itemLabel: string) {
  const row = this.page.locator('[data-testid="nav-row"]').filter({ hasText: itemLabel });
  const deleteBtn = row.locator('[data-testid="delete-nav-item"]');
  await deleteBtn.click();
});

Then(
  'I should see {string} in the navigation list',
  async function (this: ForjaWorld, label: string) {
    const row = this.page.locator('[data-testid="nav-row"]').filter({ hasText: label });
    await row.waitFor({ state: 'visible' });
  },
);

Then(
  '{string} should appear before {string}',
  async function (this: ForjaWorld, first: string, second: string) {
    const rows = this.page.locator('[data-testid="nav-row"]');
    const texts: string[] = [];
    const count = await rows.count();
    for (let i = 0; i < count; i++) {
      texts.push((await rows.nth(i).textContent()) ?? '');
    }
    const firstIdx = texts.findIndex((t) => t.includes(first));
    const secondIdx = texts.findIndex((t) => t.includes(second));
    if (firstIdx >= secondIdx) {
      throw new Error(`Expected "${first}" (index ${firstIdx}) to appear before "${second}" (index ${secondIdx})`);
    }
  },
);

Then(
  '{string} should no longer be in the navigation list',
  async function (this: ForjaWorld, label: string) {
    const row = this.page.locator('[data-testid="nav-row"]').filter({ hasText: label });
    await this.page.waitForTimeout(1000);
    const isVisible = await row.isVisible().catch(() => false);
    if (isVisible) {
      throw new Error(`Expected "${label}" to be removed from navigation but still visible`);
    }
  },
);

Given('navigation items exist', async function (this: ForjaWorld) {
  // Precondition — handled by seed data
});
