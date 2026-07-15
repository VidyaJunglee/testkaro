import { spawn } from 'node:child_process';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const execFileAsync = promisify(execFile);

export interface MobileDevice {
  id: string;
  name: string;
  platform: 'android' | 'ios';
  state: string;
}

export interface DoctorCheck {
  name: string;
  ok: boolean;
  message: string;
}

// A private Appium driver/plugin home for TestKaro — keeps driver installs out
// of the user's default ~/.appium, and out of node_modules entirely.
export function getAppiumHome(): string {
  const home = path.join(os.homedir(), '.testkaro', 'appium-home');
  fs.mkdirSync(home, { recursive: true });
  return home;
}

export async function listAndroidDevices(): Promise<MobileDevice[]> {
  try {
    const { default: ADB } = await import('appium-adb');
    const adb = await (ADB as any).createADB();
    const devices = await adb.getConnectedDevices();
    return devices.map((d: any) => ({
      id: d.udid,
      name: d.udid,
      platform: 'android' as const,
      state: d.state || 'device',
    }));
  } catch {
    return [];
  }
}

export async function listIosSimulators(): Promise<MobileDevice[]> {
  if (process.platform !== 'darwin') return [];
  try {
    const { stdout } = await execFileAsync('xcrun', ['simctl', 'list', 'devices', 'available', '--json']);
    const parsed = JSON.parse(stdout);
    const devices: MobileDevice[] = [];
    for (const runtime of Object.values(parsed.devices || {}) as any[]) {
      for (const d of runtime) {
        devices.push({ id: d.udid, name: d.name, platform: 'ios', state: d.state || 'Shutdown' });
      }
    }
    return devices;
  } catch {
    return [];
  }
}

export async function listDevices(): Promise<MobileDevice[]> {
  const [android, ios] = await Promise.all([listAndroidDevices(), listIosSimulators()]);
  return [...android, ...ios];
}

export async function bootIosSimulator(udid: string): Promise<void> {
  await execFileAsync('xcrun', ['simctl', 'boot', udid]).catch((err) => {
    // "Unable to boot device in current state: Booted" is not an error for our purposes
    if (!String(err.message || '').includes('current state: Booted')) throw err;
  });
}

function commandExists(cmd: string): Promise<boolean> {
  return execFileAsync(process.platform === 'win32' ? 'where' : 'which', [cmd])
    .then(() => true)
    .catch(() => false);
}

async function listInstalledAppiumDrivers(): Promise<string[]> {
  return new Promise((resolve) => {
    const proc = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['appium', 'driver', 'list', '--installed', '--json'], {
      env: { ...process.env, APPIUM_HOME: getAppiumHome() },
    });
    let out = '';
    proc.stdout.on('data', (d) => { out += d.toString(); });
    proc.on('close', () => {
      try {
        const parsed = JSON.parse(out);
        resolve(Object.keys(parsed || {}));
      } catch {
        resolve([]);
      }
    });
    proc.on('error', () => resolve([]));
  });
}

// Powers a red/green setup checklist in the UI — surfaces exactly what's missing
// instead of letting a launch() call fail with an opaque Appium error.
export async function runDoctorChecks(): Promise<DoctorCheck[]> {
  const checks: DoctorCheck[] = [];

  const nodeMajor = Number(process.versions.node.split('.')[0]);
  checks.push({
    name: 'Node.js version',
    ok: nodeMajor >= 20,
    message: nodeMajor >= 20 ? `Node ${process.versions.node}` : `Node ${process.versions.node} — Appium needs Node 20+`,
  });

  const hasAdb = await commandExists('adb');
  checks.push({
    name: 'Android SDK (adb)',
    ok: hasAdb,
    message: hasAdb ? 'adb found on PATH' : 'adb not found — install Android SDK platform-tools and add to PATH',
  });

  const drivers = await listInstalledAppiumDrivers();
  checks.push({
    name: 'Appium UiAutomator2 driver (Android)',
    ok: drivers.includes('uiautomator2'),
    message: drivers.includes('uiautomator2') ? 'Installed' : 'Not installed — run the "Install Android driver" action',
  });

  if (process.platform === 'darwin') {
    const hasXcrun = await commandExists('xcrun');
    checks.push({
      name: 'Xcode command line tools',
      ok: hasXcrun,
      message: hasXcrun ? 'xcrun found on PATH' : 'xcrun not found — install Xcode + command line tools',
    });
    checks.push({
      name: 'Appium XCUITest driver (iOS)',
      ok: drivers.includes('xcuitest'),
      message: drivers.includes('xcuitest') ? 'Installed' : 'Not installed — run the "Install iOS driver" action',
    });
  }

  return checks;
}

export async function installAppiumDriver(name: 'uiautomator2' | 'xcuitest'): Promise<{ ok: boolean; log: string }> {
  return new Promise((resolve) => {
    let log = '';
    const proc = spawn(process.platform === 'win32' ? 'npx.cmd' : 'npx', ['appium', 'driver', 'install', name], {
      env: { ...process.env, APPIUM_HOME: getAppiumHome() },
    });
    proc.stdout.on('data', (d) => { log += d.toString(); });
    proc.stderr.on('data', (d) => { log += d.toString(); });
    proc.on('close', (code) => resolve({ ok: code === 0, log }));
    proc.on('error', (err) => resolve({ ok: false, log: log + String(err) }));
  });
}
