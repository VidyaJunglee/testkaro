import React, { useCallback, useEffect, useRef, useState } from 'react';
import { RefreshCw, Settings, Stethoscope, CheckCircle2, XCircle, Play } from 'lucide-react';
import { useStore } from '../store';
import { MobileConfig } from '../../schema';
import { listMobileDevices, runMobileDoctor, installMobileDriver, bootIosSimulator, MobileDevice, DoctorCheck } from '../utils/mobileApi';
import { toast } from '../store/toast';

export function MobileRunBar() {
  const store = useStore;
  const mobileConfig = useStore(s => s.file.mobileConfig);
  const runState = useStore(s => s.runState);
  const platform = mobileConfig?.platform || 'android';

  const [devices, setDevices] = useState<MobileDevice[]>([]);
  const [loadingDevices, setLoadingDevices] = useState(false);
  const [configOpen, setConfigOpen] = useState(false);
  const [doctorOpen, setDoctorOpen] = useState(false);
  const [doctorChecks, setDoctorChecks] = useState<DoctorCheck[] | null>(null);
  const [doctorLoading, setDoctorLoading] = useState(false);
  const [installing, setInstalling] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  const disabled = runState === 'running' || runState === 'connecting';

  // Close either popover on outside click, matching the app's other popover patterns.
  useEffect(() => {
    if (!configOpen && !doctorOpen) return;
    const handler = (e: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setConfigOpen(false);
        setDoctorOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [configOpen, doctorOpen]);

  const refreshDevices = useCallback(() => {
    setLoadingDevices(true);
    listMobileDevices()
      .then(setDevices)
      .catch(e => toast.error(e.message))
      .finally(() => setLoadingDevices(false));
  }, []);

  useEffect(() => { refreshDevices(); }, [refreshDevices]);

  const updateConfig = (patch: Partial<MobileConfig>) => {
    const s = store.getState();
    s.setModuleEngine('mobile', { platform, ...s.file.mobileConfig, ...patch } as MobileConfig);
  };

  const openDoctor = () => {
    setDoctorOpen(true);
    setConfigOpen(false);
    setDoctorLoading(true);
    runMobileDoctor().then(setDoctorChecks).catch(e => toast.error(e.message)).finally(() => setDoctorLoading(false));
  };

  const install = (driver: 'uiautomator2' | 'xcuitest') => {
    setInstalling(driver);
    installMobileDriver(driver)
      .then(res => {
        if (res.ok) { toast.success(`${driver} driver installed`); openDoctor(); }
        else toast.error(`Driver install failed — see server logs`);
      })
      .catch(e => toast.error(e.message))
      .finally(() => setInstalling(null));
  };

  const filteredDevices = devices.filter(d => d.platform === platform);

  return (
    <div ref={rootRef} className="relative flex items-center gap-1.5">
      <select
        className="px-2 py-1 rounded-lg text-[11px] font-medium bg-transparent border border-border-subtle text-text-tertiary hover:text-text-secondary hover:bg-bg-hover outline-none transition-all"
        value={platform}
        disabled={disabled}
        onChange={e => updateConfig({ platform: e.target.value as 'android' | 'ios', deviceId: undefined })}
        title="Mobile platform"
      >
        <option value="android">Android</option>
        <option value="ios">iOS</option>
      </select>

      <select
        className="px-2 py-1 rounded-lg text-[11px] font-medium bg-transparent border border-border-subtle text-text-tertiary hover:text-text-secondary hover:bg-bg-hover outline-none transition-all max-w-[160px]"
        value={mobileConfig?.deviceId || ''}
        disabled={disabled}
        onChange={e => updateConfig({ deviceId: e.target.value || undefined })}
        title="Target device"
      >
        <option value="">{loadingDevices ? 'Loading devices…' : filteredDevices.length === 0 ? 'No devices found' : 'Select device…'}</option>
        {filteredDevices.map(d => (
          <option key={d.id} value={d.id}>{d.name} — {d.state}</option>
        ))}
      </select>

      {platform === 'ios' && mobileConfig?.deviceId && (
        <button
          className="p-1.5 rounded-lg text-text-tertiary hover:text-accent hover:bg-bg-hover transition-all"
          title="Boot simulator"
          onClick={() => bootIosSimulator(mobileConfig.deviceId!).then(() => { toast.success('Simulator booted'); refreshDevices(); }).catch(e => toast.error(e.message))}
        >
          <Play size={12} />
        </button>
      )}

      <button
        className="p-1.5 rounded-lg text-text-tertiary hover:text-text-secondary hover:bg-bg-hover transition-all"
        title="Refresh devices"
        onClick={refreshDevices}
      >
        <RefreshCw size={12} className={loadingDevices ? 'animate-spin' : ''} />
      </button>

      <button
        className={`p-1.5 rounded-lg transition-all ${configOpen ? 'text-accent bg-accent/10' : 'text-text-tertiary hover:text-text-secondary hover:bg-bg-hover'}`}
        title="App under test settings"
        onClick={() => { setConfigOpen(!configOpen); setDoctorOpen(false); }}
      >
        <Settings size={12} />
      </button>

      <button
        className={`p-1.5 rounded-lg transition-all ${doctorOpen ? 'text-accent bg-accent/10' : 'text-text-tertiary hover:text-text-secondary hover:bg-bg-hover'}`}
        title="Check mobile setup"
        onClick={openDoctor}
      >
        <Stethoscope size={12} />
      </button>

      {configOpen && (
        <div className="absolute top-full right-0 mt-1.5 w-72 bg-bg-elevated border border-border rounded-lg shadow-xl z-50 p-3 space-y-2.5">
          <div className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wide">App Under Test</div>
          <label className="block">
            <span className="text-[11px] text-text-tertiary">App path (.apk / .app / .ipa — optional)</span>
            <input
              className="w-full mt-1 px-2 py-1 text-xs bg-bg-input border border-border-subtle rounded outline-none focus:border-border-active font-mono"
              value={mobileConfig?.appPath || ''}
              placeholder="/path/to/app.apk"
              onChange={e => updateConfig({ appPath: e.target.value || undefined })}
            />
          </label>
          {platform === 'android' ? (
            <>
              <label className="block">
                <span className="text-[11px] text-text-tertiary">Package name</span>
                <input
                  className="w-full mt-1 px-2 py-1 text-xs bg-bg-input border border-border-subtle rounded outline-none focus:border-border-active font-mono"
                  value={mobileConfig?.appPackage || ''}
                  placeholder="com.example.app"
                  onChange={e => updateConfig({ appPackage: e.target.value || undefined })}
                />
              </label>
              <label className="block">
                <span className="text-[11px] text-text-tertiary">Activity (optional)</span>
                <input
                  className="w-full mt-1 px-2 py-1 text-xs bg-bg-input border border-border-subtle rounded outline-none focus:border-border-active font-mono"
                  value={mobileConfig?.appActivity || ''}
                  placeholder=".MainActivity"
                  onChange={e => updateConfig({ appActivity: e.target.value || undefined })}
                />
              </label>
            </>
          ) : (
            <label className="block">
              <span className="text-[11px] text-text-tertiary">Bundle ID</span>
              <input
                className="w-full mt-1 px-2 py-1 text-xs bg-bg-input border border-border-subtle rounded outline-none focus:border-border-active font-mono"
                value={mobileConfig?.bundleId || ''}
                placeholder="com.example.app"
                onChange={e => updateConfig({ bundleId: e.target.value || undefined })}
              />
            </label>
          )}
        </div>
      )}

      {doctorOpen && (
        <div className="absolute top-full right-0 mt-1.5 w-80 bg-bg-elevated border border-border rounded-lg shadow-xl z-50 p-3 space-y-2">
          <div className="text-[11px] font-semibold text-text-tertiary uppercase tracking-wide">Mobile Setup</div>
          {doctorLoading && <div className="text-xs text-text-tertiary py-2">Checking…</div>}
          {doctorChecks?.map(check => (
            <div key={check.name} className="flex items-start gap-2 text-xs">
              {check.ok
                ? <CheckCircle2 size={13} className="text-success shrink-0 mt-0.5" />
                : <XCircle size={13} className="text-danger shrink-0 mt-0.5" />}
              <div className="flex-1 min-w-0">
                <div className="text-text-primary font-medium">{check.name}</div>
                <div className="text-text-tertiary">{check.message}</div>
              </div>
              {!check.ok && check.name.includes('UiAutomator2') && (
                <button
                  className="text-[10px] px-2 py-0.5 rounded bg-accent/10 text-accent hover:bg-accent/20 transition-colors shrink-0"
                  disabled={installing === 'uiautomator2'}
                  onClick={() => install('uiautomator2')}
                >
                  {installing === 'uiautomator2' ? 'Installing…' : 'Install'}
                </button>
              )}
              {!check.ok && check.name.includes('XCUITest') && (
                <button
                  className="text-[10px] px-2 py-0.5 rounded bg-accent/10 text-accent hover:bg-accent/20 transition-colors shrink-0"
                  disabled={installing === 'xcuitest'}
                  onClick={() => install('xcuitest')}
                >
                  {installing === 'xcuitest' ? 'Installing…' : 'Install'}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
