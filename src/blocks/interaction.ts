import { BlockDefinition } from '../schema';
import { registerBlock } from './registry';

// ─── Interaction Blocks ──────────────────────────────────────────────────────

const click: BlockDefinition = {
  type: 'click',
  category: 'interaction',
  label: 'Click',
  description: 'Click on an element',
  color: '#2196F3',
  inputs: [
    { name: 'selector', label: 'Selector', type: 'text', required: true, placeholder: 'button.submit' },
  ],
  async execute(params, ctx) {
    const page = ctx.page as any;
    const start = Date.now();
    await page.click(String(params.selector));
    return { stepId: '', type: 'click', status: 'passed', duration: Date.now() - start };
  },
};

const fill: BlockDefinition = {
  type: 'fill',
  category: 'interaction',
  label: 'Fill Input',
  description: 'Clear and type text into an input field',
  color: '#2196F3',
  inputs: [
    { name: 'selector', label: 'Selector', type: 'text', required: true, placeholder: 'input[name="email"]' },
    { name: 'value', label: 'Value', type: 'text', required: true, placeholder: 'user@example.com' },
  ],
  async execute(params, ctx) {
    const page = ctx.page as any;
    const start = Date.now();
    await page.fill(String(params.selector), String(params.value));
    return { stepId: '', type: 'fill', status: 'passed', duration: Date.now() - start };
  },
};

const type: BlockDefinition = {
  type: 'type',
  category: 'interaction',
  label: 'Type Text',
  description: 'Type text character by character (with keyboard events)',
  color: '#2196F3',
  inputs: [
    { name: 'selector', label: 'Selector', type: 'text', required: true },
    { name: 'text', label: 'Text', type: 'text', required: true },
  ],
  async execute(params, ctx) {
    const page = ctx.page as any;
    const start = Date.now();
    await page.locator(String(params.selector)).pressSequentially(String(params.text));
    return { stepId: '', type: 'type', status: 'passed', duration: Date.now() - start };
  },
};

const select: BlockDefinition = {
  type: 'select',
  category: 'interaction',
  label: 'Select Option',
  description: 'Select a dropdown option by value',
  color: '#2196F3',
  inputs: [
    { name: 'selector', label: 'Selector', type: 'text', required: true },
    { name: 'value', label: 'Value', type: 'text', required: true },
  ],
  async execute(params, ctx) {
    const page = ctx.page as any;
    const start = Date.now();
    await page.selectOption(String(params.selector), String(params.value));
    return { stepId: '', type: 'select', status: 'passed', duration: Date.now() - start };
  },
};

const check: BlockDefinition = {
  type: 'check',
  category: 'interaction',
  label: 'Check/Uncheck',
  description: 'Check or uncheck a checkbox',
  color: '#2196F3',
  inputs: [
    { name: 'selector', label: 'Selector', type: 'text', required: true },
    { name: 'checked', label: 'Checked', type: 'checkbox', default: true },
  ],
  async execute(params, ctx) {
    const page = ctx.page as any;
    const start = Date.now();
    if (params.checked) {
      await page.check(String(params.selector));
    } else {
      await page.uncheck(String(params.selector));
    }
    return { stepId: '', type: 'check', status: 'passed', duration: Date.now() - start };
  },
};

const hover: BlockDefinition = {
  type: 'hover',
  category: 'interaction',
  label: 'Hover',
  description: 'Hover over an element',
  color: '#2196F3',
  inputs: [
    { name: 'selector', label: 'Selector', type: 'text', required: true },
  ],
  async execute(params, ctx) {
    const page = ctx.page as any;
    const start = Date.now();
    await page.hover(String(params.selector));
    return { stepId: '', type: 'hover', status: 'passed', duration: Date.now() - start };
  },
};

const pressKey: BlockDefinition = {
  type: 'press_key',
  category: 'interaction',
  label: 'Press Key',
  description: 'Press a keyboard key (Enter, Tab, Escape, etc.)',
  color: '#2196F3',
  inputs: [
    { name: 'key', label: 'Key', type: 'text', required: true, placeholder: 'Enter' },
    { name: 'selector', label: 'Selector (optional)', type: 'text' },
  ],
  async execute(params, ctx) {
    const page = ctx.page as any;
    const start = Date.now();
    if (params.selector) {
      await page.locator(String(params.selector)).press(String(params.key));
    } else {
      await page.keyboard.press(String(params.key));
    }
    return { stepId: '', type: 'press_key', status: 'passed', duration: Date.now() - start };
  },
};

const doubleClick: BlockDefinition = {
  type: 'double_click',
  category: 'interaction',
  label: 'Double Click',
  description: 'Double-click on an element',
  color: '#2196F3',
  inputs: [
    { name: 'selector', label: 'Selector', type: 'text', required: true },
  ],
  async execute(params, ctx) {
    const page = ctx.page as any;
    const start = Date.now();
    await page.dblclick(String(params.selector));
    return { stepId: '', type: 'double_click', status: 'passed', duration: Date.now() - start };
  },
};

const rightClick: BlockDefinition = {
  type: 'right_click',
  category: 'interaction',
  label: 'Right Click',
  description: 'Right-click on an element (opens context menu)',
  color: '#2196F3',
  inputs: [
    { name: 'selector', label: 'Selector', type: 'text', required: true },
  ],
  async execute(params, ctx) {
    const page = ctx.page as any;
    const start = Date.now();
    await page.click(String(params.selector), { button: 'right' });
    return { stepId: '', type: 'right_click', status: 'passed', duration: Date.now() - start };
  },
};

const clear: BlockDefinition = {
  type: 'clear',
  category: 'interaction',
  label: 'Clear Input',
  description: 'Clear the value of an input field',
  color: '#2196F3',
  inputs: [
    { name: 'selector', label: 'Selector', type: 'text', required: true },
  ],
  async execute(params, ctx) {
    const page = ctx.page as any;
    const start = Date.now();
    await page.fill(String(params.selector), '');
    return { stepId: '', type: 'clear', status: 'passed', duration: Date.now() - start };
  },
};

const uncheck: BlockDefinition = {
  type: 'uncheck',
  category: 'interaction',
  label: 'Uncheck',
  description: 'Uncheck a checkbox',
  color: '#2196F3',
  inputs: [
    { name: 'selector', label: 'Selector', type: 'text', required: true },
  ],
  async execute(params, ctx) {
    const page = ctx.page as any;
    const start = Date.now();
    await page.uncheck(String(params.selector));
    return { stepId: '', type: 'uncheck', status: 'passed', duration: Date.now() - start };
  },
};

const scrollTo: BlockDefinition = {
  type: 'scroll_to',
  category: 'interaction',
  label: 'Scroll to Element',
  description: 'Scroll an element into view',
  color: '#2196F3',
  inputs: [
    { name: 'selector', label: 'Selector', type: 'text', required: true },
  ],
  async execute(params, ctx) {
    const page = ctx.page as any;
    const start = Date.now();
    await page.locator(String(params.selector)).scrollIntoViewIfNeeded();
    return { stepId: '', type: 'scroll_to', status: 'passed', duration: Date.now() - start };
  },
};

const uploadFile: BlockDefinition = {
  type: 'upload_file',
  category: 'interaction',
  label: 'Upload File',
  description: 'Set a file input to a file path',
  color: '#2196F3',
  inputs: [
    { name: 'selector', label: 'File Input Selector', type: 'text', required: true },
    { name: 'path', label: 'File Path', type: 'text', required: true, placeholder: '/tmp/file.pdf' },
  ],
  async execute(params, ctx) {
    const page = ctx.page as any;
    const start = Date.now();
    await page.setInputFiles(String(params.selector), String(params.path));
    return { stepId: '', type: 'upload_file', status: 'passed', duration: Date.now() - start };
  },
};

// ─── Register ────────────────────────────────────────────────────────────────

export function registerInteractionBlocks(): void {
  [click, fill, type, select, check, hover, pressKey,
   doubleClick, rightClick, clear, uncheck, scrollTo, uploadFile,
  ].forEach(registerBlock);
}
