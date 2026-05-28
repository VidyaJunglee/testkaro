import { chromium, Browser, BrowserContext, Page, ConsoleMessage } from 'playwright';

export interface TestStep {
  id: string;
  type: string;
  params: Record<string, unknown>;
  children?: TestStep[];
}

export interface ExecutionConfig {
  headed: boolean;
  slowMo?: number;
  viewport?: { width: number; height: number };
  recordVideo?: boolean;
}

export type EventEmitter = (event: ExecutionEvent) => void;

export interface ExecutionEvent {
  type: 'step-start' | 'step-end' | 'console' | 'network' | 'variable' | 'screenshot' | 'done' | 'browser-ready' | 'error';
  data: any;
}

export class PlaywrightExecutor {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private aborted = false;
  private paused = false;
  private resumeResolve: (() => void) | null = null;
  private variables: Map<string, unknown> = new Map();
  private emit: EventEmitter;
  private config: ExecutionConfig;
  private networkId = 0;
  breakpoints: Set<string> = new Set();

  constructor(emit: EventEmitter, config: ExecutionConfig) {
    this.emit = emit;
    this.config = config;
  }

  pause(): void {
    this.paused = true;
  }

  resume(): void {
    this.paused = false;
    if (this.resumeResolve) {
      this.resumeResolve();
      this.resumeResolve = null;
    }
  }

  private async waitIfPaused(): Promise<void> {
    if (!this.paused) return;
    this.emit({ type: 'paused' as any, data: {} });
    await new Promise<void>(resolve => { this.resumeResolve = resolve; });
    this.emit({ type: 'resumed' as any, data: {} });
  }

  async launch(): Promise<void> {
    this.browser = await chromium.launch({
      headless: !this.config.headed,
      slowMo: this.config.slowMo || 0,
    });

    const contextOptions: any = {
      viewport: this.config.viewport || { width: 1280, height: 720 },
    };

    if (this.config.recordVideo) {
      contextOptions.recordVideo = { dir: '/tmp/testkaro-videos', size: { width: 1280, height: 720 } };
    }

    this.context = await this.browser.newContext(contextOptions);
    this.page = await this.context.newPage();

    // Capture console
    this.page.on('console', (msg: ConsoleMessage) => {
      this.emit({
        type: 'console',
        data: {
          level: msg.type() === 'error' ? 'error' : msg.type() === 'warning' ? 'warn' : 'log',
          message: msg.text(),
          timestamp: Date.now(),
        },
      });
    });

    // Capture network
    this.page.on('request', (req) => {
      const id = `net-${++this.networkId}`;
      (req as any).__testkaroId = id;
      (req as any).__testkaroStart = Date.now();
      this.emit({
        type: 'network',
        data: {
          id,
          method: req.method(),
          url: req.url(),
          phase: 'request',
          timestamp: Date.now(),
          requestHeaders: req.headers(),
          postData: req.postData() || null,
        },
      });
    });

    this.page.on('response', (res) => {
      const req = res.request();
      const id = (req as any).__testkaroId || `net-${++this.networkId}`;
      const startTime = (req as any).__testkaroStart || Date.now();
      this.emit({
        type: 'network',
        data: {
          id,
          method: req.method(),
          url: res.url(),
          status: res.status(),
          phase: 'response',
          timestamp: Date.now(),
          duration: Date.now() - startTime,
          requestHeaders: req.headers(),
          postData: req.postData() || null,
          responseHeaders: res.headers(),
        },
      });
    });

    this.page.on('requestfailed', (req) => {
      const id = (req as any).__testkaroId || `net-${++this.networkId}`;
      this.emit({
        type: 'network',
        data: {
          id,
          method: req.method(),
          url: req.url(),
          phase: 'error',
          error: req.failure()?.errorText || 'Request failed',
          timestamp: Date.now(),
          requestHeaders: req.headers(),
          postData: req.postData() || null,
        },
      });
    });

    this.emit({ type: 'browser-ready', data: { headed: this.config.headed } });
  }

  abort() {
    this.aborted = true;
  }

  async close(): Promise<string | undefined> {
    let videoPath: string | undefined;
    if (this.config.recordVideo && this.page) {
      try {
        const video = this.page.video();
        if (video) videoPath = await video.path();
      } catch {}
    }
    try { await this.context?.close(); } catch {}
    try { await this.browser?.close(); } catch {}
    this.browser = null;
    this.context = null;
    this.page = null;
    return videoPath;
  }

  private setVar(name: string, value: unknown) {
    this.variables.set(name, value);
    this.emit({ type: 'variable', data: { name, value: String(value ?? '') } });
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

  async executeSteps(steps: TestStep[]): Promise<void> {
    this.aborted = false;
    const results: any[] = [];

    for (const step of steps) {
      if (this.aborted) {
        this.emit({ type: 'step-end', data: { stepId: step.id, type: step.type, status: 'skipped', duration: 0 } });
        continue;
      }

      // Breakpoint check
      if (this.breakpoints.has(step.id)) {
        this.paused = true;
      }
      await this.waitIfPaused();
      if (this.aborted) {
        this.emit({ type: 'step-end', data: { stepId: step.id, type: step.type, status: 'skipped', duration: 0 } });
        continue;
      }

      this.emit({ type: 'step-start', data: { stepId: step.id, type: step.type } });
      const start = Date.now();

      try {
        const params = this.resolveParams(step.params);
        await this.executeStep(step.type, params, step.children);
        const duration = Date.now() - start;

        const result = { stepId: step.id, type: step.type, status: 'passed', duration, screenshot: undefined };
        results.push(result);
        this.emit({ type: 'step-end', data: result });
      } catch (err: any) {
        const duration = Date.now() - start;
        let screenshot: string | undefined;
        try {
          if (this.page) {
            const buf = await this.page.screenshot({ type: 'png' });
            screenshot = `data:image/png;base64,${buf.toString('base64')}`;
          }
        } catch {}

        const result = {
          stepId: step.id, type: step.type, status: 'failed', duration,
          error: err.message || String(err), screenshot,
        };
        results.push(result);
        this.emit({ type: 'step-end', data: result });
        this.aborted = true;
      }
    }

    const videoPath = await this.close();
    if (!this.aborted) {
      this.emit({ type: 'done', data: { results, videoPath } });
    }
  }

  private async executeStep(type: string, params: Record<string, unknown>, children?: TestStep[]): Promise<void> {
    const page = this.page;
    if (!page) throw new Error('Browser not launched');

    const timeout = Number(params.timeout || 10000);

    switch (type) {
      // === NAVIGATION ===
      case 'navigate': {
        const url = String(params.url || '');
        if (!url) throw new Error('Navigate requires a URL');
        await page.goto(url, { waitUntil: 'domcontentloaded', timeout });
        break;
      }
      case 'wait': {
        await page.waitForTimeout(Number(params.ms || params.duration || 1000));
        break;
      }
      case 'wait_for_element':
      case 'wait-for-element': {
        await page.waitForSelector(String(params.selector), { timeout });
        break;
      }
      case 'screenshot': {
        const buf = await page.screenshot({ type: 'png', fullPage: !!params.fullPage });
        const data = `data:image/png;base64,${buf.toString('base64')}`;
        this.emit({ type: 'screenshot', data: { screenshot: data, label: params.name || params.label || 'Manual screenshot' } });
        break;
      }

      // === INTERACTION ===
      case 'click': {
        const selector = String(params.selector);
        await page.click(selector, { timeout });
        break;
      }
      case 'double-click':
      case 'double_click': {
        await page.dblclick(String(params.selector), { timeout });
        break;
      }
      case 'fill': {
        await page.fill(String(params.selector), String(params.value || ''), { timeout });
        break;
      }
      case 'type': {
        await page.locator(String(params.selector)).pressSequentially(String(params.text || params.value || ''), { delay: 50 });
        break;
      }
      case 'clear': {
        await page.fill(String(params.selector), '', { timeout });
        break;
      }
      case 'select': {
        await page.selectOption(String(params.selector), String(params.value || ''), { timeout });
        break;
      }
      case 'check': {
        if (params.checked === false) {
          await page.uncheck(String(params.selector), { timeout });
        } else {
          await page.check(String(params.selector), { timeout });
        }
        break;
      }
      case 'uncheck': {
        await page.uncheck(String(params.selector), { timeout });
        break;
      }
      case 'hover': {
        await page.hover(String(params.selector), { timeout });
        break;
      }
      case 'scroll-to':
      case 'scroll_to': {
        await page.locator(String(params.selector)).scrollIntoViewIfNeeded({ timeout });
        break;
      }
      case 'press-key':
      case 'press_key': {
        const target = params.selector ? page.locator(String(params.selector)) : page;
        if ('press' in target) {
          await (target as any).press(String(params.key || ''));
        } else {
          await page.keyboard.press(String(params.key || ''));
        }
        break;
      }
      case 'upload_file':
      case 'upload-file': {
        await page.setInputFiles(String(params.selector), String(params.path || ''));
        break;
      }

      // === ASSERTIONS ===
      case 'assert_visible':
      case 'assert-visible': {
        await page.locator(String(params.selector)).waitFor({ state: 'visible', timeout });
        break;
      }
      case 'assert_hidden':
      case 'assert-hidden': {
        await page.locator(String(params.selector)).waitFor({ state: 'hidden', timeout });
        break;
      }
      case 'assert_text':
      case 'assert-text': {
        const locator = page.locator(String(params.selector));
        const actual = (await locator.textContent({ timeout })) || '';
        const expected = String(params.expected || params.text || '');
        const exact = params.exact === true;
        if (exact ? actual.trim() !== expected : !actual.includes(expected)) {
          throw new Error(`Text assertion failed.\nExpected: "${expected}"\nActual: "${actual.trim()}"`);
        }
        break;
      }
      case 'assert_value':
      case 'assert-value': {
        const actual = await page.inputValue(String(params.selector), { timeout });
        const expected = String(params.expected || params.value || '');
        if (actual !== expected) {
          throw new Error(`Value assertion failed.\nExpected: "${expected}"\nActual: "${actual}"`);
        }
        break;
      }
      case 'assert_url':
      case 'assert-url': {
        const currentUrl = page.url();
        const expected = String(params.expected || params.url || '');
        const mode = params.mode || (params.contains === true ? 'contains' : 'equals');
        if (mode === 'contains' ? !currentUrl.includes(expected) : 
            mode === 'startsWith' ? !currentUrl.startsWith(expected) : 
            currentUrl !== expected) {
          throw new Error(`URL assertion failed.\nExpected: "${expected}" (${mode})\nActual: "${currentUrl}"`);
        }
        break;
      }
      case 'assert_title':
      case 'assert-title': {
        const title = await page.title();
        const expected = String(params.expected || params.title || '');
        if (!title.includes(expected)) {
          throw new Error(`Title assertion failed.\nExpected to contain: "${expected}"\nActual: "${title}"`);
        }
        break;
      }
      case 'assert_count':
      case 'assert-count': {
        const count = await page.locator(String(params.selector)).count();
        const expected = Number(params.count || 0);
        if (count !== expected) {
          throw new Error(`Count assertion failed.\nExpected: ${expected}\nActual: ${count}`);
        }
        break;
      }

      // === DATA EXTRACTION ===
      case 'get_text':
      case 'extract-text': {
        const text = await page.locator(String(params.selector)).textContent({ timeout }) || '';
        this.setVar(String(params.saveAs || params.variable || 'extractedText'), text.trim());
        break;
      }
      case 'get_attribute':
      case 'extract-attribute': {
        const attr = await page.locator(String(params.selector)).getAttribute(String(params.attribute || ''), { timeout });
        this.setVar(String(params.saveAs || params.variable || 'extractedAttr'), attr || '');
        break;
      }
      case 'get_input_value':
      case 'extract-value': {
        const val = await page.inputValue(String(params.selector), { timeout });
        this.setVar(String(params.saveAs || params.variable || 'extractedValue'), val);
        break;
      }
      case 'get_url': {
        this.setVar(String(params.saveAs || params.variable || 'currentUrl'), page.url());
        break;
      }

      // === LOGIC ===
      case 'set_variable':
      case 'set-variable': {
        this.setVar(String(params.name || ''), params.value);
        break;
      }
      case 'log': {
        const msg = String(this.resolveVars(params.message) || '');
        this.emit({ type: 'console', data: { level: 'log', message: `[TestKaro] ${msg}`, timestamp: Date.now() } });
        break;
      }
      case 'javascript': {
        const code = String(params.code || '');
        const result = await page.evaluate(code);
        if (params.variable && result !== undefined) {
          this.setVar(String(params.variable), result);
        }
        break;
      }
      case 'if': {
        let condResult: boolean;
        if (params.condition) {
          // Legacy: raw JS expression
          condResult = !!(await page.evaluate(String(params.condition)));
        } else {
          // Visual builder: variable + operator + value
          const varName = String(params.variable || '');
          const varValue = this.variables.get(varName) ?? '';
          const operator = String(params.operator || 'truthy');
          const compareValue = params.value !== undefined ? String(params.value) : '';
          switch (operator) {
            case 'equals': condResult = String(varValue) === compareValue; break;
            case 'notEquals': condResult = String(varValue) !== compareValue; break;
            case 'contains': condResult = String(varValue).includes(compareValue); break;
            case 'truthy': condResult = !!varValue; break;
            default: condResult = !!varValue;
          }
        }
        if (condResult && children && children.length > 0) {
          await this.executeSteps(children);
        }
        break;
      }
      case 'repeat': {
        const times = Number(params.times || 1);
        if (children && children.length > 0) {
          for (let i = 0; i < times; i++) {
            this.setVar('__iteration', i);
            await this.executeSteps(children);
            if (this.aborted) break;
          }
        }
        break;
      }

      // === API ===
      case 'api_get':
      case 'api_post':
      case 'api_put':
      case 'api_delete': {
        const method = type.replace('api_', '').toUpperCase();
        const url = String(params.url || '');
        const headers = params.headers ? JSON.parse(String(params.headers)) : {};
        const body = params.body ? String(params.body) : undefined;

        const response = await page.evaluate(async ({ url, method, headers, body }) => {
          const res = await fetch(url, { method, headers, body });
          const text = await res.text();
          return { status: res.status, body: text, headers: Object.fromEntries(res.headers.entries()) };
        }, { url, method, headers, body });

        if (params.saveAs || params.variable) {
          this.setVar(String(params.saveAs || params.variable), response.body);
        }
        this.setVar('__lastApiStatus', response.status);
        this.setVar('__lastApiBody', response.body);
        break;
      }
      case 'api_assert_status': {
        const expected = Number(params.expected || params.status || 200);
        const actual = Number(this.variables.get('__lastApiStatus') || 0);
        if (actual !== expected) {
          throw new Error(`API status assertion failed.\nExpected: ${expected}\nActual: ${actual}`);
        }
        break;
      }

      default:
        throw new Error(`Unknown step type: "${type}"`);
    }
  }
}
