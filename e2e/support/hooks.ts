import { Before, After, BeforeAll, AfterAll, Status, setDefaultTimeout } from '@cucumber/cucumber';
import * as fs from 'fs';
import * as path from 'path';
import { clerkSetup } from '@clerk/testing/playwright';
import { ForjaWorld, getSharedBrowser, closeSharedBrowser } from './world';
import { config } from './config';

// Clerk login + page load can take 15-30s on first run
setDefaultTimeout(config.timeout);

BeforeAll(async function () {
  // Clean auth states from previous runs
  if (fs.existsSync(config.authStatesDir)) {
    fs.rmSync(config.authStatesDir, { recursive: true });
  }

  // Initialize Clerk testing — sets CLERK_FAPI and CLERK_TESTING_TOKEN env vars
  await clerkSetup({ publishableKey: config.clerkPublishableKey });

  // Launch the shared browser
  await getSharedBrowser();

  // Ensure screenshot output directory exists
  fs.mkdirSync(config.screenshotDir, { recursive: true });
});

Before(async function (this: ForjaWorld) {
  await this.createContext();
});

After(async function (this: ForjaWorld, scenario) {
  // On failure, take a debug screenshot
  if (scenario.result?.status === Status.FAILED) {
    const failDir = path.join(config.screenshotDir, '_failures');
    fs.mkdirSync(failDir, { recursive: true });

    const scenarioName = scenario.pickle.name;
    const safeName = scenarioName
      .replace(/[^a-zA-Z0-9]/g, '-')
      .replace(/-+/g, '-')
      .toLowerCase()
      .slice(0, 80);

    const screenshotPath = path.join(failDir, `${safeName}.png`);
    try {
      await this.page.screenshot({ path: screenshotPath, fullPage: true });
      this.attach(`Failure screenshot: ${screenshotPath}`, 'text/plain');
    } catch {
      // Page may already be closed
    }
  }

  await this.closeContext();
});

AfterAll(async function () {
  await closeSharedBrowser();
});
