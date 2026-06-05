import { h } from '@stencil/core';

/**
 * Self-hosted ALTCHA helpers shared by the form sections (#773).
 *
 * The open-source `<altcha-widget>` custom element solves a server-issued
 * proof-of-work challenge and injects a hidden `altcha` input carrying the
 * solved payload. Forms forward that payload to the API as the submission's
 * `bot_protection_token`. No Sentinel / paid features are involved; the host
 * page registers the widget (e.g. `import 'altcha'`).
 */

/** True once the widget has injected a non-empty solved `altcha` input. */
export function altchaSolved(form: HTMLFormElement): boolean {
  const input = form.querySelector('input[name="altcha"]') as HTMLInputElement | null;
  return !!input && input.value.length > 0;
}

/**
 * Render the ALTCHA widget bound to a per-form challenge endpoint. `testId`
 * lets each section namespace its widget for e2e targeting.
 */
export function renderAltchaWidget(challengeUrl: string | undefined, testId: string) {
  return h('altcha-widget', {
    class: { 'forja-altcha': true },
    name: 'altcha',
    // altcha v3 renamed `challengeurl` → `challenge` (a string is the URL to
    // fetch a fresh challenge from). The old attribute is silently ignored by
    // v3, leaving the widget to fetch the host page instead of the challenge.
    challenge: challengeUrl,
    'data-testid': testId,
  });
}
