import React, { useEffect, useState } from 'react';
import { useStore, useSessionActions } from '../store';
import { listApps, AppSummary, createModularApp, saveApp, deleteApp } from '../storage/app-registry';
import { getGlobalEnvironments, saveGlobalEnvironment, deleteGlobalEnvironment } from '../storage/global-env-store';
import { navigateToApp } from '../router';
import { InlineConfirm } from './InlineConfirm';
import { Environment } from '../../schema';
import {
  Layers, Plus, Clock, FileText, Play,
  Package, Moon, Sun, Trash2,
  Globe, Settings,
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
    await loadApps();
  };

  const handleOpenApp = (app: AppSummary) => {
    navigateToApp(app.id);
  };

  return (
    <div className="h-screen bg-bg-primary flex">
      {/* Navigation Rail */}
      <nav className="w-16 bg-bg-secondary border-r border-border flex flex-col items-center py-4 gap-1 shrink-0">
        <div className="w-8 h-8 bg-gradient-to-br from-accent to-blue-700 rounded-md flex items-center justify-center mb-6">
          <Layers size={14} className="text-white" />
        </div>

        <NavRailButton
          icon={<FileText size={18} />}
          label="Projects"
          active={activeTab === 'projects'}
          onClick={() => setActiveTab('projects')}
        />
        <NavRailButton
          icon={<Globe size={18} />}
          label="Variables"
          active={activeTab === 'variables'}
          onClick={() => setActiveTab('variables')}
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
        <header className="flex items-center justify-between h-14 px-6 border-b border-border bg-bg-secondary shrink-0">
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
  return (
    <div className="max-w-4xl mx-auto px-6 py-8">
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
          className="flex items-center gap-2 px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent-hover transition-colors"
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
            className="px-4 py-2 bg-accent text-white text-xs font-medium rounded-lg hover:bg-accent/90 transition-colors"
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
                <InlineConfirm onConfirm={() => onDeleteApp(app.id)} message="Delete?">
                  {({ requestConfirm }) => (
                    <button
                      className="w-7 h-7 flex items-center justify-center rounded opacity-0 group-hover:opacity-100 text-text-tertiary hover:text-danger hover:bg-danger/10 transition-all"
                      onClick={e => { e.stopPropagation(); requestConfirm(); }}
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </InlineConfirm>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Variables Tab (Global Environments) ─────────────────────────────────────

function VariablesTab() {
  const [envs, setEnvs] = useState<Environment[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newName, setNewName] = useState('');
  const [newVarKey, setNewVarKey] = useState('');
  const [newVarValue, setNewVarValue] = useState('');
  const [loading, setLoading] = useState(true);

  const loadEnvs = async () => {
    const list = await getGlobalEnvironments();
    setEnvs(list);
    if (list.length > 0 && !selectedId) setSelectedId(list[0].id);
    setLoading(false);
  };

  useEffect(() => { loadEnvs(); }, []);

  const selectedEnv = envs.find(e => e.id === selectedId) || null;

  const handleAddEnv = async () => {
    const name = newName.trim();
    if (!name) return;
    const env: Environment = { id: crypto.randomUUID(), name, variables: {} };
    await saveGlobalEnvironment(env);
    setNewName('');
    await loadEnvs();
    setSelectedId(env.id);
  };

  const handleDeleteEnv = async (id: string) => {
    await deleteGlobalEnvironment(id);
    if (selectedId === id) setSelectedId(null);
    await loadEnvs();
  };

  const handleSetVar = async (key: string, value: string) => {
    if (!selectedEnv) return;
    const updated = { ...selectedEnv, variables: { ...selectedEnv.variables, [key]: value } };
    await saveGlobalEnvironment(updated);
    await loadEnvs();
  };

  const handleDeleteVar = async (key: string) => {
    if (!selectedEnv) return;
    const vars = { ...selectedEnv.variables };
    delete vars[key];
    const updated = { ...selectedEnv, variables: vars };
    await saveGlobalEnvironment(updated);
    await loadEnvs();
  };

  const handleAddVar = async () => {
    if (!selectedId || !newVarKey.trim()) return;
    await handleSetVar(newVarKey.trim(), newVarValue);
    setNewVarKey('');
    setNewVarValue('');
  };

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <div className="mb-8">
        <h1 className="text-[28px] font-bold text-text-primary mb-2">Global Variables</h1>
        <p className="text-sm text-text-secondary">
          Manage environment variables shared across all apps. App-level variables override these.
        </p>
      </div>

      {loading ? (
        <div className="text-xs text-text-tertiary">Loading...</div>
      ) : (
        <div className="flex gap-6">
          {/* Env list */}
          <div className="w-56 shrink-0">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-semibold text-text-secondary uppercase">Environments</h3>
            </div>
            <div className="space-y-1 mb-3">
              {envs.map(env => (
                <div
                  key={env.id}
                  className={`group flex items-center gap-2 px-3 py-2 rounded-lg cursor-pointer transition-all ${
                    env.id === selectedId
                      ? 'bg-accent/10 text-accent border border-accent/20'
                      : 'text-text-secondary hover:bg-bg-hover border border-transparent'
                  }`}
                  onClick={() => setSelectedId(env.id)}
                >
                  <Globe size={12} />
                  <span className="text-sm flex-1 truncate">{env.name}</span>
                  <span className="text-[10px] text-text-tertiary">{Object.keys(env.variables).length}</span>
                  <button
                    className="p-0.5 opacity-0 group-hover:opacity-100 text-text-tertiary hover:text-danger"
                    onClick={e => { e.stopPropagation(); handleDeleteEnv(env.id); }}
                  >
                    <Trash2 size={10} />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-1">
              <input
                className="flex-1 bg-bg-input border border-border-subtle rounded px-2 py-1.5 text-xs text-text-primary placeholder:text-text-tertiary outline-none"
                value={newName}
                onChange={e => setNewName(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') handleAddEnv(); }}
                placeholder="New environment..."
              />
              <button onClick={handleAddEnv} className="p-1.5 rounded hover:bg-bg-hover text-text-tertiary hover:text-accent">
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
                    {Object.keys(selectedEnv.variables).length} variables
                  </span>
                </div>

                <div className="p-4">
                  {Object.entries(selectedEnv.variables).length > 0 ? (
                    <div className="space-y-2 mb-4">
                      {Object.entries(selectedEnv.variables).map(([key, value]) => (
                        <div key={key} className="flex items-center gap-2 group">
                          <code className="text-xs text-accent bg-accent/5 px-2 py-1 rounded min-w-[100px] font-mono">{key}</code>
                          <input
                            className="flex-1 bg-bg-input border border-border-subtle rounded px-2.5 py-1.5 text-xs text-text-primary outline-none focus:border-border-active"
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
                    <p className="text-xs text-text-tertiary italic mb-4">No variables defined yet</p>
                  )}

                  {/* Add variable */}
                  <div className="flex items-center gap-2 pt-3 border-t border-border">
                    <input
                      className="w-32 bg-bg-input border border-border-subtle rounded px-2.5 py-1.5 text-xs text-text-primary placeholder:text-text-tertiary outline-none"
                      value={newVarKey}
                      onChange={e => setNewVarKey(e.target.value)}
                      placeholder="Key"
                    />
                    <input
                      className="flex-1 bg-bg-input border border-border-subtle rounded px-2.5 py-1.5 text-xs text-text-primary placeholder:text-text-tertiary outline-none"
                      value={newVarValue}
                      onChange={e => setNewVarValue(e.target.value)}
                      onKeyDown={e => { if (e.key === 'Enter') handleAddVar(); }}
                      placeholder="Value"
                    />
                    <button onClick={handleAddVar} className="px-3 py-1.5 rounded bg-accent/10 text-accent text-xs font-medium hover:bg-accent/20 transition-colors">
                      Add
                    </button>
                  </div>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-48 text-xs text-text-tertiary border border-dashed border-border rounded-xl">
                Select or create an environment
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Settings Tab ────────────────────────────────────────────────────────────

function SettingsTab() {
  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <div className="mb-8">
        <h1 className="text-[28px] font-bold text-text-primary mb-2">Settings</h1>
        <p className="text-sm text-text-secondary">
          Configure TestKaro preferences.
        </p>
      </div>
      <div className="text-xs text-text-tertiary border border-dashed border-border rounded-xl p-8 text-center">
        Settings panel coming soon.
      </div>
    </div>
  );
}

// ─── Create App Modal ────────────────────────────────────────────────────────

function CreateAppModal({ onCreateModular, onClose }: {
  onCreateModular: (name: string) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onCreateModular(name.trim() || 'Untitled App');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      <div className="relative bg-bg-secondary border border-border rounded-xl shadow-xl w-full max-w-sm p-6">
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
              className="px-4 py-2 rounded-lg bg-accent text-white text-sm font-medium hover:bg-accent/90 transition-colors"
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
