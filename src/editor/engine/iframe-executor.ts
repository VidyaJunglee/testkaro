import { TestStep } from '../../schema';

export interface StepExecutionResult {
  stepId: string;
  type: string;
  status: 'passed' | 'failed' | 'skipped';
  duration: number;
  error?: string;
  screenshot?: string; // base64 data URL
}

export interface ExecutionEvent {
  type: 'step-start' | 'step-end' | 'log' | 'network' | 'screenshot' | 'done' | 'variable';
  data: any;
}

type EventCallback = (event: ExecutionEvent) => void;

const PROXY_BASE = 'http://localhost:3001/proxy?url=';

function proxyUrl(url: string): string {
  // If already a proxy URL or localhost, don't proxy
  if (url.startsWith('http://localhost:3001')) return url;
  if (url.startsWith('http://localhost:') || url.startsWith('http://127.0.0.1:')) return url;
  return `${PROXY_BASE}${encodeURIComponent(url)}`;
}

/**
 * Executes test steps against an iframe's contentDocument (same-origin only).
 */
export class IframeExecutor {
  private iframe: HTMLIFrameElement;
  private aborted = false;
  private onEvent: EventCallback;
  private variables: Map<string, unknown> = new Map();

  private setVar(name: string, value: unknown) {
    this.variables.set(name, value);
    this.onEvent({ type: 'variable', data: { name, value: String(value ?? '') } });
  }

  constructor(iframe: HTMLIFrameElement, onEvent: EventCallback) {
    this.iframe = iframe;
    this.onEvent = onEvent;
  }

  abort() {
    this.aborted = true;
  }

  private get doc(): Document {
    const doc = this.iframe.contentDocument;
    if (!doc) throw new Error('Cannot access iframe document. Is the target same-origin?');
    return doc;
  }

  private resolveVars(value: unknown): unknown {
    if (typeof value !== 'string') return value;
    return value.replace(/\$\{(\w+)\}/g, (_, name) => {
      const v = this.variables.get(name);
      return v !== undefined ? String(v) : `\${${name}}`;
    });
  }

  private resolveParams(params: Record<string, unknown>): Record<string, unknown> {
    const resolved: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(params)) {
      resolved[k] = this.resolveVars(v);
    }
    return resolved;
  }

  private querySelector(selector: string): Element | null {
    return this.doc.querySelector(selector);
  }

  private async waitForSelector(selector: string, timeout = 5000): Promise<Element> {
    const start = Date.now();
    while (Date.now() - start < timeout) {
      const el = this.querySelector(selector);
      if (el) return el;
      await new Promise(r => setTimeout(r, 100));
    }
    throw new Error(`Element not found: "${selector}" (waited ${timeout}ms)`);
  }

  private async wait(ms: number) {
    await new Promise(r => setTimeout(r, ms));
  }

  async executeSteps(steps: TestStep[]): Promise<StepExecutionResult[]> {
    const results: StepExecutionResult[] = [];
    this.aborted = false;

    for (const step of steps) {
      if (this.aborted) {
        results.push({ stepId: step.id, type: step.type, status: 'skipped', duration: 0 });
        continue;
      }

      this.onEvent({ type: 'step-start', data: { stepId: step.id, type: step.type } });
      const start = Date.now();

      try {
        const params = this.resolveParams(step.params);
        await this.executeStep(step.type, params);
        const duration = Date.now() - start;
        const result: StepExecutionResult = { stepId: step.id, type: step.type, status: 'passed', duration };
        results.push(result);
        this.onEvent({ type: 'step-end', data: result });
      } catch (err: any) {
        const duration = Date.now() - start;
        // Capture screenshot on failure
        let screenshot: string | undefined;
        try {
          screenshot = await this.captureScreenshot();
        } catch { /* ignore */ }
        const result: StepExecutionResult = {
          stepId: step.id, type: step.type, status: 'failed', duration,
          error: err.message || String(err), screenshot,
        };
        results.push(result);
        this.onEvent({ type: 'step-end', data: result });
        // Stop execution on first failure
        this.aborted = true;
      }
    }

    this.onEvent({ type: 'done', data: { results } });
    return results;
  }

  private async executeStep(type: string, params: Record<string, unknown>): Promise<void> {
    switch (type) {
      case 'navigate': {
        const url = String(params.url || '');
        if (!url) throw new Error('Navigate step requires a "url" parameter');
        const proxied = proxyUrl(url);
        // Attach load listener BEFORE setting src to avoid race condition
        const loadPromise = this.waitForLoad();
        this.iframe.src = proxied;
        await loadPromise;
        break;
      }
      case 'click': {
        const el = await this.waitForSelector(String(params.selector));
        (el as HTMLElement).click();
        break;
      }
      case 'double-click': {
        const el = await this.waitForSelector(String(params.selector));
        const event = new MouseEvent('dblclick', { bubbles: true });
        el.dispatchEvent(event);
        break;
      }
      case 'fill': {
        const el = await this.waitForSelector(String(params.selector)) as HTMLInputElement;
        el.focus();
        el.value = '';
        // Trigger input events to simulate real typing
        const nativeInputValueSetter = Object.getOwnPropertyDescriptor(
          window.HTMLInputElement.prototype, 'value'
        )?.set || Object.getOwnPropertyDescriptor(
          window.HTMLTextAreaElement.prototype, 'value'
        )?.set;
        nativeInputValueSetter?.call(el, String(params.value || ''));
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        break;
      }
      case 'clear': {
        const el = await this.waitForSelector(String(params.selector)) as HTMLInputElement;
        el.value = '';
        el.dispatchEvent(new Event('input', { bubbles: true }));
        el.dispatchEvent(new Event('change', { bubbles: true }));
        break;
      }
      case 'select': {
        const el = await this.waitForSelector(String(params.selector)) as HTMLSelectElement;
        el.value = String(params.value || '');
        el.dispatchEvent(new Event('change', { bubbles: true }));
        break;
      }
      case 'check':
      case 'uncheck': {
        const el = await this.waitForSelector(String(params.selector)) as HTMLInputElement;
        const shouldCheck = type === 'check';
        if (el.checked !== shouldCheck) el.click();
        break;
      }
      case 'hover': {
        const el = await this.waitForSelector(String(params.selector));
        el.dispatchEvent(new MouseEvent('mouseenter', { bubbles: true }));
        el.dispatchEvent(new MouseEvent('mouseover', { bubbles: true }));
        break;
      }
      case 'scroll-to': {
        const el = await this.waitForSelector(String(params.selector));
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        break;
      }
      case 'press-key': {
        const key = String(params.key || '');
        const target = params.selector ? await this.waitForSelector(String(params.selector)) : this.doc.body;
        target.dispatchEvent(new KeyboardEvent('keydown', { key, bubbles: true }));
        target.dispatchEvent(new KeyboardEvent('keyup', { key, bubbles: true }));
        break;
      }
      case 'wait': {
        await this.wait(Number(params.duration || 1000));
        break;
      }
      case 'wait-for-element': {
        await this.waitForSelector(String(params.selector), Number(params.timeout || 5000));
        break;
      }
      case 'assert-visible': {
        const el = await this.waitForSelector(String(params.selector));
        const rect = el.getBoundingClientRect();
        if (rect.width === 0 && rect.height === 0) throw new Error(`Element "${params.selector}" is not visible`);
        break;
      }
      case 'assert-hidden': {
        const el = this.querySelector(String(params.selector));
        if (el) {
          const rect = el.getBoundingClientRect();
          if (rect.width > 0 || rect.height > 0) throw new Error(`Element "${params.selector}" is visible but expected hidden`);
        }
        break;
      }
      case 'assert-text': {
        const el = await this.waitForSelector(String(params.selector));
        const text = el.textContent || '';
        const expected = String(params.text || '');
        const exact = params.exact !== false;
        if (exact ? text.trim() !== expected : !text.includes(expected)) {
          throw new Error(`Text assertion failed.\nExpected: "${expected}"\nActual: "${text.trim()}"`);
        }
        break;
      }
      case 'assert-value': {
        const el = await this.waitForSelector(String(params.selector)) as HTMLInputElement;
        const actual = el.value;
        const expected = String(params.value || '');
        if (actual !== expected) {
          throw new Error(`Value assertion failed.\nExpected: "${expected}"\nActual: "${actual}"`);
        }
        break;
      }
      case 'assert-url': {
        const currentUrl = this.iframe.contentWindow?.location.href || '';
        const expected = String(params.url || '');
        const contains = params.contains === true;
        if (contains ? !currentUrl.includes(expected) : currentUrl !== expected) {
          throw new Error(`URL assertion failed.\nExpected: "${expected}"\nActual: "${currentUrl}"`);
        }
        break;
      }
      case 'assert-count': {
        const els = this.doc.querySelectorAll(String(params.selector));
        const expected = Number(params.count || 0);
        if (els.length !== expected) {
          throw new Error(`Count assertion failed.\nExpected: ${expected}\nActual: ${els.length}`);
        }
        break;
      }
      case 'extract-text': {
        const el = await this.waitForSelector(String(params.selector));
        const text = el.textContent || '';
        const varName = String(params.variable || 'extractedText');
        this.setVar(varName, text.trim());
        break;
      }
      case 'extract-attribute': {
        const el = await this.waitForSelector(String(params.selector));
        const attr = el.getAttribute(String(params.attribute || ''));
        const varName = String(params.variable || 'extractedAttr');
        this.setVar(varName, attr);
        break;
      }
      case 'extract-value': {
        const el = await this.waitForSelector(String(params.selector)) as HTMLInputElement;
        const varName = String(params.variable || 'extractedValue');
        this.setVar(varName, el.value);
        break;
      }
      case 'set-variable': {
        const varName = String(params.name || '');
        this.setVar(varName, params.value);
        break;
      }
      case 'javascript': {
        const code = String(params.code || '');
        const fn = new Function('document', 'window', 'variables', code);
        const result = fn(this.doc, this.iframe.contentWindow, this.variables);
        if (params.variable && result !== undefined) {
          this.setVar(String(params.variable), result);
        }
        break;
      }
      default:
        throw new Error(`Unknown step type: "${type}"`);
    }
  }

  private waitForLoad(): Promise<void> {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Page load timeout (10s)')), 10000);
      this.iframe.addEventListener('load', () => {
        clearTimeout(timeout);
        resolve();
      }, { once: true });
    });
  }

  private async captureScreenshot(): Promise<string> {
    // Use canvas to capture iframe content (same-origin only)
    const doc = this.doc;
    const body = doc.body;
    if (!body) throw new Error('No body');

    // Simple approach: serialize to canvas via foreignObject SVG
    const width = body.scrollWidth || 800;
    const height = body.scrollHeight || 600;
    const html = new XMLSerializer().serializeToString(doc.documentElement);

    const svg = `
      <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
        <foreignObject width="100%" height="100%">
          ${html}
        </foreignObject>
      </svg>
    `;

    const canvas = document.createElement('canvas');
    canvas.width = Math.min(width, 1280);
    canvas.height = Math.min(height, 720);
    const ctx = canvas.getContext('2d')!;

    const img = new Image();
    const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' });
    const url = URL.createObjectURL(blob);

    return new Promise((resolve, reject) => {
      img.onload = () => {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(url);
        resolve(canvas.toDataURL('image/png'));
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Screenshot capture failed'));
      };
      img.src = url;
    });
  }
}
