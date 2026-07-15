import { spawn, ChildProcess } from 'node:child_process';
import net from 'node:net';
import http from 'node:http';
import type { Browser as WebdriverBrowser } from 'webdriverio';
import { getAppiumHome } from './mobile-devices.js';

export interface MobileTestStep {
  id: string;
  type: string;
  params: Record<string, unknown>;
  children?: MobileTestStep[];
  skip?: boolean;
  description?: string;
  timeout?: number;
  retry?: number;
}

export interface MobileExecutionConfig {
  platform: 'android' | 'ios';
  deviceId?: string;
  appPath?: string;
  appPackage?: string;
  appActivity?: string;
  bundleId?: string;
  screenshotOnFailure?: boolean;
}

export type MobileEventEmitter = (event: { type: string; data: any }) => void;

class CaughtError extends Error {}
const CONTAINER_TYPES = new Set(['if', 'repeat', 'for_each', 'try_catch']);

function findFreePort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const srv = net.createServer();
    srv.unref();
    srv.on('error', reject);
    srv.listen(0, () => {
      const addr = srv.address();
      const port = typeof addr === 'object' && addr ? addr.port : 0;
      srv.close(() => resolve(port));
    });
  });
}

// Polls Appium's status endpoint until ready, but also watches the child
// process itself — a process that has already exited will never answer,
// and without this check a startup failure (bad Node version, port in use,
// missing driver) surfaces as an opaque "did not become ready" timeout.
function waitForAppiumReady(port: number, child: ChildProcess, timeoutMs = 45_000): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  let stderr = '';
  child.stderr?.on('data', (d) => { stderr += d.toString(); });

  return new Promise((resolve, reject) => {
    const tryOnce = () => {
      if (child.exitCode !== null || child.signalCode !== null) {
        const tail = stderr.trim().slice(-500);
        reject(new Error(`Appium process exited before starting up${tail ? `: ${tail}` : ''}`));
        return;
      }
      const req = http.get(`http://127.0.0.1:${port}/wd/hub/status`, (res) => {
        res.resume();
        resolve();
      });
      req.on('error', () => {
        if (Date.now() > deadline) {
          const tail = stderr.trim().slice(-500);
          reject(new Error(`Appium server did not become ready in time${tail ? `: ${tail}` : ''}`));
        } else {
          setTimeout(tryOnce, 400);
        }
      });
    };
    tryOnce();
  });
}

// Mirrors PlaywrightExecutor: run() resets state and drives the epilogue exactly
// once; executeStepsInner() is the recursive worker used by container blocks.
export class MobileExecutor {
  private driver: WebdriverBrowser | null = null;
  private appiumProcess: ChildProcess | null = null;
  private appiumPort = 0;
  private aborted = false;
  private paused = false;
  private resumeResolve: (() => void) | null = null;
  private variables: Map<string, unknown> = new Map();
  private emit: MobileEventEmitter;
  private config: MobileExecutionConfig;
  private catchDepth = 0;
  private lastCaughtError: string | null = null;
  private results: any[] = [];
  breakpoints: Set<string> = new Set();

  constructor(emit: MobileEventEmitter, config: MobileExecutionConfig) {
    this.emit = emit;
    this.config = config;
  }

  pause(): void { this.paused = true; }
  resume(): void {
    this.paused = false;
    if (this.resumeResolve) { this.resumeResolve(); this.resumeResolve = null; }
  }

  private async waitIfPaused(): Promise<void> {
    if (!this.paused) return;
    this.emit({ type: 'paused', data: {} });
    await new Promise<void>(resolve => { this.resumeResolve = resolve; });
    this.emit({ type: 'resumed', data: {} });
  }

  async launch(): Promise<void> {
    const { remote } = await import('webdriverio');
    const appiumHome = getAppiumHome();
    this.appiumPort = await findFreePort();

    this.appiumProcess = spawn(
      process.platform === 'win32' ? 'npx.cmd' : 'npx',
      ['appium', '--port', String(this.appiumPort), '--base-path', '/wd/hub', '--log-level', 'error'],
      { env: { ...process.env, APPIUM_HOME: appiumHome }, stdio: ['ignore', 'ignore', 'pipe'] }
    );

    this.appiumProcess.on('error', () => {});

    try {
      await waitForAppiumReady(this.appiumPort, this.appiumProcess);
    } catch (err) {
      this.appiumProcess?.kill();
      this.appiumProcess = null;
      throw new Error(`Appium server failed to start: ${(err as Error).message}. Run the mobile doctor check to verify your setup.`);
    }

    const capabilities = this.buildCapabilities();

    try {
      this.driver = await remote({
        hostname: '127.0.0.1',
        port: this.appiumPort,
        path: '/wd/hub',
        logLevel: 'silent',
        capabilities,
      }) as unknown as WebdriverBrowser;
    } catch (err) {
      await this.close();
      throw new Error(`Failed to start Appium session: ${(err as Error).message}`);
    }

    this.emit({ type: 'browser-ready', data: { platform: this.config.platform, deviceId: this.config.deviceId } });
  }

  private buildCapabilities(): Record<string, unknown> {
    if (this.config.platform === 'android') {
      return {
        platformName: 'Android',
        'appium:automationName': 'UiAutomator2',
        ...(this.config.deviceId ? { 'appium:udid': this.config.deviceId } : {}),
        ...(this.config.appPath ? { 'appium:app': this.config.appPath } : {}),
        ...(this.config.appPackage ? { 'appium:appPackage': this.config.appPackage } : {}),
        ...(this.config.appActivity ? { 'appium:appActivity': this.config.appActivity } : {}),
        'appium:noReset': true,
        'appium:newCommandTimeout': 300,
      };
    }
    return {
      platformName: 'iOS',
      'appium:automationName': 'XCUITest',
      ...(this.config.deviceId ? { 'appium:udid': this.config.deviceId } : {}),
      ...(this.config.appPath ? { 'appium:app': this.config.appPath } : {}),
      ...(this.config.bundleId ? { 'appium:bundleId': this.config.bundleId } : {}),
      'appium:noReset': true,
      'appium:newCommandTimeout': 300,
    };
  }

  abort(): void { this.aborted = true; }

  async close(): Promise<void> {
    try { await this.driver?.deleteSession(); } catch {}
    this.driver = null;
    if (this.appiumProcess) {
      try { this.appiumProcess.kill(); } catch {}
      this.appiumProcess = null;
    }
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
    for (const [k, v] of Object.entries(params)) resolved[k] = this.resolveVars(v);
    return resolved;
  }

  private requireString(params: Record<string, unknown>, key: string, stepType: string): string {
    const val = params[key];
    if (val === undefined || val === null || String(val).trim() === '') {
      throw new Error(`${stepType}: missing required param "${key}"`);
    }
    return String(val);
  }

  async run(steps: MobileTestStep[]): Promise<void> {
    this.aborted = false;
    this.results = [];
    this.catchDepth = 0;
    this.lastCaughtError = null;

    try {
      await this.executeStepsInner(steps);
    } catch (err) {
      if (!(err instanceof CaughtError)) {
        this.emit({ type: 'error', data: { message: (err as Error)?.message || String(err) } });
      }
    }

    await this.close();
    this.emit({ type: 'done', data: { results: this.results } });
  }

  private async executeStepsInner(steps: MobileTestStep[]): Promise<void> {
    const results = this.results;

    for (const step of steps) {
      if (this.aborted) {
        this.emit({ type: 'step-end', data: { stepId: step.id, type: step.type, status: 'skipped', duration: 0 } });
        continue;
      }

      if (step.skip) {
        this.emit({ type: 'step-end', data: { stepId: step.id, type: step.type, status: 'skipped', duration: 0 } });
        continue;
      }

      if (this.breakpoints.has(step.id)) this.paused = true;
      await this.waitIfPaused();
      if (this.aborted) {
        this.emit({ type: 'step-end', data: { stepId: step.id, type: step.type, status: 'skipped', duration: 0 } });
        continue;
      }

      this.emit({ type: 'step-start', data: { stepId: step.id, type: step.type } });
      const start = Date.now();

      try {
        const params = this.resolveParams(step.params);
        if (step.timeout != null && params.timeout == null) params.timeout = step.timeout;

        const attempts = !CONTAINER_TYPES.has(step.type) ? 1 + Math.max(0, Number(step.retry) || 0) : 1;
        let lastErr: unknown;
        for (let attempt = 1; attempt <= attempts; attempt++) {
          try {
            await this.executeStep(step.type, params, step.children);
            lastErr = undefined;
            break;
          } catch (err) {
            lastErr = err;
            if (attempt < attempts) await new Promise(r => setTimeout(r, 300));
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
          const result = { stepId: step.id, type: step.type, status: 'failed', duration, error: this.lastCaughtError };
          results.push(result);
          this.emit({ type: 'step-end', data: result });
          throw err;
        }

        if (this.catchDepth > 0) {
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
            const b64 = await this.driver?.takeScreenshot();
            if (b64) screenshot = `data:image/png;base64,${b64}`;
          } catch {}
        }

        const result = { stepId: step.id, type: step.type, status: 'failed', duration, error: err.message || String(err), screenshot };
        results.push(result);
        this.emit({ type: 'step-end', data: result });
        this.aborted = true;
      }
    }
  }

  private async executeStep(type: string, params: Record<string, unknown>, children?: MobileTestStep[]): Promise<void> {
    const driver = this.driver;
    if (!driver) throw new Error('Mobile session not started');
    const timeout = Number(params.timeout || 10000);

    switch (type) {
      case 'tap': {
        const el = await driver.$(this.requireString(params, 'selector', type));
        await el.waitForDisplayed({ timeout });
        await el.click();
        break;
      }
      case 'long_press': {
        const el = await driver.$(this.requireString(params, 'selector', type));
        await el.waitForDisplayed({ timeout });
        const duration = Number(params.duration || 1000);
        await driver
          .action('pointer', { parameters: { pointerType: 'touch' } })
          .move({ origin: el })
          .down()
          .pause(duration)
          .up()
          .perform();
        break;
      }
      case 'double_tap': {
        const el = await driver.$(this.requireString(params, 'selector', type));
        await el.waitForDisplayed({ timeout });
        await el.click();
        await el.click();
        break;
      }
      case 'input_text': {
        const el = await driver.$(this.requireString(params, 'selector', type));
        await el.waitForDisplayed({ timeout });
        await el.setValue(String(params.value ?? ''));
        break;
      }
      case 'clear_text': {
        const el = await driver.$(this.requireString(params, 'selector', type));
        await el.waitForDisplayed({ timeout });
        await el.clearValue();
        break;
      }
      case 'swipe': {
        const direction = String(params.direction || 'up');
        const { width, height } = await driver.getWindowSize();
        const cx = width / 2, cy = height / 2;
        const spans: Record<string, [number, number, number, number]> = {
          up: [cx, height * 0.8, cx, height * 0.2],
          down: [cx, height * 0.2, cx, height * 0.8],
          left: [width * 0.8, cy, width * 0.2, cy],
          right: [width * 0.2, cy, width * 0.8, cy],
        };
        const [x1, y1, x2, y2] = spans[direction] || spans.up;
        await driver
          .action('pointer', { parameters: { pointerType: 'touch' } })
          .move({ x: Math.round(x1), y: Math.round(y1) })
          .down()
          .move({ duration: 300, x: Math.round(x2), y: Math.round(y2) })
          .up()
          .perform();
        break;
      }
      case 'scroll_until_visible': {
        const selector = this.requireString(params, 'selector', type);
        const direction = String(params.direction || 'down') === 'up' ? 'up' : 'down';
        const maxSwipes = Number(params.maxSwipes || 5);
        for (let i = 0; i <= maxSwipes; i++) {
          const el = await driver.$(selector);
          if (await el.isExisting().catch(() => false)) {
            await el.waitForDisplayed({ timeout: 1000 }).catch(() => {});
            if (await el.isDisplayed().catch(() => false)) return;
          }
          if (i === maxSwipes) throw new Error(`scroll_until_visible: "${selector}" not found after ${maxSwipes} swipes`);
          await this.executeStep('swipe', { direction }, undefined);
        }
        break;
      }
      case 'assert_visible_mobile': {
        const el = await driver.$(this.requireString(params, 'selector', type));
        await el.waitForDisplayed({ timeout });
        break;
      }
      case 'assert_text_mobile': {
        const el = await driver.$(this.requireString(params, 'selector', type));
        await el.waitForDisplayed({ timeout });
        // Flutter widgets render via a custom Skia surface, not native Android
        // text views — their value surfaces as content-desc in the accessibility
        // tree, while getText() reads the (empty) native "text" attribute. Try
        // getText() first for native views, then fall back to content-desc.
        let actual = (await el.getText()) || '';
        if (!actual) {
          actual = (await el.getAttribute('content-desc').catch(() => '')) || '';
        }
        const expected = String(params.expected || '');
        const exact = params.exact === true;
        if (exact ? actual.trim() !== expected : !actual.includes(expected)) {
          throw new Error(`Text assertion failed.\nExpected: "${expected}"\nActual: "${actual.trim()}"`);
        }
        break;
      }
      case 'wait_for_element_mobile': {
        const el = await driver.$(this.requireString(params, 'selector', type));
        await el.waitForDisplayed({ timeout });
        break;
      }
      case 'press_key_mobile': {
        const key = this.requireString(params, 'key', type);
        if (this.config.platform === 'android') {
          const keycodes: Record<string, number> = {
            BACK: 4, HOME: 3, ENTER: 66, DEL: 67, BACKSPACE: 67,
            VOLUME_UP: 24, VOLUME_DOWN: 25, MENU: 82, SEARCH: 84,
          };
          const code = keycodes[key.toUpperCase()] ?? Number(key);
          if (Number.isNaN(code)) throw new Error(`press_key: unknown key "${key}"`);
          await (driver as any).pressKeyCode(code);
        } else {
          throw new Error('press_key is only supported on Android — use the Back block on iOS');
        }
        break;
      }
      case 'back': {
        await driver.back();
        break;
      }
      case 'hide_keyboard': {
        try { await driver.hideKeyboard(); } catch {}
        break;
      }
      case 'launch_app': {
        const id = this.config.platform === 'android' ? this.config.appPackage : this.config.bundleId;
        if (!id) throw new Error('launch_app: module has no appPackage/bundleId configured');
        await driver.execute('mobile: activateApp', { appId: id });
        break;
      }
      case 'stop_app': {
        const id = this.config.platform === 'android' ? this.config.appPackage : this.config.bundleId;
        if (!id) throw new Error('stop_app: module has no appPackage/bundleId configured');
        await driver.execute('mobile: terminateApp', { appId: id });
        break;
      }
      case 'deep_link': {
        const url = this.requireString(params, 'url', type);
        if (this.config.platform === 'android') {
          await driver.execute('mobile: deepLink', { url, package: this.config.appPackage });
        } else {
          await driver.execute('mobile: launchApp', { bundleId: this.config.bundleId, arguments: [url] });
        }
        break;
      }
      case 'screenshot_mobile': {
        const b64 = await driver.takeScreenshot();
        this.emit({ type: 'screenshot', data: { screenshot: `data:image/png;base64,${b64}`, label: params.name || 'Manual screenshot' } });
        break;
      }
      case 'set_orientation': {
        const orientation = String(params.orientation || 'PORTRAIT').toUpperCase();
        await driver.setOrientation(orientation as 'PORTRAIT' | 'LANDSCAPE');
        break;
      }

      // === LOGIC (shared with web executor) ===
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
      case 'if': {
        const varName = String(params.variable || '');
        const varValue = this.variables.get(varName) ?? '';
        const operator = String(params.operator || 'truthy');
        const compareValue = params.value !== undefined ? String(params.value) : '';
        let condResult: boolean;
        switch (operator) {
          case 'equals': condResult = String(varValue) === compareValue; break;
          case 'notEquals': condResult = String(varValue) !== compareValue; break;
          case 'contains': condResult = String(varValue).includes(compareValue); break;
          default: condResult = !!varValue;
        }
        if (condResult && children && children.length > 0) await this.executeStepsInner(children);
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
          try { items = JSON.parse(String(params.items)); }
          catch (e: any) { throw new Error(`for_each: "items" is not valid JSON — ${e.message}`); }
        } else if (params.variable) {
          const raw = this.variables.get(String(params.variable));
          if (Array.isArray(raw)) items = raw;
          else {
            try { items = JSON.parse(String(raw ?? '[]')); }
            catch { throw new Error(`for_each: variable "${params.variable}" does not contain a JSON array`); }
          }
        }
        if (!Array.isArray(items)) throw new Error('for_each: resolved items is not an array');
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
          if (children && children.length > 0) await this.executeStepsInner(children);
        } catch (err) {
          if (!(err instanceof CaughtError)) throw err;
        } finally {
          this.catchDepth--;
        }
        if (this.lastCaughtError) this.setVar('__error', this.lastCaughtError);
        this.lastCaughtError = null;
        break;
      }

      default:
        throw new Error(`Unknown mobile step type: "${type}"`);
    }
  }
}
