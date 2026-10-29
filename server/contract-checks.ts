import { chromium, type Page } from 'playwright';
import axe from 'axe-core';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { compileFixture, startFixture } from './fixture-host.js';
import { focusRecorder } from './focus-trace.js';
import type { Check, ComponentContract, Evidence, ExecutionProfile, Violation } from '../shared/types.js';

function assert(condition: unknown, message: string): asserts condition { if (!condition) throw new Error(message); }
const events = (page: Page) => page.evaluate(() => (window as unknown as { __ACCESSFIX_EVENTS__: unknown[] }).__ACCESSFIX_EVENTS__);
const activeId = (page: Page) => page.evaluate(() => document.activeElement?.getAttribute('data-testid'));
const brief = (error: unknown) => (error instanceof Error ? error.message : String(error)).split('\nCall log:')[0].slice(0, 450);

/** Contract-specific acceptance checks are never part of the model-writeable component. */
export async function inspectContractComponent(source: string, directory: string, prefix: string, contract: Exclude<ComponentContract, 'signup'>, signal?: AbortSignal, profile: ExecutionProfile = 'local'): Promise<Evidence> {
  signal?.throwIfAborted(); const started = Date.now();
  const host = await startFixture(await compileFixture(source, contract));
  let browser: Awaited<ReturnType<typeof chromium.launch>> | undefined;
  const abort = () => { void browser?.close(); };
  try {
    browser = await chromium.launch({ headless: true }); signal?.addEventListener('abort', abort, { once: true }); signal?.throwIfAborted();
    const context = await browser.newContext({ viewport: { width: 760, height: 570 }, reducedMotion: 'reduce', serviceWorkers: 'block' });
    await context.route('**/*', route => route.request().url() === host.url ? route.continue() : route.abort());
    const page = await context.newPage(); page.setDefaultTimeout(profile === 'free-demo' ? 10_000 : 1500); page.setDefaultNavigationTimeout(profile === 'free-demo' ? 30_000 : 5000);
    const consoleErrors: string[] = []; page.on('pageerror', error => { if (consoleErrors.length < 5) consoleErrors.push(brief(error)); });
    const ready = contract === 'login' ? 'email' : contract === 'dialog' ? 'open-dialog' : 'nav-overview';
    const reset = async () => { signal?.throwIfAborted(); await page.goto(host.url); await page.getByTestId(ready).waitFor(); };
    await reset(); await mkdir(directory, { recursive: true }); const screenshot = `${prefix}.png`; await page.screenshot({ path: path.join(directory, screenshot) });
    const checks: Check[] = []; const recorder = focusRecorder(page, directory, prefix);
    const check = async (id: string, name: string, category: Check['category'], test: () => Promise<string>) => {
      await reset();
      try { checks.push({ id, name, category, passed: true, detail: await test() }); }
      catch (error) { signal?.throwIfAborted(); checks.push({ id, name, category, passed: false, detail: brief(error) }); }
    };
    const click = async (id: string) => { await page.getByTestId(id).click(); await page.waitForTimeout(80); };
    const open = async () => { await click('open-dialog'); await page.getByTestId('dialog').waitFor({ state: 'visible' }); };
    const destinations = ['overview', 'projects', 'settings'];
    if (contract === 'login') {
      const email = 'keyboard.user@example.com'; const password = 'good-password-42';
      const fill = async (e = email, p = password) => { await page.getByTestId('email').fill(e); await page.getByTestId('password').fill(p); };
      await check('labels', 'Login fields have accessible labels', 'accessibility', async () => {
        for (const id of ['email', 'password']) assert(await page.getByLabel(id === 'email' ? 'Email' : 'Password', { exact: true }).getAttribute('data-testid') === id, `${id} needs its visible label associated.`);
        return 'Email and password have associated labels.';
      });
      await check('keyboard', 'Complete login using only the keyboard', 'accessibility', async () => {
        await recorder.capture('Start keyboard login'); await recorder.tabTo('email'); await page.keyboard.type(email); await recorder.capture('Enter email');
        await recorder.tabTo('password'); await page.keyboard.type(password); await recorder.capture('Enter password (hidden)'); await recorder.tabTo('submit'); await recorder.key('Enter');
        assert(JSON.stringify(await events(page)) === JSON.stringify([{ email, password }]), 'Keyboard login must submit the exact credentials once.');
        assert(await page.getByRole('status').filter({ hasText: 'Signed in' }).isVisible(), 'Login confirmation was not reached.'); recorder.trace.complete = true; return 'Tab and Enter completed the login journey.';
      });
      await check('validation-feedback', 'Login errors are announced and linked', 'accessibility', async () => {
        for (const id of ['email', 'password']) {
          await reset(); await fill(id === 'email' ? 'invalid' : email, id === 'password' ? '' : password); await click('submit');
          const field = page.getByTestId(id); assert(await field.getAttribute('aria-invalid') === 'true', `${id} does not expose its invalid state.`);
          const ids = (await field.getAttribute('aria-describedby') || '').split(/\s+/).filter(Boolean);
          assert(await page.evaluate(ids => ids.some(id => document.getElementById(id)?.textContent?.trim()), ids), `${id} has no linked error message.`);
          assert((await page.locator('[role="alert"],[aria-live="polite"],[aria-live="assertive"]').allTextContents()).some(text => text.trim()), 'No live error message.');
        } return 'Both invalid credentials expose linked and live error text.';
      });
      await check('focus-management', 'Focus moves to the invalid login field', 'accessibility', async () => {
        for (const id of ['email', 'password']) { await reset(); await fill(id === 'email' ? '' : email, ''); await click('submit'); assert(await activeId(page) === id, `Focus did not move to ${id}.`); }
        return 'The first invalid field receives focus.';
      });
      await check('valid-submit', 'Login preserves credentials and submits once', 'regression', async () => { await fill(); await click('submit'); assert(JSON.stringify(await events(page)) === JSON.stringify([{ email, password }]), 'Login credentials or submission count changed.'); return 'Exactly one unchanged credential payload.'; });
      await check('invalid-email', 'Malformed login email is rejected', 'regression', async () => { await fill('invalid'); await click('submit'); assert(!(await events(page)).length, 'Malformed email was submitted.'); return 'Malformed email cannot submit.'; });
      await check('empty-password', 'Empty login password is rejected', 'regression', async () => { await fill(email, ''); await click('submit'); assert(!(await events(page)).length, 'An empty password was submitted.'); return 'An empty password cannot submit.'; });
      await check('password-masked', 'Password remains a masked input', 'regression', async () => { assert(await page.getByTestId('password').getAttribute('type') === 'password', 'The password field is no longer masked.'); return 'Password input type is preserved.'; });
    } else if (contract === 'dialog') {
      await check('dialog-name', 'Modal has an accessible name and modal semantics', 'accessibility', async () => { await open(); const dialog = page.getByRole('dialog', { name: 'Publish changes?' }); assert(await dialog.count() === 1, 'No named dialog was found.'); assert(await dialog.evaluate(el => el.matches('dialog:modal') || el.getAttribute('aria-modal') === 'true'), 'Dialog is not modal.'); return 'The modal is named Publish changes?'; });
      await check('initial-focus', 'Opening the dialog focuses its safe action', 'accessibility', async () => { await open(); assert(await activeId(page) === 'cancel', 'Opening did not focus Cancel.'); return 'Cancel receives initial focus.'; });
      await check('focus-trap', 'Tab and Shift+Tab remain inside the open dialog', 'accessibility', async () => { await open(); await page.getByTestId('cancel').focus(); for (const key of ['Shift+Tab', 'Tab', 'Tab', 'Tab', 'Tab']) { await page.keyboard.press(key); assert(await page.getByTestId('dialog').evaluate(el => el.contains(document.activeElement)), `${key} escaped the dialog.`); } return 'Focus stays inside in both directions.'; });
      await check('escape-return', 'Escape closes and restores trigger focus', 'accessibility', async () => { await open(); await page.keyboard.press('Escape'); assert(!await page.getByTestId('dialog').isVisible(), 'Escape did not close the modal.'); assert(await activeId(page) === 'open-dialog', 'Focus was not restored to the trigger.'); assert(!(await events(page)).length, 'Escape incorrectly confirmed.'); return 'Escape closes without confirming and restores focus.'; });
      await check('keyboard', 'Keyboard can open and explicitly confirm', 'accessibility', async () => { await recorder.capture('Start dialog journey'); await recorder.tabTo('open-dialog'); await recorder.key('Enter'); await recorder.capture('Dialog opened'); await recorder.tabTo('confirm'); await recorder.key('Enter'); assert(JSON.stringify(await events(page)) === '[{"confirmed":true}]', 'Keyboard confirmation must happen exactly once.'); recorder.trace.complete = true; return 'Keyboard opening and confirmation work.'; });
      await check('cancel', 'Cancel never confirms the action', 'regression', async () => { await open(); await click('cancel'); assert(!(await events(page)).length, 'Cancel incorrectly confirmed the action.'); assert(!await page.getByTestId('dialog').isVisible(), 'Cancel did not close the dialog.'); return 'Cancel closes without a confirmation callback.'; });
      await check('confirm', 'Publish confirms exactly once', 'regression', async () => { await open(); await click('confirm'); assert(JSON.stringify(await events(page)) === '[{"confirmed":true}]', 'Publish did not confirm exactly once.'); assert(!await page.getByTestId('dialog').isVisible(), 'Publish did not close.'); return 'Publish sends one confirmation and closes.'; });
      await check('no-auto-confirm', 'Opening and reopening never publish automatically', 'regression', async () => { await open(); assert(!(await events(page)).length, 'Opening automatically confirmed.'); await click('cancel'); await open(); assert(!(await events(page)).length, 'Reopening automatically confirmed.'); return 'The user must explicitly choose Publish.'; });
    } else {
      await check('navigation-landmark', 'Navigation has a named landmark', 'accessibility', async () => { assert(await page.getByRole('navigation', { name: 'Workspace', exact: true }).count() === 1, 'Missing the Workspace navigation landmark.'); return 'Workspace is exposed as navigation.'; });
      await check('link-semantics', 'Each destination is an accessible link', 'accessibility', async () => { for (const destination of destinations) { const link = page.getByRole('link', { name: destination[0].toUpperCase() + destination.slice(1), exact: true }); assert(await link.getAttribute('href') === `#${destination}`, `The ${destination} link has a missing or changed target.`); } return 'All three destinations retain their names and URLs.'; });
      await check('keyboard', 'Keyboard reaches every navigation destination', 'accessibility', async () => { await recorder.capture('Start keyboard navigation'); for (const destination of destinations) { await recorder.tabTo(`nav-${destination}`); await recorder.key('Enter'); } assert(JSON.stringify(await events(page)) === JSON.stringify(destinations), 'Keyboard destinations or activation count changed.'); recorder.trace.complete = true; return 'Tab and Enter activate each destination once.'; });
      await check('current-page', 'The current destination is exposed and updates', 'accessibility', async () => { assert(await page.getByTestId('nav-overview').getAttribute('aria-current') === 'page', 'Initial current page is not exposed.'); for (const destination of ['projects', 'settings']) { await click(`nav-${destination}`); assert(await page.locator('[aria-current="page"]').count() === 1 && await page.getByTestId(`nav-${destination}`).getAttribute('aria-current') === 'page', 'Current-page state is missing, duplicated or stale.'); } return 'Exactly one current page is exposed after each activation.'; });
      await check('destination-callbacks', 'Pointer activation preserves all destination values', 'regression', async () => { for (const destination of destinations) await click(`nav-${destination}`); assert(JSON.stringify(await events(page)) === JSON.stringify(destinations), 'A destination was changed, omitted or activated twice.'); return 'Overview, projects and settings retain their original callback values.'; });
      await check('no-auto-navigation', 'Rendering never navigates without user activation', 'regression', async () => { await page.waitForTimeout(100); assert(!(await events(page)).length, 'Navigation happened without activation.'); return 'No callback before a user chooses a destination.'; });
    }
    const violations = new Map<string, Violation>();
    for (const state of ['initial', 'active']) {
      await reset();
      if (state === 'active') { if (contract === 'login') await click('submit'); else if (contract === 'dialog') await open(); else await click('nav-projects'); }
      await page.addScriptTag({ content: axe.source });
      const result = await page.evaluate(async () => (window as unknown as { axe: typeof axe }).axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } }));
      for (const violation of result.violations) { const prior = violations.get(violation.id); violations.set(violation.id, { id: violation.id, impact: violation.impact || 'unknown', description: violation.help, helpUrl: violation.helpUrl, nodes: [...new Set([...(prior?.nodes || []), ...violation.nodes.map(node => `${state}: ${node.target.join(', ')}`)])] }); }
    }
    checks.push({ id: 'axe', name: 'Automated accessibility scan', category: 'accessibility', passed: !violations.size, detail: violations.size ? `${violations.size} axe violations across initial and active states.` : 'No axe violations in the tested states for the selected WCAG tags.' });
    checks.push({ id: 'runtime', name: 'Component renders without runtime errors', category: 'regression', passed: !consoleErrors.length, detail: consoleErrors.join('; ') || 'No page errors during the journey.' });
    signal?.throwIfAborted(); return { checks, screenshot, violations: [...violations.values()], durationMs: Date.now() - started, consoleErrors, focusTrace: recorder.trace };
  } finally { signal?.removeEventListener('abort', abort); await browser?.close(); await host.close(); }
}
