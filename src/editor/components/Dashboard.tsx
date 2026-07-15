import React, { useEffect, useState } from 'react';
import { useStore, useSessionActions, useGlobalEnvironments, useGlobalEnvActions } from '../store';
import { listApps, AppSummary, createModularApp, saveApp, deleteApp } from '../storage/app-registry';
import { getGlobalEnvironments, saveGlobalEnvironment, saveAllGlobalEnvironments, deleteGlobalEnvironment } from '../storage/global-env-store';
import { navigateToApp, navigateToDashboard } from '../router';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { toast } from '../store/toast';
import { ConfirmModal } from './ConfirmModal';
import { Environment } from '../../schema';
import {
  Layers, Plus, FileText,
  Package, Moon, Sun, Trash2,
  Globe, Settings, Upload, Download,
} from 'lucide-react';

type DashboardTab = 'projects' | 'variables' | 'settings';

export function Dashboard() {
  const store = useStore;
  const darkMode = useStore(s => s.darkMode);
  const { importFromFilesystem } = useSessionActions();
  const [apps, setApps] = useState<AppSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [activeTab, setActiveTab] = useState<DashboardTab>('projects');

  const loadApps = async () => {
    const list = await listApps();
    setApps(list);
    setLoading(false);
  };

  useEffect(() => { loadApps(); }, []);

  const handleCreateModular = async (name: string) => {
    const app = createModularApp(name);
    await saveApp(app);
    setShowCreateModal(false);
    navigateToApp(app.id);
  };

  const handleDeleteApp = async (id: string) => {
    await deleteApp(id);
    // Ensure we're on the dashboard route (not a stale app route)
    navigateToDashboard();
    await loadApps();
  };

  const handleOpenApp = (app: AppSummary) => {
    navigateToApp(app.id);
  };

  return (
    <div className="h-screen bg-bg-primary flex">
      {/* Navigation Rail */}
      <nav className="w-16 bg-bg-secondary border-r border-border flex flex-col items-center py-4 gap-1 shrink-0 glass-panel">
        <div className="w-8 h-8 bg-accent rounded-md flex items-center justify-center mb-6">
          <Layers size={14} className="text-on-accent" />
        </div>

        <NavRailButton
          icon={<FileText size={18} />}
          label="Projects"
          active={activeTab === 'projects'}
          onClick={() => setActiveTab('projects')}
        />
        <NavRailButton
          icon={<Globe size={18} />}
          label="Env"
          active={false}
          onClick={() => useStore.getState().setEnvDrawerOpen(true)}
        />
        <NavRailButton
          icon={<Settings size={18} />}
          label="Settings"
          active={activeTab === 'settings'}
          onClick={() => setActiveTab('settings')}
        />

        <div className="mt-auto">
          <button
            className="p-2 rounded-md text-text-tertiary hover:text-text-secondary hover:bg-bg-hover transition-all"
            onClick={() => store.getState().toggleDarkMode()}
            title={darkMode ? 'Light mode' : 'Dark mode'}
          >
            {darkMode ? <Sun size={16} /> : <Moon size={16} />}
          </button>
        </div>
      </nav>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header */}
        <header className="flex items-center justify-between h-14 px-6 border-b border-border bg-bg-secondary shrink-0 glass-panel">
          <div className="flex items-center gap-2.5">
            <span className="text-base font-bold text-text-primary tracking-tight">TestKaro</span>
            <span className="text-xs text-text-tertiary ml-2">v3.0</span>
          </div>
        </header>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto">
          {activeTab === 'projects' && (
            <ProjectsTab
              apps={apps}
              loading={loading}
              onCreateApp={() => setShowCreateModal(true)}
              onOpenApp={handleOpenApp}
              onDeleteApp={handleDeleteApp}
              onImport={async () => {
                const appId = await importFromFilesystem();
                if (appId) navigateToApp(appId);
              }}
            />
          )}
          {activeTab === 'variables' && <VariablesTab />}
          {activeTab === 'settings' && <SettingsTab />}
        </div>
      </div>

      {/* Create App Modal */}
      {showCreateModal && (
        <CreateAppModal
          onCreateModular={handleCreateModular}
          onClose={() => setShowCreateModal(false)}
        />
      )}
    </div>
  );
}

// ─── Nav Rail Button ─────────────────────────────────────────────────────────

function NavRailButton({ icon, label, active, onClick }: {
  icon: React.ReactNode; label: string; active: boolean; onClick: () => void;
}) {
  return (
    <button
      className={`w-12 h-12 flex flex-col items-center justify-center gap-0.5 rounded-lg transition-all ${
        active
          ? 'bg-accent/10 text-accent'
          : 'text-text-tertiary hover:text-text-secondary hover:bg-bg-hover'
      }`}
      onClick={onClick}
      title={label}
    >
      {icon}
      <span className="text-[9px] font-medium">{label}</span>
    </button>
  );
}

// ─── Projects Tab ────────────────────────────────────────────────────────────

function ProjectsTab({ apps, loading, onCreateApp, onOpenApp, onDeleteApp, onImport }: {
  apps: AppSummary[]; loading: boolean;
  onCreateApp: () => void; onOpenApp: (app: AppSummary) => void;
  onDeleteApp: (id: string) => void; onImport: () => void;
}) {
  const [pendingDelete, setPendingDelete] = useState<AppSummary | null>(null);
  const [deleting, setDeleting] = useState(false);

  const handleConfirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    await onDeleteApp(pendingDelete.id);
    setDeleting(false);
    setPendingDelete(null);
  };

  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
      {/* Delete Confirmation Modal */}
      <ConfirmModal
        open={!!pendingDelete}
        onClose={() => setPendingDelete(null)}
        onConfirm={handleConfirmDelete}
        title={`Delete "${pendingDelete?.name || ''}"?`}
        description="This will permanently delete the app and all its modules, tests, and steps. This action cannot be undone."
        confirmLabel="Delete App"
        cancelLabel="Cancel"
        variant="danger"
        loading={deleting}
      />

      {/* Header row */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-xl font-bold text-text-primary">Your Apps</h1>
          <p className="text-xs text-text-tertiary mt-1">
            {apps.length} app{apps.length !== 1 ? 's' : ''}
          </p>
        </div>
        <button
          onClick={onCreateApp}
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-on-accent text-sm font-medium hover:bg-accent-hover transition-colors"
        >
          <Plus size={14} />
          New App
        </button>
      </div>

      {/* App list */}
      {loading ? (
        <div className="text-xs text-text-tertiary py-4">Loading...</div>
      ) : apps.length === 0 ? (
        <div className="text-center py-16 text-text-tertiary border border-dashed border-border rounded-xl">
          <Package size={36} className="mx-auto mb-4 opacity-30" />
          <p className="text-sm font-medium text-text-secondary">No apps yet</p>
          <p className="text-xs mt-1 mb-5">Create your first app to start writing tests.</p>
          <button
            onClick={onCreateApp}
            className="px-4 py-2 bg-accent text-on-accent text-xs font-medium rounded-lg hover:bg-accent/90 transition-colors"
          >
            Create App
          </button>
        </div>
      ) : (
        <div className="border border-border rounded-xl overflow-hidden">
          {/* List header */}
          <div className="grid grid-cols-[1fr_100px_80px_80px_40px] gap-4 px-4 py-2.5 bg-bg-secondary border-b border-border text-[11px] font-medium text-text-tertiary uppercase tracking-wide">
            <span>Name</span>
            <span>Modules</span>
            <span>Tests</span>
            <span>Updated</span>
            <span></span>
          </div>

          {/* List items */}
          <div className="divide-y divide-border">
            {apps.map(app => (
              <div
                key={app.id}
                onClick={() => onOpenApp(app)}
                className="group grid grid-cols-[1fr_100px_80px_80px_40px] gap-4 items-center px-4 py-3 hover:bg-bg-hover transition-colors cursor-pointer"
              >
                {/* Name + status */}
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-8 h-8 rounded-md bg-accent/10 flex items-center justify-center shrink-0">
                    <Package size={14} className="text-accent" />
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-text-primary truncate">{app.name}</div>
                    {app.lastRunStatus && app.lastRunStatus !== 'never' && (
                      <span className={`text-[10px] font-medium ${
                        app.lastRunStatus === 'passed' ? 'text-green-600 dark:text-green-400' :
                        app.lastRunStatus === 'failed' ? 'text-red-600 dark:text-red-400' :
                        'text-yellow-600 dark:text-yellow-400'
                      }`}>
                        {app.lastRunStatus}
                      </span>
                    )}
                  </div>
                </div>

                {/* Modules */}
                <span className="text-xs text-text-secondary">{app.moduleCount}</span>

                {/* Tests */}
                <span className="text-xs text-text-secondary">{app.testCount}</span>

                {/* Updated */}
                <span className="text-xs text-text-tertiary">
                  {formatRelativeTime(app.updatedAt)}
                </span>

                {/* Delete */}
                <button
                  className="w-7 h-7 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 text-text-tertiary hover:text-danger hover:bg-danger/10 transition-all"
                  onClick={e => { e.stopPropagation(); setPendingDelete(app); }}
                >
                  <Trash2 size={13} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Environments Tab (Global Environments) ──────────────────────────────────

function VariablesTab() {
  // Read from Zustand store (always in sync with editor) — fall back to IndexedDB load when store is empty
  const storeEnvs = useGlobalEnvironments();
  const { setGlobalEnvironments, addGlobalEnvironment, deleteGlobalEnvironment: deleteGlobalEnvStore,
    setGlobalEnvVariable, deleteGlobalEnvVariable } = useGlobalEnvActions();

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newVarKey, setNewVarKey] = useState('');
  const [newVarValue, setNewVarValue] = useState('');
  const [bootstrapped, setBootstrapped] = useState(storeEnvs.length > 0);

  // If Zustand store is empty (e.g. direct Dashboard visit without editor), hydrate from IndexedDB
  useEffect(() => {
    if (storeEnvs.length > 0) { setBootstrapped(true); return; }
    getGlobalEnvironments().then(list => {
      if (list.length > 0) setGlobalEnvironments(list);
      setBootstrapped(true);
    }).catch(() => setBootstrapped(true));
  }, []);

  // Auto-select first env
  useEffect(() => {
    if (!selectedId && storeEnvs.length > 0) setSelectedId(storeEnvs[0].id);
  }, [storeEnvs]);

  const selectedEnv = storeEnvs.find(e => e.id === selectedId) || null;

  const handleAddEnv = () => {
    const name = newName.trim();
    if (!name) return;
    const env = addGlobalEnvironment(name);
    saveAllGlobalEnvironments(useStore.getState().globalEnvironments).catch(() => {});
    setNewName('');
    setSelectedId(env.id);
  };

  const handleDeleteEnv = (id: string) => {
    deleteGlobalEnvStore(id);
    deleteGlobalEnvironment(id).catch(() => {});
    if (selectedId === id) setSelectedId(storeEnvs.find(e => e.id !== id)?.id || null);
  };

  const handleSetVar = (key: string, value: string) => {
    if (!selectedEnv) return;
    setGlobalEnvVariable(selectedEnv.id, key, value);
    const updated = { ...selectedEnv, variables: { ...selectedEnv.variables, [key]: value } };
    saveGlobalEnvironment(updated).catch(() => {});
  };

  const handleDeleteVar = (key: string) => {
    if (!selectedEnv) return;
    deleteGlobalEnvVariable(selectedEnv.id, key);
    const vars = { ...selectedEnv.variables };
    delete vars[key];
    saveGlobalEnvironment({ ...selectedEnv, variables: vars }).catch(() => {});
  };

  const handleAddVar = () => {
    if (!newVarKey.trim() || !selectedEnv) return;
    handleSetVar(newVarKey.trim(), newVarValue);
    setNewVarKey('');
    setNewVarValue('');
  };

  const handleExport = () => {
    const json = JSON.stringify(storeEnvs, null, 2);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'testkaro-environments.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const imported: Environment[] = JSON.parse(text);
      const merged = [...storeEnvs];
      for (const env of imported) {
        const withId = { ...env, id: env.id || crypto.randomUUID() };
        if (!merged.find(x => x.id === withId.id)) merged.push(withId);
        await saveGlobalEnvironment(withId);
      }
      setGlobalEnvironments(merged);
    } catch {
      alert('Failed to import: invalid JSON format');
    }
    e.target.value = '';
  };

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-[28px] font-bold text-text-primary mb-2">Environments</h1>
          <p className="text-sm text-text-secondary">
            Global environments shared with the editor. Type <code className="px-1 py-0.5 bg-bg-hover rounded text-[11px] font-mono">@key</code> in any test field to insert a variable.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-text-secondary hover:bg-bg-hover border border-border cursor-pointer transition-all">
            <Upload size={13} />
            Import
            <input type="file" accept=".json" className="hidden" onChange={handleImport} />
          </label>
          <button
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-text-secondary hover:bg-bg-hover border border-border transition-all disabled:opacity-40"
            onClick={handleExport}
            disabled={storeEnvs.length === 0}
          >
            <Download size={13} />
            Export
          </button>
        </div>
      </div>

      {!bootstrapped ? (
        <div className="text-xs text-text-tertiary">Loading…</div>
      ) : (
        <div className="flex gap-6">
          {/* Env list */}
          <div className="w-56 shrink-0">
            <h3 className="text-xs font-semibold text-text-secondary uppercase mb-3">
              {storeEnvs.length} Environment{storeEnvs.length !== 1 ? 's' : ''}
            </h3>
            <div className="space-y-1 mb-3">
              {storeEnvs.map(env => (
                <div
                  key={env.id}
                  className={`group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all ${
                    env.id === selectedId
                      ? 'bg-accent/10 text-accent border border-accent/20'
                      : 'text-text-secondary hover:bg-bg-hover border border-transparent'
                  }`}
                  onClick={() => setSelectedId(env.id)}
                >
                  <Globe size={12} className="shrink-0" />
                  <span className="text-sm flex-1 truncate">{env.name}</span>
                  <span className="text-[10px] text-text-tertiary tabular-nums">{Object.keys(env.variables).length}</span>
                  <button
                    className="p-0.5 opacity-0 group-hover:opacity-100 text-text-tertiary hover:text-danger transition-opacity"
                    onClick={e => { e.stopPropagation(); handleDeleteEnv(env.id); }}
                  >
                    <Trash2 size={10} />
                  </button>
                </div>
              ))}
              {storeEnvs.length === 0 && (
                <p className="text-xs text-text-tertiary italic px-1 py-2">No environments yet</p>
              )}
            </div>
            <div className="flex items-center gap-1">
              <input
                className="flex-1 bg-bg-input border border-border-subtle rounded-lg px-2.5 py-1.5 text-xs text-text-primary placeholder:text-text-tertiary outline-none focus:border-accent/40 transition-colors"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleAddEnv(); }}
                placeholder="New environment…"
              />
              <button onClick={handleAddEnv} className="p-1.5 rounded-lg hover:bg-bg-hover text-text-tertiary hover:text-accent transition-all">
                <Plus size={14} />
              </button>
            </div>
          </div>

          {/* Variables editor */}
          <div className="flex-1 min-w-0">
            {selectedEnv ? (
              <div className="border border-border rounded-xl overflow-hidden">
                <div className="px-4 py-3 bg-bg-secondary border-b border-border flex items-center gap-2">
                  <Globe size={13} className="text-accent" />
                  <span className="text-sm font-medium text-text-primary">{selectedEnv.name}</span>
                  <span className="text-[10px] text-text-tertiary ml-auto">
                    {Object.keys(selectedEnv.variables).length} var{Object.keys(selectedEnv.variables).length !== 1 ? 's' : ''}
                  </span>
                </div>

                <div className="p-4">
                  {Object.entries(selectedEnv.variables).length > 0 ? (
                    <div className="space-y-2 mb-4">
                      {Object.entries(selectedEnv.variables).map(([key, value]) => (
                        <div key={key} className="flex items-center gap-2 group">
                          <div className="flex items-center gap-1 bg-bg-tertiary border border-border-subtle rounded-lg px-2 py-1.5 min-w-[112px]">
                            <span className="text-[10px] text-accent/40 font-mono select-none">@</span>
                            <code className="text-xs text-accent font-mono flex-1 truncate">{key}</code>
                          </div>
                          <input
                            className="flex-1 bg-bg-input border border-border-subtle rounded-lg px-2.5 py-1.5 text-xs text-text-primary outline-none focus:border-border-active transition-colors"
                            value={String(value)}
                            onChange={e => handleSetVar(key, e.target.value)}
                          />
                          <button
                            className="p-1 opacity-0 group-hover:opacity-100 text-text-tertiary hover:text-danger transition-opacity"
                            onClick={() => handleDeleteVar(key)}
                          >
                            <Trash2 size={11} />
                          </button>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-xs text-text-tertiary italic mb-4">No variables yet. Add one below.</p>
                  )}

                  {/* Add variable */}
                  <div className="flex items-center gap-2 pt-3 border-t border-border">
                    <input
                      className="w-32 bg-bg-input border border-border-subtle rounded-lg px-2.5 py-1.5 text-xs text-text-primary placeholder:text-text-tertiary outline-none focus:border-border-active transition-colors"
                      value={newVarKey}
                      onChange={e => setNewVarKey(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleAddVar(); }}
                      placeholder="KEY"
                    />
                    <input
                      className="flex-1 bg-bg-input border border-border-subtle rounded-lg px-2.5 py-1.5 text-xs text-text-primary placeholder:text-text-tertiary outline-none focus:border-border-active transition-colors"
                      value={newVarValue}
                      onChange={e => setNewVarValue(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleAddVar(); }}
                      placeholder="value"
                    />
                    <button
                      onClick={handleAddVar}
                      disabled={!newVarKey.trim()}
                      className="px-3 py-1.5 rounded-lg bg-accent/10 text-accent text-xs font-medium hover:bg-accent/20 transition-colors disabled:opacity-40"
                    >
                      Add
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center h-48 text-center gap-2 border border-dashed border-border rounded-xl">
                <Globe size={20} className="text-text-tertiary" />
                <p className="text-xs text-text-tertiary">
                  {storeEnvs.length === 0 ? 'Create your first environment on the left' : 'Select an environment'}
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Settings Tab ────────────────────────────────────────────────────────────

const SETTINGS_KEY = 'testkaro-settings';

interface TKSettings {
  defaultTimeout: number;
  screenshotOnFailure: boolean;
  interStepDelay: number;
  videoDir: string;
  defaultHeaded: boolean;
}

function loadSettings(): TKSettings {
  try {
    return { ...defaultSettings(), ...JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') };
  } catch {
    return defaultSettings();
  }
}

function defaultSettings(): TKSettings {
  return {
    defaultTimeout: 10000,
    screenshotOnFailure: true,
    interStepDelay: 120,
    videoDir: '/tmp/testkaro-videos',
    defaultHeaded: true,
  };
}

export function saveSettings(s: TKSettings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(s));
}

function SettingsTab() {
  const [settings, setSettings] = useState<TKSettings>(loadSettings);

  const update = <K extends keyof TKSettings>(key: K, value: TKSettings[K]) => {
    const next = { ...settings, [key]: value };
    setSettings(next);
    saveSettings(next);
  };

  return (
    <div className="max-w-2xl mx-auto px-6 py-10">
      <div className="mb-8">
        <h1 className="text-[28px] font-bold text-text-primary mb-2">Settings</h1>
        <p className="text-sm text-text-secondary">Configure TestKaro execution preferences.</p>
      </div>

      <div className="border border-border rounded-xl overflow-hidden divide-y divide-border">
        {/* defaultTimeout */}
        <SettingRow
          label="Default Timeout"
          description="Maximum time per step in milliseconds"
        >
          <input
            type="number"
            className="w-28 bg-bg-input border border-border-subtle rounded px-2.5 py-1.5 text-sm text-text-primary outline-none focus:border-border-active"
            value={settings.defaultTimeout}
            onChange={e => update('defaultTimeout', Number(e.target.value))}
          />
        </SettingRow>

        {/* screenshotOnFailure */}
        <SettingRow
          label="Screenshot on Failure"
          description="Automatically capture a screenshot when a step fails"
        >
          <Toggle
            checked={settings.screenshotOnFailure}
            onChange={v => update('screenshotOnFailure', v)}
          />
        </SettingRow>

        {/* defaultHeaded */}
        <SettingRow
          label="Headed Mode by Default"
          description="Open a visible browser window when running tests"
        >
          <Toggle
            checked={settings.defaultHeaded}
            onChange={v => update('defaultHeaded', v)}
          />
        </SettingRow>

        {/* interStepDelay */}
        <SettingRow
          label="Pre-Step Delay"
          description="Pause before each step fires so you can see it highlighted (ms)"
        >
          <input
            type="number"
            className="w-28 bg-bg-input border border-border-subtle rounded px-2.5 py-1.5 text-sm text-text-primary outline-none focus:border-border-active"
            value={settings.interStepDelay}
            onChange={e => update('interStepDelay', Number(e.target.value))}
          />
        </SettingRow>

        {/* videoDir */}
        <SettingRow
          label="Video Output Directory"
          description="Where to save recorded test videos"
        >
          <input
            type="text"
            className="w-64 bg-bg-input border border-border-subtle rounded px-2.5 py-1.5 text-sm text-text-primary outline-none focus:border-border-active font-mono text-xs"
            value={settings.videoDir}
            onChange={e => update('videoDir', e.target.value)}
          />
        </SettingRow>
      </div>

      <div className="mt-4 flex items-center gap-4">
        <button
          className="text-xs text-text-tertiary hover:text-danger transition-colors"
          onClick={() => { const d = defaultSettings(); setSettings(d); saveSettings(d); }}
        >
          Reset to defaults
        </button>
        <span className="text-border">|</span>
        <button
          className="text-xs text-text-tertiary hover:text-text-primary transition-colors"
          onClick={() => {
            const blob = new Blob([JSON.stringify(settings, null, 2)], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'testkaro-settings.json';
            a.click();
            URL.revokeObjectURL(url);
          }}
        >
          Export settings
        </button>
        <label className="text-xs text-text-tertiary hover:text-text-primary transition-colors cursor-pointer">
          Import settings
          <input
            type="file"
            accept="application/json"
            className="hidden"
            onChange={e => {
              const file = e.target.files?.[0];
              e.target.value = '';
              if (!file) return;
              file.text().then(text => {
                try {
                  const parsed = { ...defaultSettings(), ...JSON.parse(text) };
                  setSettings(parsed);
                  saveSettings(parsed);
                  toast.success('Settings imported');
                } catch {
                  toast.error('Invalid settings file');
                }
              });
            }}
          />
        </label>
      </div>
    </div>
  );
}

function SettingRow({ label, description, children }: { label: string; description: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-4 px-5 py-4 bg-bg-card">
      <div>
        <div className="text-sm font-medium text-text-primary">{label}</div>
        <div className="text-xs text-text-tertiary mt-0.5">{description}</div>
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (v: boolean) => void }) {
  return (
    <button
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${checked ? 'bg-accent' : 'bg-border'}`}
    >
      <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-4' : 'translate-x-1'}`} />
    </button>
  );
}

// ─── Create App Modal ────────────────────────────────────────────────────────

function CreateAppModal({ onCreateModular, onClose }: {
  onCreateModular: (name: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState('');
  const trapRef = useFocusTrap<HTMLDivElement>(true);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onCreateModular(name.trim() || 'Untitled App');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />
      <div ref={trapRef} className="relative bg-bg-elevated border border-border rounded-xl w-full max-w-sm p-6 shadow-2xl animate-glass-reveal">
        <h2 className="text-lg font-semibold text-text-primary mb-4">Create New App</h2>
        <form onSubmit={handleSubmit}>
          <div className="mb-6">
            <label className="text-xs font-medium text-text-secondary mb-1.5 block">App Name</label>
            <input
              className="w-full px-3 py-2 rounded-lg border border-border bg-bg-input text-text-primary text-sm outline-none focus:border-accent transition-colors"
              placeholder="My Test Suite"
              value={name}
              onChange={e => setName(e.target.value)}
              autoFocus
            />
          </div>
          <div className="flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-sm text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-all"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 rounded-lg bg-accent text-on-accent text-sm font-medium hover:bg-accent/90 transition-colors"
            >
              Create
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Utils ───────────────────────────────────────────────────────────────────

function formatRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(timestamp).toLocaleDateString();
}
