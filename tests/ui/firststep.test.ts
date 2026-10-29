import { test } from 'node:test';
import assert from 'node:assert/strict';
import { chromium, type Page } from 'playwright';
import axe from 'axe-core';
import { mkdir } from 'node:fs/promises';

const URL = process.env.ACCESSFIX_TEST_URL || 'http://127.0.0.1:5173';
const checkout = `function decide({ totalCents, email, paymentToken }) {
  if (typeof email !== 'string' || !email.trim()) return 'reject';
  if (!Number.isSafeInteger(totalCents) || totalCents < 0) return 'reject';
  if (totalCents === 0) return 'confirm';
  return typeof paymentToken === 'string' && paymentToken.trim() ? 'charge' : 'reject';
}`;
const reservation = `function decide({ feeCents, eligible, paymentToken }) {
  if (eligible !== true) return 'reject';
  if (!Number.isSafeInteger(feeCents) || feeCents < 0) return 'reject';
  if (feeCents === 0) return 'confirm';
  return typeof paymentToken === 'string' && paymentToken.trim() ? 'charge' : 'reject';
}`;
async function review(page: Page, source: string) {
  await page.getByLabel('Decision function', { exact: true }).fill(source);
  await page.getByRole('button', { name: 'Run checks', exact: true }).click();
  await page.waitForFunction(() => document.querySelector('.fs-run-status')?.textContent?.startsWith('Your draft:'));
}
async function accessible(page: Page) {
  await page.addScriptTag({ content: axe.source });
  const violations = await page.evaluate(async () => (await (window as unknown as { axe: typeof axe }).axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21aa'] } })).violations.map(v => ({ id: v.id, nodes: v.nodes.map(n => n.target) })));
  assert.deepEqual(violations, []);
  assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), 'No page overflow');
}

test('FirstStep: reproduce, reject a regression, accept a fix, transfer, export, and restore safely', { timeout: 60000 }, async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1536, height: 1000 }, reducedMotion: 'reduce', acceptDownloads: true });
  const errors: string[] = []; const mutations: string[] = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('request', r => { if (r.method() === 'POST') mutations.push(r.url()); });
  await mkdir('.accessfix/firststep', { recursive: true });
  try {
    await page.goto(URL);
    await page.getByRole('heading', { name: 'The order that never went through.' }).waitFor();
    assert.match(await page.title(), /^PatchTrek/);
    assert.equal(await page.getByRole('link', { name: 'Companion workbench' }).getAttribute('href'), '/accessfix');
    await page.evaluate(() => document.fonts.ready);
    await page.screenshot({ path: '.accessfix/firststep/workspace-desktop.png', fullPage: true });
    await accessible(page);
    await page.getByRole('button', { name: 'Place test order', exact: true }).click();
    await page.getByText('Unable to complete. The customer sees a rejected request.', { exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: /Transfer task New context/ }).isDisabled(), true);
    await page.getByRole('button', { name: 'Reproduce incident' }).click();
    await page.getByText('Original code passes 7/9 checks.', { exact: false }).waitFor();
    await page.getByRole('button', { name: /Inspect checkout events/ }).click();
    await page.getByText('coupon_applied code=FULL100', { exact: false }).waitFor();
    await page.getByRole('button', { name: 'Reveal next hint' }).click();
    await page.getByText('Hint 1', { exact: true }).waitFor();
    await review(page, `function decide(input) { if (input.totalCents === 0) return 'confirm'; return 'charge'; }`);
    assert.equal(await page.getByRole('button', { name: 'Try the transfer task' }).isDisabled(), true);
    assert.ok(await page.getByText('Fail', { exact: true }).count() > 0);
    await review(page, checkout);
    assert.match(await page.locator('.fs-review-summary').innerText(), /9\/9/);
    await page.getByRole('button', { name: 'Place test order', exact: true }).click();
    await page.getByText('Confirmed without payment. The customer can continue.', { exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Try the transfer task' }).isDisabled(), true);
    await page.getByLabel('Leave a handoff for your reviewer').fill('Zero is valid, but invalid totals and missing emails must still fail. I confirmed free orders before requiring a payment token.');
    assert.equal(await page.getByRole('button', { name: 'Try the transfer task' }).isEnabled(), true);
    await page.getByLabel('Decision function', { exact: true }).fill(checkout + '\n// edit invalidates the old evidence');
    assert.equal(await page.getByRole('button', { name: 'Try the transfer task' }).isDisabled(), true);
    assert.match(await page.locator('.fs-review-summary').innerText(), /earlier draft/);
    await review(page, checkout);
    await page.getByRole('button', { name: 'Try the transfer task' }).click();
    await page.getByRole('heading', { name: 'A free seat is still a reservation.' }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Reveal next hint' }).count(), 0);
    await review(page, reservation);
    assert.match(await page.locator('.fs-review-summary').innerText(), /9\/9/);
    await accessible(page);
    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download evidence' }).click();
    assert.equal((await download).suggestedFilename(), 'patchtrek-practice-evidence.json');
    await page.screenshot({ path: '.accessfix/firststep/transfer-passed.png', fullPage: true });
    await page.reload();
    await page.getByText('Your drafts were restored.', { exact: false }).waitFor();
    assert.equal(await page.getByLabel('Decision function', { exact: true }).inputValue(), checkout);
    assert.equal(await page.getByRole('button', { name: 'Try the transfer task' }).isDisabled(), true);
    assert.equal(await page.locator('.fs-checks').count(), 0);
    await page.setViewportSize({ width: 390, height: 844 });
    await accessible(page);
    await page.screenshot({ path: '.accessfix/firststep/workspace-mobile.png', fullPage: true });
    await page.setViewportSize({ width: 320, height: 720 });
    await accessible(page);
    assert.deepEqual(mutations, [], 'Authored practice must make no model requests or server mutations');
    assert.deepEqual(errors, []);
  } finally { await browser.close(); }
});

test('FirstStep: timeout, syntax errors, cancellation, network isolation, and keyboard access', { timeout: 45000 }, async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  try {
    await page.goto(`${URL}/firststep`);
    await page.keyboard.press('Tab');
    assert.equal(await page.evaluate(() => document.activeElement?.textContent), 'Skip to practice');
    await page.keyboard.press('Enter');
    assert.equal(await page.evaluate(() => document.activeElement?.id), 'practice-main');
    await page.getByLabel('Decision function', { exact: true }).fill('function decide( {');
    await page.getByRole('button', { name: 'Run checks', exact: true }).click();
    await page.locator('.fs-error').waitFor();
    await page.getByLabel('Decision function', { exact: true }).fill('function decide() { while (true) {} }');
    await page.getByRole('button', { name: 'Run checks', exact: true }).click();
    await page.getByText('Execution stopped after 3 seconds.', { exact: false }).waitFor({ timeout: 8000 });
    assert.equal(await page.locator('iframe').count(), 0);
    await page.getByRole('button', { name: 'Run checks', exact: true }).click();
    await page.getByRole('button', { name: 'Cancel checks', exact: true }).click();
    await page.getByText('Checks cancelled. Your draft is unchanged.', { exact: true }).waitFor();
    assert.equal(await page.locator('iframe').count(), 0);
    const outside: string[] = [];
    page.on('request', r => { if (r.url().startsWith('https://example.test')) outside.push(r.url()); });
    await review(page, `function decide() { fetch('https://example.test/no-data').catch(() => {}); return typeof document === 'undefined' && typeof localStorage === 'undefined' ? 'confirm' : 'reject'; }`);
    assert.deepEqual(outside, [], 'Worker CSP must block outbound requests');
    assert.match(await page.locator('.fs-review-summary').innerText(), /2\/9/);
    await review(page, checkout);
    assert.match(await page.locator('.fs-review-summary').innerText(), /9\/9/);
  } finally { await browser.close(); }
});

test('FirstStep: live coaching UI preserves the last reply and exports provenance when allowance is exhausted', { timeout: 30000 }, async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ acceptDownloads: true });
  try {
    await page.route('**/api/firststep/config', route => route.fulfill({ json: { enabled: true, remaining: 1 } }));
    await page.route('**/api/firststep/coach', route => {
      assert.deepEqual(route.request().postDataJSON(), { mission: 'checkout', question: 'Which event should I compare?' });
      return route.fulfill({ json: { reply: 'Compare the total before and after FULL100.', remaining: 0, model: 'nvidia/test-fixture', generatedAt: '2026-10-29T00:00:00Z', usage: { inputTokens: 400, outputTokens: 50 } } });
    });
    await page.goto(URL);
    await page.getByLabel('Ask the Nemotron coach').fill('Which event should I compare?');
    await page.getByRole('button', { name: 'Ask coach', exact: true }).click();
    await page.getByText('Compare the total before and after FULL100.', { exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Ask coach', exact: true }).count(), 0);
    await page.getByText('Live response · NVIDIA Nemotron on Nebius Token Factory', { exact: true }).waitFor();
    const nextDownload = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download evidence' }).click();
    const download = await nextDownload;
    const stream = await download.createReadStream();
    assert.ok(stream);
    const chunks: Buffer[] = []; for await (const chunk of stream) chunks.push(Buffer.from(chunk));
    const evidence = JSON.parse(Buffer.concat(chunks).toString());
    assert.equal(evidence.guidance.liveRepliesReceivedThisPage, 1);
    assert.deepEqual(evidence.guidance.liveResponses, [{ model: 'nvidia/test-fixture', generatedAt: '2026-10-29T00:00:00Z', usage: { inputTokens: 400, outputTokens: 50 } }]);
  } finally { await browser.close(); }
});

test('PatchTrek: custom cases, regression history, safe restoration and readable report', { timeout: 60000 }, async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: { width: 1440, height: 1000 }, acceptDownloads: true });
  const errors: string[] = []; const mutations: string[] = [];
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  page.on('request', request => { if (request.method() === 'POST') mutations.push(request.url()); });
  try {
    await page.goto(URL);
    assert.equal(new globalThis.URL(page.url()).pathname, '/');
    assert.match(await page.title(), /^PatchTrek/);
    assert.equal(await page.locator('vite-error-overlay').count(), 0);
    await page.getByRole('heading', { name: 'The order that never went through.' }).waitFor();
    await page.getByText('Write and run your own cases', { exact: true }).click();
    await page.getByRole('button', { name: 'Run custom cases', exact: true }).click();
    await page.getByText('1/1 custom cases passed', { exact: true }).waitFor();
    assert.equal(await page.getByRole('button', { name: 'Try the transfer task' }).isDisabled(), true, 'Custom cases do not count as authored assessment');
    assert.match(await page.locator('.fs-history').innerText(), /Run checks twice/);
    await page.getByLabel('Custom cases (JSON)').fill('{');
    await page.getByText('Source or cases changed. Run custom cases again.', { exact: true }).waitFor();
    await page.getByRole('button', { name: 'Run custom cases', exact: true }).click();
    await page.getByText('Use valid JSON: an array of cases with input and expected fields.', { exact: true }).waitFor();
    assert.equal(await page.locator('iframe').count(), 0);
    const suite = JSON.stringify([{ label: 'Free order', input: { totalCents: 0, email: 'learner@example.test' }, expected: 'confirm' }], null, 2);
    await page.getByLabel('Custom cases (JSON)').fill(suite);
    await page.getByRole('button', { name: 'Run custom cases', exact: true }).click();
    await page.getByText('0/1 custom cases passed', { exact: true }).waitFor();
    await review(page, checkout);
    await page.getByRole('button', { name: 'Run custom cases', exact: true }).click();
    await page.getByText('1/1 custom cases passed', { exact: true }).waitFor();
    await review(page, "function decide() { return 'reject'; }");
    assert.match(await page.locator('.fs-comparison').innerText(), /0 newly passing · [1-9] regressions/);
    await page.getByText('Inspect previous attempts (2)', { exact: true }).click();
    await page.getByText('View source for attempt 1', { exact: true }).click();
    assert.equal(await page.locator('.fs-history pre:visible').innerText(), checkout);
    await page.getByRole('button', { name: 'Restore draft from attempt 1', exact: true }).click();
    assert.equal(await page.getByLabel('Decision function', { exact: true }).inputValue(), checkout);
    assert.equal(await page.getByRole('button', { name: 'Try the transfer task' }).isDisabled(), true);
    assert.equal(await page.locator('.fs-review-summary').count(), 0, 'Restoring does not restore passing evidence');
    await review(page, checkout);
    assert.match(await page.locator('.fs-comparison').innerText(), /[1-9] newly passing · 0 regressions/);
    await page.getByLabel('Leave a handoff for your reviewer').fill('I compared free and paid orders and preserved invalid-input rejection. I used the authored scenario facts for this practice.');
    const nextDownload = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download report', exact: true }).click();
    const download = await nextDownload;
    assert.equal(download.suggestedFilename(), 'patchtrek-engineering-report.md');
    const stream = await download.createReadStream(); assert.ok(stream);
    const chunks: Buffer[] = []; for await (const chunk of stream) chunks.push(Buffer.from(chunk));
    const report = Buffer.concat(chunks).toString();
    assert.match(report, /Latest authored check run: 9\/9 checks passed for the current draft/);
    assert.match(report, /Live coach replies recorded on this page: 0/);
    assert.match(report, /1\/1 custom cases passed/);
    assert.match(report, /Retained runs: 3/);
    await accessible(page);
    await page.locator('.fs-history').screenshot({ path: '/tmp/patchtrek-history-desktop.png' });
    await page.locator('.fs-lab').screenshot({ path: '/tmp/patchtrek-edge-cases-desktop.png' });
    await page.setViewportSize({ width: 390, height: 844 });
    await accessible(page);
    await page.locator('.fs-lab').screenshot({ path: '/tmp/patchtrek-edge-cases-mobile.png' });
    await page.setViewportSize({ width: 320, height: 720 });
    await accessible(page);
    await page.reload();
    await page.getByText('Write and run your own cases', { exact: true }).click();
    assert.equal(await page.getByLabel('Custom cases (JSON)').inputValue(), suite);
    assert.equal(await page.locator('.fs-custom-results').count(), 0);
    assert.equal(await page.locator('.fs-comparison').count(), 0);
    assert.equal(await page.getByRole('button', { name: 'Try the transfer task' }).isDisabled(), true);
    assert.deepEqual(errors, []); assert.deepEqual(mutations, []);
  } finally { await browser.close(); }
});
