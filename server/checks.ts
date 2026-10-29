import { chromium, type Page } from 'playwright';
import axe from 'axe-core';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { compileFixture, startFixture } from './fixture-host.js';
import type { Check, Evidence, Violation } from '../shared/types.js';

const EMAIL = 'keyboard.user@example.com';
const PASSWORD = 'good-password-42';
function assert(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }
async function submissions(page: Page) { return page.evaluate(() => (window as unknown as { __ACCESSFIX_EVENTS__: unknown[] }).__ACCESSFIX_EVENTS__); }
async function activeTestId(page: Page) { return page.evaluate(() => document.activeElement?.getAttribute('data-testid')); }
async function tabTo(page: Page, id: string) {
  for (let i = 0; i < 12; i++) {
    await page.keyboard.press('Tab');
    if (await activeTestId(page) === id) return;
  }
  throw new Error(`The ${id} control was not reachable within 12 Tab presses.`);
}
async function populate(page: Page, email = EMAIL, password = PASSWORD, terms = true) {
  await page.getByTestId('email').fill(email);
  await page.getByTestId('password').fill(password);
  if (terms) await page.getByTestId('terms').check();
}
async function clickSubmit(page: Page) { await page.getByTestId('submit').click(); await page.waitForTimeout(80); }
function briefError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error);
  return message.split('\nCall log:')[0].replace(/\x1b\[[0-9;]*m/g, '').slice(0, 450);
}

// These checks are outside every model-writeable file. Both versions use this exact function.
export async function inspectComponent(source: string, outputDir: string, prefix: string, signal?: AbortSignal): Promise<Evidence> {
  signal?.throwIfAborted();
  const started = Date.now();
  const html = await compileFixture(source);
  const host = await startFixture(html);
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  const abort = () => { void browser?.close(); };
  try {
    browser = await chromium.launch({ headless: true });
    signal?.addEventListener('abort', abort, { once: true });
    signal?.throwIfAborted();
    const context = await browser.newContext({ viewport: { width: 760, height: 570 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
    await context.route('**/*', route => route.request().url() === host.url ? route.continue() : route.abort());
    const page = await context.newPage();
    page.setDefaultTimeout(1500);
    page.setDefaultNavigationTimeout(5000);
    const consoleErrors: string[] = [];
    page.on('pageerror', error => { if (consoleErrors.length < 5) consoleErrors.push(briefError(error)); });
    const reset = async () => { signal?.throwIfAborted(); await page.goto(host.url); await page.getByTestId('email').waitFor(); };
    await reset();
    await mkdir(outputDir, { recursive: true });
    const screenshot = `${prefix}.png`;
    await page.screenshot({ path: path.join(outputDir, screenshot) });
    const checks: Check[] = [];
    const run = async (id: string, name: string, category: Check['category'], test: () => Promise<string>) => {
      await reset();
      try { checks.push({ id, name, category, passed: true, detail: await test() }); }
      catch (error) { signal?.throwIfAborted(); checks.push({ id, name, category, passed: false, detail: briefError(error) }); }
    };
    await run('labels', 'Fields have accessible labels', 'accessibility', async () => {
      for (const [label, id] of [['Email', 'email'], ['Password', 'password'], ['I agree to the terms', 'terms']]) {
        const control = page.getByLabel(label, { exact: true });
        assert(await control.count() === 1 && await control.getAttribute('data-testid') === id, `${label} is not programmatically associated with its control.`);
      }
      return 'Email, password and consent can be identified by their accessible names.';
    });
    await run('keyboard', 'Complete signup using only the keyboard', 'accessibility', async () => {
      await tabTo(page, 'email'); await page.keyboard.type(EMAIL);
      await tabTo(page, 'password'); await page.keyboard.type(PASSWORD);
      await tabTo(page, 'terms'); await page.keyboard.press('Space');
      await tabTo(page, 'submit'); await page.keyboard.press('Enter');
      await page.waitForTimeout(100);
      const events = await submissions(page);
      assert(events.length === 1, 'Pressing Enter on the submit control did not complete signup exactly once.');
      assert(JSON.stringify(events[0]) === JSON.stringify({ email: EMAIL, password: PASSWORD, terms: true }), 'The keyboard journey submitted a different payload.');
      assert(await page.getByRole('status').filter({ hasText: 'Account created' }).isVisible(), 'Signup did not reach the confirmation screen.');
      return 'Tab → email → password → consent → Enter reached the confirmation screen.';
    });
    await run('validation-feedback', 'Validation errors are announced and linked', 'accessibility', async () => {
      for (const invalid of ['email', 'password', 'terms']) {
        await reset();
        await populate(page, invalid === 'email' ? 'invalid' : EMAIL, invalid === 'password' ? 'short' : PASSWORD, invalid !== 'terms');
        await clickSubmit(page);
        const field = page.getByTestId(invalid);
        assert(await field.getAttribute('aria-invalid') === 'true', `${invalid}: invalid state is not exposed with aria-invalid.`);
        const ids = (await field.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean);
        assert(ids.length > 0, `${invalid}: the error is not linked with aria-describedby.`);
        const linked = await page.evaluate(ids => ids.some(id => !!document.getElementById(id)?.textContent?.trim()), ids);
        assert(linked, `${invalid}: the linked error description is empty or missing.`);
        const live = page.locator('[role="alert"], [aria-live="assertive"], [aria-live="polite"]');
        assert(await live.count() > 0 && (await live.allTextContents()).some(text => text.trim()), `${invalid}: no populated live error message was found.`);
      }
      return 'All three invalid fields expose their state, associated error text, and a live message.';
    });
    await run('focus-management', 'Focus moves to the first invalid field', 'accessibility', async () => {
      for (const invalid of ['email', 'password', 'terms']) {
        await reset();
        await populate(page, invalid === 'email' ? '' : EMAIL, invalid === 'password' ? '' : PASSWORD, false);
        await clickSubmit(page);
        assert(await activeTestId(page) === invalid, `Focus did not move to the invalid ${invalid} field after submit.`);
      }
      return 'Submit moves focus to email, password or consent according to the first error.';
    });
    await run('valid-submit', 'Valid signup still submits the correct data', 'regression', async () => {
      await populate(page); await clickSubmit(page);
      const events = await submissions(page);
      assert(events.length === 1, 'A valid signup must submit exactly once.');
      const value = events[0] as Record<string, unknown>;
      assert(value.email === EMAIL && value.password === PASSWORD && value.terms === true, 'Valid signup data was changed or omitted.');
      return 'One submission contains the original email, password and explicit consent.';
    });
    await run('invalid-email', 'Malformed email is rejected', 'regression', async () => {
      await populate(page, 'not-an-email'); await clickSubmit(page);
      assert((await submissions(page)).length === 0, 'The form accepted a malformed email address.');
      return 'Malformed email cannot create an account.';
    });
    await run('short-password', 'Short passwords are rejected', 'regression', async () => {
      await populate(page, EMAIL, 'short'); await clickSubmit(page);
      assert((await submissions(page)).length === 0, 'The form accepted a password shorter than 8 characters.');
      return 'A password shorter than 8 characters cannot create an account.';
    });
    await run('consent', 'Consent is required before signup', 'regression', async () => {
      await populate(page, EMAIL, PASSWORD, false); await clickSubmit(page);
      assert((await submissions(page)).length === 0, 'The form created an account without consent.');
      return 'Unchecked consent blocks the submission.';
    });
    const violations = new Map<string, Violation>();
    for (const state of ['initial', 'invalid']) {
      await reset();
      if (state === 'invalid') await clickSubmit(page);
      await page.addScriptTag({ content: axe.source });
      const results = await page.evaluate(async () => {
        const engine = (window as unknown as { axe: typeof axe }).axe;
        return engine.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } });
      });
      for (const violation of results.violations) {
        const previous = violations.get(violation.id);
        violations.set(violation.id, { id: violation.id, impact: violation.impact || 'unknown', description: violation.help, helpUrl: violation.helpUrl, nodes: [...new Set([...(previous?.nodes || []), ...violation.nodes.map(node => `${state}: ${node.target.join(', ')}`)])] });
      }
    }
    checks.push({ id: 'axe', name: 'Automated accessibility scan', category: 'accessibility', passed: violations.size === 0, detail: violations.size ? `${violations.size} axe rule violation(s) across initial and invalid states.` : 'No axe violations found in the initial and invalid states for the selected WCAG tags.' });
    checks.push({ id: 'runtime', name: 'Component renders without runtime errors', category: 'regression', passed: consoleErrors.length === 0, detail: consoleErrors.length ? consoleErrors.join('; ') : 'No browser page errors during the journey.' });
    signal?.throwIfAborted();
    return { checks, violations: [...violations.values()], screenshot, durationMs: Date.now() - started, consoleErrors };
  } finally {
    signal?.removeEventListener('abort', abort);
    await browser?.close(); await host.close();
  }
}

export function evaluateCandidate(before: Evidence, after: Evidence) {
  const regressions = before.checks.filter(check => check.passed && !after.checks.find(next => next.id === check.id)?.passed).map(check => check.name);
  const newRules = after.violations.filter(rule => !before.violations.some(previous => previous.id === rule.id));
  regressions.push(...newRules.map(rule => `New axe violation: ${rule.id}`));
  return { accepted: after.checks.length === before.checks.length && after.checks.every(check => check.passed) && after.violations.length === 0 && regressions.length === 0, regressions };
}
