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

// Short-lived request/response over a fresh WebSocket — used for one-off
// mobile setup calls (device listing, doctor checks, driver install) that
// don't belong on the long-lived run connection in ExecutionPanel.
function request<T>(payload: Record<string, unknown>, responseType: string, timeoutMs = 15_000): Promise<T> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket('ws://localhost:3001/ws');
    const timer = setTimeout(() => {
      ws.close();
      reject(new Error('Timed out waiting for server response'));
    }, timeoutMs);

    ws.onopen = () => ws.send(JSON.stringify(payload));
    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      if (msg.type === responseType) {
        clearTimeout(timer);
        ws.close();
        resolve(msg.data);
      } else if (msg.type === 'error') {
        clearTimeout(timer);
        ws.close();
        reject(new Error(msg.data?.message || 'Server error'));
      }
    };
    ws.onerror = () => {
      clearTimeout(timer);
      reject(new Error('Cannot connect to TestKaro server. Make sure it\'s running on localhost:3001'));
    };
  });
}

export const listMobileDevices = (): Promise<MobileDevice[]> =>
  request<{ devices: MobileDevice[] }>({ type: 'list-devices' }, 'devices').then(d => d.devices);

export const runMobileDoctor = (): Promise<DoctorCheck[]> =>
  request<{ checks: DoctorCheck[] }>({ type: 'doctor' }, 'doctor-result').then(d => d.checks);

// Driver installs download real packages — give them room to run.
export const installMobileDriver = (driver: 'uiautomator2' | 'xcuitest'): Promise<{ ok: boolean; log: string }> =>
  request({ type: 'install-driver', driver }, 'driver-install-result', 180_000);

export const bootIosSimulator = (deviceId: string): Promise<{ deviceId: string }> =>
  request({ type: 'boot-device', deviceId }, 'device-booted', 60_000);
