import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chromium, type Page } from 'playwright';
import axe from 'axe-core';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { ROOT } from '../../server/config.js';

const URL = process.env.ACCESSFIX_TEST_URL || 'http://127.0.0.1:5173';
async function noOverflow(page: Page) {
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth), 'Page must not overflow horizontally.');
}
async function a11y(page: Page) {
  await page.addScriptTag({ content: axe.source });
  const violations = await page.evaluate(async () => {
    const engine = (window as unknown as { axe: typeof axe }).axe;
    // The intentionally broken product-under-test iframe is tested by the engine suite.
    const result = await engine.run({ exclude: ['iframe'] }, { iframes: false, runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'] } });
    return result.violations.map(rule => ({ id: rule.id, help: rule.help, nodes: rule.nodes.map(node => node.target) }));
  });
  assert.deepEqual(violations, [], 'Dashboard accessibility violations');
}
test('desktop workflow: audit, accepted exercise, source diff, export, history and responsive evidence', { timeout: 120000 }, async () => {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width: 1536, height: 1024 }, reducedMotion: 'reduce', acceptDownloads: true });
  const page = await context.newPage();
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  await mkdir(path.join(ROOT, 'docs/design'), { recursive: true });
  try {
    await page.goto(URL);
    await page.getByRole('button', { name: 'Run audit', exact: true }).waitFor();
    await page.waitForFunction(() => !(document.querySelector('.setup-actions button') as HTMLButtonElement)?.disabled);
    await page.evaluate(() => document.fonts.ready);
    await page.frameLocator('iframe').getByTestId('email').waitFor();
    await page.screenshot({ path: path.join(ROOT, 'docs/design/workbench-desktop.png'), fullPage: false });
    await noOverflow(page); await a11y(page);
    await page.getByRole('button', { name: 'View source', exact: true }).click();
    await page.getByRole('heading', { name: 'examples/signup/Signup.tsx' }).waitFor();
    assert.match(await page.locator('#component-source').innerText(), /examples\/signup\/Signup.tsx/);
    await page.getByRole('button', { name: 'Hide source', exact: true }).click();
    await page.getByRole('button', { name: 'Run audit', exact: true }).click();
    await page.getByRole('link', { name: 'Export report', exact: true }).waitFor({ timeout: 30000 });
    const keyboardRow = page.getByRole('row').filter({ hasText: 'Complete signup using only the keyboard' });
    assert.match(await keyboardRow.innerText(), /Fail/);
    assert.match(await page.locator('.result-summary').innerText(), /4 of 10 checks failed/);
    await a11y(page);
    await page.locator('.verification-lab > summary').click();
    await page.getByRole('button', { name: 'Test a good patch' }).click();
    await page.getByRole('link', { name: 'Download patch', exact: true }).waitFor({ timeout: 30000 });
    assert.match(await page.locator('.result-summary').innerText(), /passed every automated check/);
    await page.getByRole('button', { name: 'Source diff', exact: true }).click();
    assert.match(await page.locator('.diff-view').innerText(), /aria-invalid/);
    const downloadPromise = page.waitForEvent('download');
    await page.getByRole('link', { name: 'Export report', exact: true }).click();
    const download = await downloadPromise;
    assert.match(download.suggestedFilename(), /^accessfix-.*\.html$/);
    assert.equal(await download.failure(), null);
    await page.getByRole('button', { name: 'Check results', exact: true }).click();
    await page.getByRole('button', { name: 'Candidate 1', exact: true }).click();
    await page.waitForFunction(() => { const image = document.querySelector('.browser-capture') as HTMLImageElement; return image?.complete && image.naturalWidth > 0; });
    await page.screenshot({ path: path.join(ROOT, 'docs/design/workbench-accepted.png'), fullPage: true });
    await a11y(page);
    await page.getByRole('button', { name: 'Run history', exact: true }).click();
    await page.getByRole('heading', { name: 'A record you can replay.' }).waitFor();
    assert.ok(await page.locator('.history-table tbody tr').count() >= 2);
    await page.locator('.history-table tbody tr').first().getByRole('button').click();
    await page.getByRole('heading', { name: 'Every check. Both versions.' }).waitFor();
    await page.reload();
    await page.getByRole('link', { name: 'Export report', exact: true }).waitFor();
    await page.waitForFunction(() => { const image = document.querySelector('.browser-capture') as HTMLImageElement; return image?.complete && image.naturalWidth > 0; });
    await page.setViewportSize({ width: 390, height: 844 });
    await noOverflow(page); await a11y(page);
    await page.screenshot({ path: path.join(ROOT, 'docs/design/workbench-mobile.png'), fullPage: true });
    await page.getByRole('button', { name: 'Setup guide', exact: true }).click();
    await page.getByRole('heading', { name: 'Your local repair workspace.' }).waitFor();
    await noOverflow(page); await a11y(page);
    await page.setViewportSize({ width: 320, height: 720 });
    await noOverflow(page);
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
test('keyboard navigation, missing-key status and API failure recovery are explicit', { timeout: 60000 }, async () => {
  const browser = await chromium.launch(); const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, reducedMotion: 'reduce' });
  try {
    await page.goto(URL); await page.getByRole('button', { name: 'Run audit', exact: true }).waitFor();
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement?.textContent), 'Skip to workspace');
    await page.keyboard.press('Enter');
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'main-content');
    await page.getByLabel('Choose a component fixture').selectOption('team');
    await page.getByRole('button', { name: 'Run audit', exact: true }).click();
    await page.getByRole('link', { name: 'Export report', exact: true }).waitFor({ timeout: 30000 });
    assert.match(await page.locator('.result-summary').innerText(), /2 of 10 checks failed/);
    await page.route('**/api/runs', route => route.request().method() === 'POST' ? route.fulfill({ status: 409, contentType: 'application/json', body: JSON.stringify({ error: 'Test: a run is already active. Retry after it finishes.' }) }) : route.continue());
    await page.getByRole('button', { name: 'Run audit', exact: true }).click();
    await page.getByRole('alert').filter({ hasText: 'Test: a run is already active.' }).waitFor();
    await page.unroute('**/api/runs');
    await page.getByLabel('Choose a component fixture').selectOption('healthy');
    await page.getByRole('button', { name: 'Run audit', exact: true }).click();
    await page.getByRole('link', { name: 'Export report', exact: true }).waitFor({ timeout: 30000 });
    assert.match(await page.locator('.result-summary').innerText(), /No patch is needed/);
    await page.route('**/api/config', route => route.abort());
    await page.getByRole('alert').filter({ hasText: 'The runner is unavailable.' }).waitFor({ timeout: 10000 });
    assert.ok(await page.getByRole('link', { name: 'Export report', exact: true }).isVisible());
    await page.getByRole('button', { name: 'Run audit', exact: true }).click();
    await page.getByRole('link', { name: 'Export report', exact: true }).waitFor({ state: 'hidden' });
    await page.getByRole('link', { name: 'Export report', exact: true }).waitFor({ timeout: 30000 });
    assert.match(await page.locator('.result-summary').innerText(), /No patch is needed/);
    assert.ok((await page.getByRole('alert').allTextContents()).every(text => /runner is unavailable|Could not refresh/.test(text)), 'A refresh failure must not turn an accepted run into a start error.');
    await page.unroute('**/api/config');
    await page.getByRole('alert').filter({ hasText: 'The runner is unavailable.' }).waitFor({ state: 'hidden', timeout: 10000 });
  } finally { await browser.close(); }
});

test('dialog contract and before/after keyboard replay work on desktop and mobile', { timeout: 120000 }, async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1536, height: 1024 }, reducedMotion: 'reduce' });
  const errors: string[] = []; page.on('pageerror', error => errors.push(error.message));
  try {
    await page.goto(URL);
    assert.match(await page.title(), /AccessFix/);
    await page.getByLabel('Choose a component fixture').selectOption('dialog');
    await page.frameLocator('iframe').getByTestId('open-dialog').waitFor();
    await page.getByRole('button', { name: 'Run audit', exact: true }).click();
    await page.getByRole('link', { name: 'Export report', exact: true }).waitFor({ timeout: 30000 });
    assert.match(await page.getByRole('row').filter({ hasText: 'Opening the dialog focuses its safe action' }).innerText(), /Fail/);
    await page.locator('.verification-lab > summary').click();
    await page.getByRole('button', { name: 'Test a good patch', exact: true }).click();
    await page.getByRole('link', { name: 'Download patch', exact: true }).waitFor({ timeout: 30000 });
    await page.getByRole('button', { name: 'Keyboard replay', exact: true }).click();
    await page.locator('.focus-image img').first().waitFor();
    await page.waitForFunction(() => [...document.querySelectorAll<HTMLImageElement>('.focus-image img')].every(image => image.complete && image.naturalWidth > 0));
    assert.equal(await page.locator('.focus-pane').count(), 2);
    await page.getByRole('button', { name: 'Next keyboard step', exact: true }).click();
    assert.equal(await page.getByLabel('Keyboard replay step').inputValue(), '1');
    await page.getByRole('button', { name: 'Play replay', exact: true }).click();
    await page.waitForFunction(() => Number((document.getElementById('replay-step') as HTMLInputElement)?.value) >= 2);
    await page.getByRole('button', { name: 'Pause replay', exact: true }).click();
    await noOverflow(page); await a11y(page);
    await page.locator('.focus-replay').scrollIntoViewIfNeeded();
    await page.screenshot({ path: '/tmp/accessfix-keyboard-replay-desktop.png', fullPage: false });
    await page.setViewportSize({ width: 390, height: 844 });
    await noOverflow(page); await a11y(page);
    await page.screenshot({ path: '/tmp/accessfix-keyboard-replay-mobile.png', fullPage: false });
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});
