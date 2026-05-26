import { BlockDefinition } from '../schema';
import { registerBlock } from './registry';

// ─── Navigation Blocks ───────────────────────────────────────────────────────

const navigate: BlockDefinition = {
  type: 'navigate',
  category: 'navigation',
  label: 'Navigate to URL',
  description: 'Open a URL in the browser',
  color: '#4CAF50',
  inputs: [
    { name: 'url', label: 'URL', type: 'text', required: true, placeholder: 'https://example.com' },
  ],
  async execute(params, ctx) {
    const page = ctx.page as any;
    const start = Date.now();
    const url = String(params.url);
    await page.goto(url.startsWith('http') ? url : `${ctx.baseUrl || ''}${url}`);
    return { stepId: '', type: 'navigate', status: 'passed', duration: Date.now() - start };
  },
};

const waitForElement: BlockDefinition = {
  type: 'wait_for_element',
  category: 'navigation',
  label: 'Wait for Element',
  description: 'Wait until an element appears on the page',
  color: '#4CAF50',
  inputs: [
    { name: 'selector', label: 'Selector', type: 'text', required: true, placeholder: '#login-btn' },
    { name: 'timeout', label: 'Timeout (ms)', type: 'number', default: 5000 },
  ],
  async execute(params, ctx) {
    const page = ctx.page as any;
    const start = Date.now();
    await page.waitForSelector(String(params.selector), { timeout: Number(params.timeout || 5000) });
    return { stepId: '', type: 'wait_for_element', status: 'passed', duration: Date.now() - start };
  },
};

const wait: BlockDefinition = {
  type: 'wait',
  category: 'navigation',
  label: 'Wait (delay)',
  description: 'Pause execution for a duration',
  color: '#4CAF50',
  inputs: [
    { name: 'ms', label: 'Milliseconds', type: 'number', required: true, default: 1000 },
  ],
  async execute(params) {
    const start = Date.now();
    await new Promise(r => setTimeout(r, Number(params.ms)));
    return { stepId: '', type: 'wait', status: 'passed', duration: Date.now() - start };
  },
};

const screenshot: BlockDefinition = {
  type: 'screenshot',
  category: 'navigation',
  label: 'Take Screenshot',
  description: 'Capture a screenshot of the current page',
  color: '#4CAF50',
  inputs: [
    { name: 'name', label: 'File Name', type: 'text', placeholder: 'step-1' },
  ],
  async execute(params, ctx) {
    const page = ctx.page as any;
    const start = Date.now();
    const path = `testflow-results/screenshots/${params.name || Date.now()}.png`;
    await page.screenshot({ path });
    return { stepId: '', type: 'screenshot', status: 'passed', duration: Date.now() - start, output: path };
  },
};

// ─── Register ────────────────────────────────────────────────────────────────

export function registerNavigationBlocks(): void {
  [navigate, waitForElement, wait, screenshot].forEach(registerBlock);
}
