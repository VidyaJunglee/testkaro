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

const assertHidden: BlockDefinition = {
  type: 'assert_hidden',
  category: 'assertion',
  label: 'Assert Hidden',
  description: 'Assert that an element is not visible',
  color: '#FF9800',
  inputs: [
    { name: 'selector', label: 'Selector', type: 'text', required: true },
  ],
  async execute(params, ctx) {
    const page = ctx.page as any;
    const start = Date.now();
    try {
      await page.locator(String(params.selector)).waitFor({ state: 'hidden', timeout: 5000 });
      return { stepId: '', type: 'assert_hidden', status: 'passed', duration: Date.now() - start };
    } catch (e: any) {
      return { stepId: '', type: 'assert_hidden', status: 'failed', duration: Date.now() - start, error: e.message };
    }
  },
};

const assertAttribute: BlockDefinition = {
  type: 'assert_attribute',
  category: 'assertion',
  label: 'Assert Attribute',
  description: 'Assert an element attribute equals or contains a value',
  color: '#FF9800',
  inputs: [
    { name: 'selector', label: 'Selector', type: 'text', required: true },
    { name: 'attribute', label: 'Attribute', type: 'text', required: true, placeholder: 'href' },
    { name: 'expected', label: 'Expected Value', type: 'text', required: true },
    { name: 'mode', label: 'Match Mode', type: 'dropdown', default: 'equals', options: [{ label: 'Equals', value: 'equals' }, { label: 'Contains', value: 'contains' }] },
  ],
  async execute(params, ctx) {
    const page = ctx.page as any;
    const start = Date.now();
    const attr = await page.locator(String(params.selector)).getAttribute(String(params.attribute));
    const expected = String(params.expected);
    const pass = params.mode === 'contains' ? (attr || '').includes(expected) : attr === expected;
    return { stepId: '', type: 'assert_attribute', status: pass ? 'passed' : 'failed', duration: Date.now() - start, error: pass ? undefined : `Attribute "${params.attribute}": expected "${expected}", got "${attr}"` };
  },
};

const assertChecked: BlockDefinition = {
  type: 'assert_checked',
  category: 'assertion',
  label: 'Assert Checked',
  description: 'Assert a checkbox is checked or unchecked',
  color: '#FF9800',
  inputs: [
    { name: 'selector', label: 'Selector', type: 'text', required: true },
    { name: 'checked', label: 'Expected State', type: 'checkbox', default: true },
  ],
  async execute(params, ctx) {
    const page = ctx.page as any;
    const start = Date.now();
    const actual = await page.locator(String(params.selector)).isChecked();
    const expected = params.checked !== false;
    const pass = actual === expected;
    return { stepId: '', type: 'assert_checked', status: pass ? 'passed' : 'failed', duration: Date.now() - start, error: pass ? undefined : `Checked state: expected ${expected}, got ${actual}` };
  },
};

const assertEnabled: BlockDefinition = {
  type: 'assert_enabled',
  category: 'assertion',
  label: 'Assert Enabled',
  description: 'Assert an element is enabled (not disabled)',
  color: '#FF9800',
  inputs: [
    { name: 'selector', label: 'Selector', type: 'text', required: true },
  ],
  async execute(params, ctx) {
    const page = ctx.page as any;
    const start = Date.now();
    const isEnabled = await page.locator(String(params.selector)).isEnabled();
    return { stepId: '', type: 'assert_enabled', status: isEnabled ? 'passed' : 'failed', duration: Date.now() - start, error: isEnabled ? undefined : `Element is disabled: "${params.selector}"` };
  },
};

const assertDisabled: BlockDefinition = {
  type: 'assert_disabled',
  category: 'assertion',
  label: 'Assert Disabled',
  description: 'Assert an element is disabled',
  color: '#FF9800',
  inputs: [
    { name: 'selector', label: 'Selector', type: 'text', required: true },
  ],
  async execute(params, ctx) {
    const page = ctx.page as any;
    const start = Date.now();
    const isEnabled = await page.locator(String(params.selector)).isEnabled();
    return { stepId: '', type: 'assert_disabled', status: !isEnabled ? 'passed' : 'failed', duration: Date.now() - start, error: !isEnabled ? undefined : `Element is enabled but expected disabled: "${params.selector}"` };
  },
};

const assertCss: BlockDefinition = {
  type: 'assert_css',
  category: 'assertion',
  label: 'Assert CSS',
  description: 'Assert a computed CSS property value',
  color: '#FF9800',
  inputs: [
    { name: 'selector', label: 'Selector', type: 'text', required: true },
    { name: 'property', label: 'CSS Property', type: 'text', required: true, placeholder: 'color' },
    { name: 'expected', label: 'Expected (contains)', type: 'text', required: true },
  ],
  async execute(params, ctx) {
    const page = ctx.page as any;
    const start = Date.now();
    const cssValue = await page.locator(String(params.selector)).evaluate(
      (el: Element, prop: string) => window.getComputedStyle(el).getPropertyValue(prop),
      String(params.property)
    );
    const pass = cssValue.includes(String(params.expected));
    return { stepId: '', type: 'assert_css', status: pass ? 'passed' : 'failed', duration: Date.now() - start, error: pass ? undefined : `CSS "${params.property}": expected to contain "${params.expected}", got "${cssValue.trim()}"` };
  },
};

// ─── Register ────────────────────────────────────────────────────────────────

export function registerAssertionBlocks(): void {
  [assertVisible, assertText, assertUrl, assertTitle, assertValue, assertCount,
   assertHidden, assertAttribute, assertChecked, assertEnabled, assertDisabled, assertCss,
  ].forEach(registerBlock);
}
