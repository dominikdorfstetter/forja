import { When, Then, Given } from '@cucumber/cucumber';
import assert from 'node:assert/strict';
import { ForjaWorld } from '../support/world';
import { config } from '../support/config';

// Fixed identifiers from scripts/seed-test-data.sql — the seeded test site
// and the deterministic read-only API key for public-view assertions.
const SEED_SITE_ID = 'a0000000-0000-0000-0000-000000000001';
const SEED_READ_API_KEY = 'dk_e2etest1_0123456789abcdef0123456789abcdef';

When(
  'I create a blog post titled {string} from scratch',
  async function (this: ForjaWorld, title: string) {
    await this.page.locator('[data-testid="create-post"]').click();
    const dialog = this.page.locator('[role="dialog"]', { hasText: 'Create Blog' });
    await dialog.waitFor({ state: 'visible' });
    await dialog.locator('text=From Scratch').click();
    // Step 2: Details — slug auto-derives from the title, author is prefilled.
    await dialog
      .locator('[data-testid="create-blog-wizard.input.title"] input')
      .fill(title);
    await dialog.locator('[data-testid="create-blog-wizard.btn.create"]').click();
    // Creation navigates to the editor page.
    await this.page.locator('[data-testid="forja-editor"]').waitFor({ state: 'visible' });
  },
);

When('I set the post title to {string}', async function (this: ForjaWorld, title: string) {
  // The create wizard's title only seeds the slug — the localized title
  // (which the publish gate requires for the default locale) is set here.
  await this.page
    .locator('[data-testid="field-title"] input, input[data-testid="field-title"]')
    .first()
    .fill(title);
});

When('I write {string} in the editor', async function (this: ForjaWorld, text: string) {
  const editor = this.page.locator('[data-testid="forja-editor"] .ProseMirror').first();
  await editor.click();
  await editor.fill(text);
});

When('I publish the post', async function (this: ForjaWorld) {
  await this.page.locator('[data-testid="publish-post"]').click();
  // A confirmation dialog may ask to confirm the publication.
  const confirm = this.page
    .locator('[role="dialog"]')
    .getByRole('button', { name: /publish|confirm/i })
    .first();
  if (await confirm.isVisible({ timeout: 2000 }).catch(() => false)) {
    await confirm.click();
  }
  await this.page.waitForLoadState('networkidle');
});

Then(
  'the content API serves blog {string} with status {string}',
  async function (slug: string, status: string) {
    // The published view a client site sees: the content API read surface,
    // authenticated with the seeded read-only key.
    const res = await fetch(
      `${config.apiUrl}/api/v1/sites/${SEED_SITE_ID}/blogs?status=${status}`,
      { headers: { 'x-api-key': SEED_READ_API_KEY } },
    );
    assert.equal(res.status, 200, `content API returned ${res.status}`);
    const body = (await res.json()) as { items?: Array<{ slug?: string }>; data?: Array<{ slug?: string }> };
    const items = body.items ?? body.data ?? [];
    assert.ok(
      items.some((b) => b.slug === slug),
      `blog "${slug}" not in the ${status} feed — got ${JSON.stringify(items.map((b) => b.slug))}`,
    );
  },
);

/**
 * Save through the global save bar — the single Save control for content
 * detail pages (#45/#46). The bar appears only while the form is dirty, so we
 * wait for it and click its stable, per-entity Save testid. Fails loudly if the
 * bar (or its Save) is absent: no silent `button[type="submit"]` fallback, so a
 * missing bar is a real failure, not a limp-through (#47).
 */
async function saveViaGlobalBar(world: ForjaWorld, saveTestId: string): Promise<void> {
  const bar = world.page.locator('[data-testid="global-save-bar"]');
  await bar.waitFor({ state: 'visible' });
  await bar.locator(`[data-testid="${saveTestId}"]`).click();
  await world.page.waitForLoadState('networkidle');
}

When('I save as draft', async function (this: ForjaWorld) {
  // No dedicated "save draft" control exists — the global save bar is the single
  // save, and an unpublished (Draft) form saved via the bar IS a draft.
  const bar = this.page.locator('[data-testid="global-save-bar"]');
  await bar.waitFor({ state: 'visible' });
  await bar.getByRole('button', { name: /save/i }).click();
  await this.page.waitForLoadState('networkidle');
});

When('I save the post', async function (this: ForjaWorld) {
  await saveViaGlobalBar(this, 'save-post');
});

When('I save the page', async function (this: ForjaWorld) {
  await saveViaGlobalBar(this, 'save-page');
});

When('I save the document', async function (this: ForjaWorld) {
  await saveViaGlobalBar(this, 'save-document');
});

When('I open post {string}', async function (this: ForjaWorld, title: string) {
  // Posts may render as table rows (data-testid="post-row") or as list items/links.
  // Try the table row pattern first, then fall back to a link with the title text.
  const postRow = this.page.locator('[data-testid="post-row"]').filter({ hasText: title });

  if (await postRow.first().isVisible().catch(() => false)) {
    await postRow.first().click();
  } else {
    // Fall back: look for any link or clickable element containing the title
    const postLink = this.page.getByRole('link', { name: title });
    if (await postLink.isVisible().catch(() => false)) {
      await postLink.click();
    } else {
      // Last resort: click any element with the title text
      await this.page.locator(`text=${title}`).first().click();
    }
  }

  await this.page.waitForLoadState('networkidle');
});

// "I confirm the publication" is handled by the generic "I confirm the {word}" in forms.steps.ts

When('I switch to locale {string}', async function (this: ForjaWorld, locale: string) {
  // Locales are MUI tabs labelled with the uppercased code (EN / DE / …).
  await this.page
    .getByRole('tab', { name: new RegExp(`^${locale}`, 'i') })
    .first()
    .click();
});

Then('the post status should be {string}', async function (this: ForjaWorld, status: string) {
  const statusBadge = this.page.locator(`[data-testid="post-status"]`);
  const text = await statusBadge.textContent();
  if (!text?.toLowerCase().includes(status.toLowerCase())) {
    throw new Error(`Expected post status "${status}" but got "${text}"`);
  }
});

Then(
  'I should see {string} with status {string}',
  async function (this: ForjaWorld, title: string, status: string) {
    const row = this.page.locator(`[data-testid="post-row"]`).filter({ hasText: title });
    await row.waitFor({ state: 'visible' });
    const statusText = await row.locator(`[data-testid="post-status"]`).textContent();
    if (!statusText?.toLowerCase().includes(status.toLowerCase())) {
      throw new Error(`Expected status "${status}" for "${title}" but got "${statusText}"`);
    }
  },
);

Given('the site supports locales {string}', async function (this: ForjaWorld, _locales: string) {
  // Precondition — site should be configured with these locales
});

Given('a page with slug {string} already exists', async function (this: ForjaWorld, _slug: string) {
  // Precondition — handled by seed data or previous test
});
