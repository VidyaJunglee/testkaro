import { BlockDefinition } from '../schema';
import { registerBlock } from './registry';

// ─── Assertion Blocks ────────────────────────────────────────────────────────

const assertVisible: BlockDefinition = {
  type: 'assert_visible',
  category: 'assertion',
  label: 'Assert Visible',
  description: 'Assert that an element is visible on the page',
  color: '#FF9800',
  inputs: [
    { name: 'selector', label: 'Selector', type: 'text', required: true },
  ],
  async execute(params, ctx) {
    const page = ctx.page as any;
    const start = Date.now();
    try {
      await page.locator(String(params.selector)).waitFor({ state: 'visible', timeout: 5000 });
      return { stepId: '', type: 'assert_visible', status: 'passed', duration: Date.now() - start };
    } catch (e: any) {
      return { stepId: '', type: 'assert_visible', status: 'failed', duration: Date.now() - start, error: e.message };
    }
  },
};

const assertText: BlockDefinition = {
  type: 'assert_text',
  category: 'assertion',
  label: 'Assert Text',
  description: 'Assert that an element contains specific text',
  color: '#FF9800',
  inputs: [
    { name: 'selector', label: 'Selector', type: 'text', required: true },
    { name: 'expected', label: 'Expected Text', type: 'text', required: true },
    { name: 'exact', label: 'Exact Match', type: 'checkbox', default: false },
  ],
  async execute(params, ctx) {
    const page = ctx.page as any;
    const start = Date.now();
    try {
      const text = await page.locator(String(params.selector)).textContent();
      const match = params.exact ? text === params.expected : text?.includes(String(params.expected));
      if (!match) {
        return { stepId: '', type: 'assert_text', status: 'failed', duration: Date.now() - start, error: `Expected "${params.expected}", got "${text}"` };
      }
      return { stepId: '', type: 'assert_text', status: 'passed', duration: Date.now() - start };
    } catch (e: any) {
      return { stepId: '', type: 'assert_text', status: 'failed', duration: Date.now() - start, error: e.message };
    }
  },
};

const assertUrl: BlockDefinition = {
  type: 'assert_url',
  category: 'assertion',
  label: 'Assert URL',
  description: 'Assert the current URL matches',
  color: '#FF9800',
  inputs: [
    { name: 'expected', label: 'Expected URL', type: 'text', required: true },
    { name: 'mode', label: 'Match Mode', type: 'dropdown', default: 'contains', options: [{ label: 'Contains', value: 'contains' }, { label: 'Equals', value: 'equals' }, { label: 'Starts with', value: 'startsWith' }] },
  ],
  async execute(params, ctx) {
    const page = ctx.page as any;
    const start = Date.now();
    const url = page.url();
    const expected = String(params.expected);
    let pass = false;
    if (params.mode === 'equals') pass = url === expected;
    else if (params.mode === 'startsWith') pass = url.startsWith(expected);
    else pass = url.includes(expected);
    return { stepId: '', type: 'assert_url', status: pass ? 'passed' : 'failed', duration: Date.now() - start, error: pass ? undefined : `URL "${url}" does not match "${expected}"` };
  },
};

const assertTitle: BlockDefinition = {
  type: 'assert_title',
  category: 'assertion',
  label: 'Assert Title',
  description: 'Assert the page title',
  color: '#FF9800',
  inputs: [
    { name: 'expected', label: 'Expected Title', type: 'text', required: true },
  ],
  async execute(params, ctx) {
    const page = ctx.page as any;
    const start = Date.now();
    const title = await page.title();
    const pass = title.includes(String(params.expected));
    return { stepId: '', type: 'assert_title', status: pass ? 'passed' : 'failed', duration: Date.now() - start, error: pass ? undefined : `Title "${title}" does not contain "${params.expected}"` };
  },
};

const assertValue: BlockDefinition = {
  type: 'assert_value',
  category: 'assertion',
  label: 'Assert Input Value',
  description: 'Assert the value of an input field',
  color: '#FF9800',
  inputs: [
    { name: 'selector', label: 'Selector', type: 'text', required: true },
    { name: 'expected', label: 'Expected Value', type: 'text', required: true },
  ],
  async execute(params, ctx) {
    const page = ctx.page as any;
    const start = Date.now();
    const value = await page.locator(String(params.selector)).inputValue();
    const pass = value === String(params.expected);
    return { stepId: '', type: 'assert_value', status: pass ? 'passed' : 'failed', duration: Date.now() - start, error: pass ? undefined : `Expected "${params.expected}", got "${value}"` };
  },
};

const assertCount: BlockDefinition = {
  type: 'assert_count',
  category: 'assertion',
  label: 'Assert Element Count',
  description: 'Assert the number of matching elements',
  color: '#FF9800',
  inputs: [
    { name: 'selector', label: 'Selector', type: 'text', required: true },
    { name: 'count', label: 'Expected Count', type: 'number', required: true },
  ],
  async execute(params, ctx) {
    const page = ctx.page as any;
    const start = Date.now();
    const actual = await page.locator(String(params.selector)).count();
    const pass = actual === Number(params.count);
    return { stepId: '', type: 'assert_count', status: pass ? 'passed' : 'failed', duration: Date.now() - start, error: pass ? undefined : `Expected ${params.count} elements, found ${actual}` };
  },
};

// ─── Register ────────────────────────────────────────────────────────────────

export function registerAssertionBlocks(): void {
  [assertVisible, assertText, assertUrl, assertTitle, assertValue, assertCount].forEach(registerBlock);
}
