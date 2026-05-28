import React, { useState } from 'react';
import {
  X, Plus, Trash2, Check, Edit3, Globe, Variable,
} from 'lucide-react';
import { useStore, useEnvironments, useActiveEnvironmentId, useEnvActions, useEnvDrawerOpen } from '../store';
import { Environment } from '../../schema';

export function EnvDrawer() {
  const open = useEnvDrawerOpen();
  const environments = useEnvironments();
  const activeEnvId = useActiveEnvironmentId();
  const {
    addEnvironment, deleteEnvironment, renameEnvironment,
    setActiveEnvironment, setEnvVariable, deleteEnvVariable,
  } = useEnvActions();

  const [selectedEnvId, setSelectedEnvId] = useState<string | null>(
    environments[0]?.id || null
  );
  const [newEnvName, setNewEnvName] = useState('');
  const [editingEnvId, setEditingEnvId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [newVarKey, setNewVarKey] = useState('');
  const [newVarValue, setNewVarValue] = useState('');

  const close = () => useStore.getState().setEnvDrawerOpen(false);

  if (!open) return null;

  const selectedEnv = environments.find(e => e.id === selectedEnvId) || null;

  const handleAddEnv = () => {
    const name = newEnvName.trim();
    if (!name) return;
    addEnvironment(name);
    setNewEnvName('');
  };

  const handleAddVariable = () => {
    if (!selectedEnvId || !newVarKey.trim()) return;
    setEnvVariable(selectedEnvId, newVarKey.trim(), newVarValue);
    setNewVarKey('');
    setNewVarValue('');
  };

  const startRename = (env: Environment) => {
    setEditingEnvId(env.id);
    setEditingName(env.name);
  };

  const commitRename = () => {
    if (editingEnvId && editingName.trim()) {
      renameEnvironment(editingEnvId, editingName.trim());
    }
    setEditingEnvId(null);
    setEditingName('');
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/20" onClick={close} />

      {/* Drawer - slides from right */}
      <div className="fixed top-0 right-0 bottom-0 z-50 w-[480px] bg-bg-secondary border-l border-border shadow-2xl flex flex-col animate-slide-in-right">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h2 className="text-sm font-semibold text-text-primary flex items-center gap-2">
            <Globe size={14} />
            Environment Variables
          </h2>
          <button onClick={close} className="p-1.5 rounded hover:bg-bg-hover text-text-tertiary">
            <X size={14} />
          </button>
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Left: Env list */}
          <div className="w-44 border-r border-border flex flex-col bg-bg-primary overflow-y-auto">
            <div className="p-2">
              {environments.map(env => (
                <div key={env.id} className="group">
                  {editingEnvId === env.id ? (
                    <div className="flex items-center gap-1 px-2 py-1">
                      <input
                        className="flex-1 bg-bg-input border border-border-active rounded px-1.5 py-0.5 text-xs text-text-primary outline-none w-full"
                        value={editingName}
                        onChange={e => setEditingName(e.target.value)}
                        onKeyDown={e => { if (e.key === 'Enter') commitRename(); if (e.key === 'Escape') setEditingEnvId(null); }}
                        autoFocus
                      />
                      <button onClick={commitRename} className="p-0.5 text-success"><Check size={10} /></button>
                    </div>
                  ) : (
                    <button
                      className={`w-full flex items-center gap-1.5 px-2 py-1.5 rounded text-xs text-left transition-all ${
                        env.id === selectedEnvId
                          ? 'bg-accent/10 text-accent font-medium'
                          : 'text-text-secondary hover:bg-bg-hover'
                      }`}
                      onClick={() => setSelectedEnvId(env.id)}
                    >
                      <Globe size={10} className={env.id === activeEnvId ? 'text-success' : 'text-text-tertiary'} />
                      <span className="truncate flex-1">{env.name}</span>
                      <div className="hidden group-hover:flex items-center gap-0.5">
                        <button onClick={e => { e.stopPropagation(); startRename(env); }} className="p-0.5 hover:text-accent"><Edit3 size={9} /></button>
                        <button onClick={e => { e.stopPropagation(); deleteEnvironment(env.id); }} className="p-0.5 hover:text-danger"><Trash2 size={9} /></button>
                      </div>
                    </button>
                  )}
                </div>
              ))}
            </div>

            {/* Add env */}
            <div className="p-2 border-t border-border mt-auto">
              <div className="flex items-center gap-1">
                <input
                  className="flex-1 bg-bg-input border border-border-subtle rounded px-2 py-1 text-xs text-text-primary placeholder:text-text-tertiary outline-none"
                  value={newEnvName}
                  onChange={e => setNewEnvName(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleAddEnv(); }}
                  placeholder="New env..."
                />
                <button onClick={handleAddEnv} className="p-1 rounded hover:bg-bg-hover text-text-tertiary hover:text-accent">
                  <Plus size={12} />
                </button>
              </div>
            </div>
          </div>

          {/* Right: Variables */}
          <div className="flex-1 flex flex-col overflow-y-auto">
            {selectedEnv ? (
              <>
                <div className="flex items-center justify-between px-4 py-2 border-b border-border">
                  <span className="text-xs font-medium text-text-primary">{selectedEnv.name}</span>
                  <button
                    className={`text-[10px] px-2 py-0.5 rounded ${
                      selectedEnv.id === activeEnvId
                        ? 'bg-success/10 text-success'
                        : 'bg-bg-hover text-text-secondary hover:text-accent'
                    }`}
                    onClick={() => setActiveEnvironment(selectedEnv.id)}
                  >
                    {selectedEnv.id === activeEnvId ? 'Active' : 'Set Active'}
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-3">
                  {Object.entries(selectedEnv.variables).map(([key, value]) => (
                    <div key={key} className="flex items-center gap-2 mb-2 group">
                      <code className="text-xs text-accent bg-accent/5 px-1.5 py-0.5 rounded min-w-[80px]">{key}</code>
                      <input
                        className="flex-1 bg-bg-input border border-border-subtle rounded px-2 py-1 text-xs text-text-primary outline-none focus:border-border-active"
                        value={String(value)}
                        onChange={e => setEnvVariable(selectedEnv.id, key, e.target.value)}
                      />
                      <button
                        className="p-1 opacity-0 group-hover:opacity-100 text-text-tertiary hover:text-danger transition-opacity"
                        onClick={() => deleteEnvVariable(selectedEnv.id, key)}
                      >
                        <Trash2 size={10} />
                      </button>
                    </div>
                  ))}

                  {Object.keys(selectedEnv.variables).length === 0 && (
                    <p className="text-xs text-text-tertiary italic py-4 text-center">No variables yet</p>
                  )}
                </div>

                {/* Add variable */}
                <div className="px-3 py-2 border-t border-border flex items-center gap-2">
                  <input
                    className="w-28 bg-bg-input border border-border-subtle rounded px-2 py-1 text-xs text-text-primary placeholder:text-text-tertiary outline-none"
                    value={newVarKey}
                    onChange={e => setNewVarKey(e.target.value)}
                    placeholder="Key"
                  />
                  <input
                    className="flex-1 bg-bg-input border border-border-subtle rounded px-2 py-1 text-xs text-text-primary placeholder:text-text-tertiary outline-none"
                    value={newVarValue}
                    onChange={e => setNewVarValue(e.target.value)}
                    onKeyDown={e => { if (e.key === 'Enter') handleAddVariable(); }}
                    placeholder="Value"
                  />
                  <button onClick={handleAddVariable} className="p-1 rounded hover:bg-bg-hover text-text-tertiary hover:text-accent">
                    <Plus size={12} />
                  </button>
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-xs text-text-tertiary">
                Select or create an environment
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
