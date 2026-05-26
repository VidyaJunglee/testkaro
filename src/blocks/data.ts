import { BlockDefinition } from '../schema';
import { registerBlock } from './registry';

// ─── Data Extraction Blocks ──────────────────────────────────────────────────

const getText: BlockDefinition = {
  type: 'get_text',
  category: 'data',
  label: 'Get Text',
  description: 'Get text content of an element and save to variable',
  color: '#00BCD4',
  inputs: [
    { name: 'selector', label: 'Selector', type: 'text', required: true },
    { name: 'saveAs', label: 'Save As Variable', type: 'text', required: true },
  ],
  async execute(params, ctx) {
    const page = ctx.page as any;
    const start = Date.now();
    const text = await page.locator(String(params.selector)).textContent();
    ctx.variables.set(String(params.saveAs), text);
    return { stepId: '', type: 'get_text', status: 'passed', duration: Date.now() - start, output: text };
  },
};

const getAttribute: BlockDefinition = {
  type: 'get_attribute',
  category: 'data',
  label: 'Get Attribute',
  description: 'Get an attribute value from an element',
  color: '#00BCD4',
  inputs: [
    { name: 'selector', label: 'Selector', type: 'text', required: true },
    { name: 'attribute', label: 'Attribute', type: 'text', required: true, placeholder: 'href' },
    { name: 'saveAs', label: 'Save As Variable', type: 'text', required: true },
  ],
  async execute(params, ctx) {
    const page = ctx.page as any;
    const start = Date.now();
    const value = await page.locator(String(params.selector)).getAttribute(String(params.attribute));
    ctx.variables.set(String(params.saveAs), value);
    return { stepId: '', type: 'get_attribute', status: 'passed', duration: Date.now() - start, output: value };
  },
};

const getInputValue: BlockDefinition = {
  type: 'get_input_value',
  category: 'data',
  label: 'Get Input Value',
  description: 'Get the current value of an input field',
  color: '#00BCD4',
  inputs: [
    { name: 'selector', label: 'Selector', type: 'text', required: true },
    { name: 'saveAs', label: 'Save As Variable', type: 'text', required: true },
  ],
  async execute(params, ctx) {
    const page = ctx.page as any;
    const start = Date.now();
    const value = await page.locator(String(params.selector)).inputValue();
    ctx.variables.set(String(params.saveAs), value);
    return { stepId: '', type: 'get_input_value', status: 'passed', duration: Date.now() - start, output: value };
  },
};

const getUrl: BlockDefinition = {
  type: 'get_url',
  category: 'data',
  label: 'Get Current URL',
  description: 'Get the current page URL',
  color: '#00BCD4',
  inputs: [
    { name: 'saveAs', label: 'Save As Variable', type: 'text', required: true },
  ],
  async execute(params, ctx) {
    const page = ctx.page as any;
    const start = Date.now();
    const url = page.url();
    ctx.variables.set(String(params.saveAs), url);
    return { stepId: '', type: 'get_url', status: 'passed', duration: Date.now() - start, output: url };
  },
};

// ─── Register ────────────────────────────────────────────────────────────────

export function registerDataBlocks(): void {
  [getText, getAttribute, getInputValue, getUrl].forEach(registerBlock);
}
