import type { Page } from 'playwright';
import path from 'node:path';
import type { FocusTrace } from '../shared/types.js';

/** Capture observed focus without modifying the component or its styles. */
export function focusRecorder(page: Page, directory: string, prefix: string) {
  const trace: FocusTrace = { width: 760, height: 570, steps: [], complete: false };
  const capture = async (action: string) => {
    if (trace.steps.length >= 32) return;
    const focus = await page.evaluate(() => {
      const element = document.activeElement;
      if (!(element instanceof HTMLElement) || element === document.body) return { target: 'Document (no focused control)' };
      const bounds = element.getBoundingClientRect();
      const label = element.getAttribute('aria-label') || element.getAttribute('data-testid') || element.textContent?.trim().slice(0, 80) || element.tagName.toLowerCase();
      return { target: label, rect: { x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height } };
    });
    const screenshot = `${prefix}-focus-${trace.steps.length}.png`;
    await page.screenshot({ path: path.join(directory, screenshot) });
    trace.steps.push({ action, ...focus, screenshot });
  };
  const key = async (value: string) => { await page.keyboard.press(value); await capture(value); };
  const tabTo = async (id: string) => {
    for (let i = 0; i < 12; i++) {
      await key('Tab');
      if (await page.evaluate(() => document.activeElement?.getAttribute('data-testid')) === id) return;
    }
    throw new Error(`The ${id} control was not reachable within 12 Tab presses.`);
  };
  return { trace, capture, key, tabTo };
}
