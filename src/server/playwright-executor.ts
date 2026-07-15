import { chromium, firefox, webkit, Browser, BrowserContext, Page, ConsoleMessage } from 'playwright';
import os from 'node:os';

const BROWSER_LAUNCHERS = { chromium, firefox, webkit };
export type BrowserType = keyof typeof BROWSER_LAUNCHERS;

export interface TestStep {
  id: string;
  type: string;
  params: Record<string, unknown>;
  children?: TestStep[];
  skip?: boolean;
  description?: string;
  timeout?: number;
  retry?: number;
}

const CONTAINER_TYPES = new Set(['if', 'repeat', 'for_each', 'try_catch']);

export interface ExecutionConfig {
  headed: boolean;
  browserType?: BrowserType;
  slowMo?: number;
  viewport?: { width: number; height: number };
  recordVideo?: boolean;
  videoDir?: string;
  screenshotOnFailure?: boolean;
}

export type EventEmitter = (event: ExecutionEvent) => void;

export interface ExecutionEvent {
  type: 'step-start' | 'step-end' | 'console' | 'network' | 'variable' | 'screenshot' | 'done' | 'browser-ready' | 'error';
  data: any;
}

// Sentinel thrown when a step fails inside try_catch — unwinds through any
// nested containers up to the nearest try_catch, which swallows it.
class CaughtError extends Error {}

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
  private catchDepth = 0;
  private lastCaughtError: string | null = null;
  private results: any[] = [];
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
    const launcher = BROWSER_LAUNCHERS[this.config.browserType ?? 'chromium'];
    this.browser = await launcher.launch({
      headless: !this.config.headed,
      timeout: 30_000,
      // No global slowMo — causes jittery blink on every API call.
      // Instead, targeted inter-step delays are used in executeSteps().
    });

    const contextOptions: any = {
      viewport: this.config.viewport || { width: 1280, height: 720 },
    };

    if (this.config.recordVideo) {
      contextOptions.recordVideo = { dir: this.config.videoDir || `${os.tmpdir()}/testkaro-videos`, size: { width: 1280, height: 720 } };
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

  private requireString(params: Record<string, unknown>, key: string, stepType: string): string {
    const val = params[key];
    if (val === undefined || val === null || String(val).trim() === '') {
      throw new Error(`${stepType}: missing required param "${key}"`);
    }
    return String(val);
  }

  // Top-level entry: resets run state, executes all steps, then runs the
  // done/close epilogue exactly once. Container blocks recurse via
  // executeStepsInner, which must never touch run-level state.
  async run(steps: TestStep[]): Promise<void> {
    this.aborted = false;
    this.results = [];
    this.catchDepth = 0;
    this.lastCaughtError = null;

    try {
      await this.executeStepsInner(steps);
    } catch (err) {
      // CaughtError from a try_catch-less path shouldn't happen; anything else
      // is a hard executor failure — surface it rather than hanging the client.
      if (!(err instanceof CaughtError)) {
        this.emit({ type: 'error', data: { message: (err as Error)?.message || String(err) } });
      }
    }

    // Don't auto-close in headed mode — let user inspect final state.
    // Emit 'done' first; client sends 'stop' when ready to close.
    if (!this.config.headed) {
      const videoPath = await this.close();
      this.emit({ type: 'done', data: { results: this.results, videoPath } });
    } else {
      this.emit({ type: 'done', data: { results: this.results, videoPath: undefined } });
    }
  }

  private async executeStepsInner(steps: TestStep[]): Promise<void> {
    const results = this.results;

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      if (this.aborted) {
        this.emit({ type: 'step-end', data: { stepId: step.id, type: step.type, status: 'skipped', duration: 0 } });
        continue;
      }

      // Skip flag
      if (step.skip) {
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

      // Pre-step delay: lets the UI highlight the step before it fires
      const preDelay = this.config.slowMo ?? 120;
      if (preDelay > 0) await new Promise(r => setTimeout(r, preDelay));

      const start = Date.now();

      try {
        const params = this.resolveParams(step.params);
        if (step.timeout != null && params.timeout == null) params.timeout = step.timeout;

        // Retry only applies to leaf action steps — retrying a container would
        // re-run its already-succeeded children and duplicate their side effects.
        const attempts = !CONTAINER_TYPES.has(step.type) ? 1 + Math.max(0, Number(step.retry) || 0) : 1;
        let lastErr: unknown;
        for (let attempt = 1; attempt <= attempts; attempt++) {
          try {
            await this.executeStep(step.type, params, step.children);
            lastErr = undefined;
            break;
          } catch (err) {
            lastErr = err;
            if (attempt < attempts) {
              const msg = (err as Error)?.message || String(err);
              this.emit({ type: 'console', data: { level: 'warn', message: `[TestKaro] Attempt ${attempt}/${attempts} failed for "${step.type}", retrying: ${msg}`, timestamp: Date.now() } });
              await new Promise(r => setTimeout(r, 300));
            }
          }
        }
        if (lastErr) throw lastErr;

        const duration = Date.now() - start;

        const result = { stepId: step.id, type: step.type, status: 'passed', duration, screenshot: undefined };
        results.push(result);
        this.emit({ type: 'step-end', data: result });
      } catch (err: any) {
        const duration = Date.now() - start;

        if (err instanceof CaughtError) {
          // A nested child already recorded its failure — close out this
          // container step and keep unwinding to the nearest try_catch.
          const result = { stepId: step.id, type: step.type, status: 'failed', duration, error: this.lastCaughtError };
          results.push(result);
          this.emit({ type: 'step-end', data: result });
          throw err;
        }

        if (this.catchDepth > 0) {
          // Inside a try_catch block — record the error, skip the remaining
          // try children (at any nesting depth), don't abort the run.
          const message = err.message || String(err);
          this.lastCaughtError = message;
          const result = { stepId: step.id, type: step.type, status: 'failed', duration, error: message };
          results.push(result);
          this.emit({ type: 'step-end', data: result });
          throw new CaughtError(message);
        }

        let screenshot: string | undefined;
        if (this.config.screenshotOnFailure !== false) {
          try {
            if (this.page) {
              const buf = await this.page.screenshot({ type: 'png' });
              screenshot = `data:image/png;base64,${buf.toString('base64')}`;
            }
          } catch {}
        }

        const result = {
          stepId: step.id, type: step.type, status: 'failed', duration,
          error: err.message || String(err), screenshot,
        };
        results.push(result);
        this.emit({ type: 'step-end', data: result });
        this.aborted = true;
      }
    }
  }

  private async executeStep(type: string, params: Record<string, unknown>, children?: TestStep[]): Promise<void> {
    const page = this.page;
    if (!page) throw new Error('Browser not launched');

    const timeout = Number(params.timeout || 10000);

    switch (type) {
      // === NAVIGATION ===
      case 'navigate': {
        const url = this.requireString(params, 'url', type);
        await page.goto(url, { waitUntil: 'load', timeout });
        break;
      }
      case 'reload': {
        await page.reload({ waitUntil: 'load', timeout });
        break;
      }
      case 'go_back': {
        await page.goBack({ timeout });
        break;
      }
      case 'go_forward': {
        await page.goForward({ timeout });
        break;
      }
      case 'wait_for_url': {
        await page.waitForURL(String(params.url || ''), { timeout });
        break;
      }
      case 'wait': {
        await page.waitForTimeout(Number(params.ms || params.duration || 1000));
        break;
      }
      case 'wait_for_element':
      case 'wait-for-element': {
        await page.waitForSelector(this.requireString(params, 'selector', type), { timeout });
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
        await page.click(this.requireString(params, 'selector', type), { timeout });
        break;
      }
      case 'double-click':
      case 'double_click': {
        await page.dblclick(this.requireString(params, 'selector', type), { timeout });
        break;
      }
      case 'right-click':
      case 'right_click': {
        await page.click(this.requireString(params, 'selector', type), { timeout, button: 'right' });
        break;
      }
      case 'fill': {
        await page.fill(this.requireString(params, 'selector', type), String(params.value || ''), { timeout });
        break;
      }
      case 'type': {
        await page.locator(this.requireString(params, 'selector', type)).pressSequentially(String(params.text || params.value || ''), { delay: 50 });
        break;
      }
      case 'clear': {
        await page.fill(this.requireString(params, 'selector', type), '', { timeout });
        break;
      }
      case 'select': {
        await page.selectOption(this.requireString(params, 'selector', type), String(params.value || ''), { timeout });
        break;
      }
      case 'check': {
        const checkSel = this.requireString(params, 'selector', type);
        if (params.checked === false) {
          await page.uncheck(checkSel, { timeout });
        } else {
          await page.check(checkSel, { timeout });
        }
        break;
      }
      case 'uncheck': {
        await page.uncheck(this.requireString(params, 'selector', type), { timeout });
        break;
      }
      case 'hover': {
        await page.hover(this.requireString(params, 'selector', type), { timeout });
        break;
      }
      case 'scroll-to':
      case 'scroll_to': {
        await page.locator(this.requireString(params, 'selector', type)).scrollIntoViewIfNeeded({ timeout });
        break;
      }
      case 'press-key':
      case 'press_key': {
        const key = this.requireString(params, 'key', type);
        const target = params.selector ? page.locator(String(params.selector)) : page;
        if ('press' in target) {
          await (target as any).press(key);
        } else {
          await page.keyboard.press(key);
        }
        break;
      }
      case 'upload_file':
      case 'upload-file': {
        await page.setInputFiles(this.requireString(params, 'selector', type), String(params.path || ''));
        break;
      }

      // === ASSERTIONS ===
      case 'assert_visible':
      case 'assert-visible': {
        await page.locator(this.requireString(params, 'selector', type)).waitFor({ state: 'visible', timeout });
        break;
      }
      case 'assert_hidden':
      case 'assert-hidden': {
        await page.locator(this.requireString(params, 'selector', type)).waitFor({ state: 'hidden', timeout });
        break;
      }
      case 'assert_text':
      case 'assert-text': {
        const locator = page.locator(this.requireString(params, 'selector', type));
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
        const actual = await page.inputValue(this.requireString(params, 'selector', type), { timeout });
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
        const count = await page.locator(this.requireString(params, 'selector', type)).count();
        const expected = Number(params.count || 0);
        if (count !== expected) {
          throw new Error(`Count assertion failed.\nExpected: ${expected}\nActual: ${count}`);
        }
        break;
      }
      case 'assert_attribute': {
        const attrSel = this.requireString(params, 'selector', type);
        const attr = await page.locator(attrSel).getAttribute(String(params.attribute || ''), { timeout });
        const expected = String(params.expected || '');
        const mode = params.mode || 'equals';
        const pass = mode === 'contains' ? (attr || '').includes(expected) : attr === expected;
        if (!pass) {
          throw new Error(`Attribute "${params.attribute}" assertion failed.\nExpected: "${expected}" (${mode})\nActual: "${attr}"`);
        }
        break;
      }
      case 'assert_checked': {
        const isChecked = await page.locator(this.requireString(params, 'selector', type)).isChecked({ timeout });
        const expected = params.checked !== false;
        if (isChecked !== expected) {
          throw new Error(`Checked assertion failed.\nExpected: ${expected}\nActual: ${isChecked}`);
        }
        break;
      }
      case 'assert_enabled': {
        const enabledSel = this.requireString(params, 'selector', type);
        const isEnabled = await page.locator(enabledSel).isEnabled({ timeout });
        if (!isEnabled) {
          throw new Error(`Element is disabled but expected to be enabled: "${enabledSel}"`);
        }
        break;
      }
      case 'assert_disabled': {
        const disabledSel = this.requireString(params, 'selector', type);
        const isEnabled2 = await page.locator(disabledSel).isEnabled({ timeout });
        if (isEnabled2) {
          throw new Error(`Element is enabled but expected to be disabled: "${disabledSel}"`);
        }
        break;
      }
      case 'assert_css': {
        const cssValue = await page.locator(this.requireString(params, 'selector', type)).evaluate(
          (el, prop) => window.getComputedStyle(el).getPropertyValue(prop),
          String(params.property || '')
        );
        const expected = String(params.expected || '');
        if (!cssValue.includes(expected)) {
          throw new Error(`CSS property "${params.property}" assertion failed.\nExpected to contain: "${expected}"\nActual: "${cssValue.trim()}"`);
        }
        break;
      }

      // === DATA EXTRACTION ===
      case 'get_text':
      case 'extract-text': {
        const text = await page.locator(this.requireString(params, 'selector', type)).textContent({ timeout }) || '';
        this.setVar(String(params.saveAs || params.variable || 'extractedText'), text.trim());
        break;
      }
      case 'get_attribute':
      case 'extract-attribute': {
        const attr = await page.locator(this.requireString(params, 'selector', type)).getAttribute(String(params.attribute || ''), { timeout });
        this.setVar(String(params.saveAs || params.variable || 'extractedAttr'), attr || '');
        break;
      }
      case 'get_input_value':
      case 'extract-value': {
        const val = await page.inputValue(this.requireString(params, 'selector', type), { timeout });
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
          await this.executeStepsInner(children);
        }
        break;
      }
      case 'repeat': {
        const times = Number(params.times || 1);
        if (children && children.length > 0) {
          for (let i = 0; i < times; i++) {
            this.setVar('__iteration', i);
            await this.executeStepsInner(children);
            if (this.aborted) break;
          }
        }
        break;
      }
      case 'for_each': {
        let items: unknown[] = [];
        if (params.items) {
          try {
            items = JSON.parse(String(params.items));
          } catch (e: any) {
            throw new Error(`for_each: "items" is not valid JSON — ${e.message}`);
          }
        } else if (params.variable) {
          const raw = this.variables.get(String(params.variable));
          if (Array.isArray(raw)) items = raw;
          else {
            try {
              items = JSON.parse(String(raw ?? '[]'));
            } catch {
              throw new Error(`for_each: variable "${params.variable}" does not contain a JSON array`);
            }
          }
        }
        if (!Array.isArray(items)) {
          throw new Error('for_each: resolved items is not an array');
        }
        if (children && children.length > 0) {
          for (let i = 0; i < items.length; i++) {
            this.setVar('__index', i);
            this.setVar('__item', typeof items[i] === 'object' ? JSON.stringify(items[i]) : String(items[i]));
            await this.executeStepsInner(children);
            if (this.aborted) break;
          }
        }
        break;
      }
      case 'try_catch': {
        this.catchDepth++;
        this.lastCaughtError = null;
        try {
          if (children && children.length > 0) {
            await this.executeStepsInner(children);
          }
        } catch (err) {
          if (!(err instanceof CaughtError)) throw err;
          // Failure already recorded at the failing step — swallow and continue the run.
        } finally {
          this.catchDepth--;
        }
        if (this.lastCaughtError) {
          this.setVar('__error', this.lastCaughtError);
        }
        this.lastCaughtError = null;
        break;
      }

      // === API ===
      case 'api_get':
      case 'api_post':
      case 'api_put':
      case 'api_delete': {
        const method = type.replace('api_', '').toUpperCase();
        const url = this.requireString(params, 'url', type);
        let headers = {};
        if (params.headers) {
          try {
            headers = JSON.parse(String(params.headers));
          } catch (e: any) {
            throw new Error(`${type}: "headers" is not valid JSON — ${e.message}`);
          }
        }
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
