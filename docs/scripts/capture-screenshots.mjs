#!/usr/bin/env node
/**
 * Capture documentation screenshots from the running admin app.
 *
 * Reads `screenshot-manifest.json` and writes PNGs into
 * `docs/static/img/screenshots/`.
 *
 * Auth model: the script opens its own Chrome window and waits for YOU to log in
 * once (you type your own credentials — the script never handles passwords). The
 * session is stored in a dedicated, reusable profile dir, so subsequent runs skip
 * the login and can run headless.
 *
 * Prerequisites
 *   1. The admin dev server is running on http://localhost:3000/dashboard
 *      (or set BASE_URL to override the manifest baseUrl).
 *   2. You can log in as an Owner/Admin on a site that has seeded content
 *      (the demo "John Forja" site is ideal).
 *
 * Run (from anywhere):
 *   node docs/scripts/capture-screenshots.mjs            # first run: log in when the window opens
 *   HEADLESS=1 node docs/scripts/capture-screenshots.mjs # later runs: reuse the saved session
 *
 * Env:
 *   BASE_URL        override the manifest baseUrl
 *   PROFILE_DIR     where to persist the login session (default: a temp dir)
 *   HEADLESS=1      run headless (only works after a prior interactive login)
 *   ONLY=<substr>   capture only shots whose `out` contains the substring
 *   LOGIN_TIMEOUT   seconds to wait for login (default 300)
 *
 * Playwright is resolved from e2e/node_modules so no extra install is needed.
 */

import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { dirname, resolve, join } from 'node:path';
import { mkdir, readFile } from 'node:fs/promises';
import os from 'node:os';

const __dirname = dirname(fileURLToPath(import.meta.url));
const repoRoot = resolve(__dirname, '..', '..');

const require = createRequire(join(repoRoot, 'e2e', 'package.json'));
let chromium;
try {
  ({ chromium } = require('playwright'));
} catch {
  console.error('Could not load Playwright from e2e/node_modules. Run `npm install` in e2e/ first.');
  process.exit(1);
}

// sharp converts the PNG buffers Playwright produces into WebP. It ships with
// the docs site's @docusaurus/plugin-ideal-image, so resolve it from there.
const docsRequire = createRequire(join(repoRoot, 'docs', 'package.json'));
let sharp;
try {
  sharp = docsRequire('sharp');
} catch {
  console.error('Could not load sharp from docs/node_modules. Run `npm install` in docs/ first.');
  process.exit(1);
}

const manifest = JSON.parse(await readFile(join(__dirname, 'screenshot-manifest.json'), 'utf8'));
const baseUrl = (process.env.BASE_URL || manifest.baseUrl).replace(/\/$/, '');
const profileDir = process.env.PROFILE_DIR || join(os.tmpdir(), 'forja-docs-screenshot-profile');
const headless = process.env.HEADLESS === '1';
const only = process.env.ONLY;
const loginTimeout = Number(process.env.LOGIN_TIMEOUT || 300) * 1000;
const outRoot = join(repoRoot, 'docs', 'static', 'img', 'screenshots');
const shots = manifest.shots.filter((s) => !only || s.out.includes(only));
const AUTHED = '[data-testid="dashboard.page"]';

console.log(`Capturing ${shots.length} screenshot(s) from ${baseUrl}`);
console.log(`  session profile: ${profileDir}\n`);

// Theme for the captures. The admin persists its theme in localStorage under
// 'theme-preference'; 'm3Dark' is the M3 Expressive Dark theme. Override with THEME.
const theme = process.env.THEME || 'm3Dark';
const darkThemes = new Set(['m3Dark', 'frappe', 'macchiato', 'mocha']);

const context = await chromium.launchPersistentContext(profileDir, {
  channel: 'chrome',
  headless,
  viewport: { width: 1440, height: 900 },
  deviceScaleFactor: 1,
  colorScheme: darkThemes.has(theme) ? 'dark' : 'light',
  // Reduce the automation fingerprint so the login provider doesn't flag the
  // window as an "insecure browser". (Some SSO providers, e.g. Google, still
  // block automated browsers — prefer email/password or email-code login.)
  ignoreDefaultArgs: ['--enable-automation'],
  // --disable-extensions keeps any installed browser extension (e.g. a floating
  // assistant button) out of the captured screenshots.
  args: [
    '--disable-blink-features=AutomationControlled',
    '--no-default-browser-check',
    '--disable-extensions',
  ],
});
// Force the admin theme before any page script reads localStorage.
await context.addInitScript((t) => {
  try {
    localStorage.setItem('theme-preference', t);
  } catch {
    /* localStorage unavailable */
  }
}, theme);

const page = context.pages()[0] ?? (await context.newPage());

// --- Ensure we're logged in --------------------------------------------------
await page.goto(`${baseUrl}/`, { waitUntil: 'networkidle', timeout: 30000 });
// Give the SPA a moment to hydrate before deciding we're logged out — a valid
// session may simply not have rendered the workbench yet.
const authed = await page
  .waitForSelector(AUTHED, { state: 'visible', timeout: 15000 })
  .then(() => true)
  .catch(() => false);
if (!authed) {
  if (headless) {
    console.error(
      'Not logged in and running headless. Run once without HEADLESS=1 and log in,\n' +
        'then re-run with HEADLESS=1.',
    );
    await context.close();
    process.exit(1);
  }
  console.log('➡  Log in as an Owner/Admin in the Chrome window that just opened,');
  console.log('   and make sure your seeded site is selected (you should see the workbench).');
  console.log(`   Waiting up to ${loginTimeout / 1000}s …\n`);
  await page.waitForSelector(AUTHED, { state: 'visible', timeout: loginTimeout });
  console.log('✓  Logged in — capturing.\n');
}

// --- Capture -----------------------------------------------------------------
let failures = 0;
for (const shot of shots) {
  const url = `${baseUrl}${shot.path}`;
  try {
    await page.goto(url, { waitUntil: 'networkidle', timeout: 30000 });
    if (shot.waitFor) await page.waitForSelector(shot.waitFor, { state: 'visible', timeout: 20000 });
    if (shot.clickText) {
      await page.getByText(shot.clickText, { exact: false }).first().click();
      if (shot.thenWaitFor) await page.waitForSelector(shot.thenWaitFor, { state: 'visible', timeout: 20000 });
    }
    await page.waitForTimeout(600);
    // Hide the TanStack Query Devtools floating button (dev-only) so it stays
    // out of the screenshots.
    await page
      .addStyleTag({ content: '[class*="tsqd-"]{display:none !important;}' })
      .catch(() => {});

    const outPath = join(outRoot, shot.out);
    await mkdir(dirname(outPath), { recursive: true });
    const target = shot.clipMain ? page.locator('#main-content') : page;
    const png = await target.screenshot(); // Playwright returns a PNG buffer
    await sharp(png).webp({ quality: 82 }).toFile(outPath);
    console.log(`  ✓ ${shot.out}`);
  } catch (err) {
    failures += 1;
    console.error(`  ✗ ${shot.out}  (${url})\n      ${err.message.split('\n')[0]}`);
  }
}

await context.close();
console.log(`\nDone. ${shots.length - failures} captured, ${failures} failed.`);
process.exit(failures > 0 ? 1 : 0);
