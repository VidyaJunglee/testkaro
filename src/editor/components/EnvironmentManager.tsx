import React, { useState } from 'react';
import {
  X, Plus, Trash2, Check, Edit3, Globe, Variable,
} from 'lucide-react';
import { useEnvironments, useActiveEnvironmentId, useEnvActions } from '../store';
import { Environment } from '../../schema';

interface Props {
  open: boolean;
  onClose: () => void;
}

export function EnvironmentManager({ open, onClose }: Props) {
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

  if (!open) return null;

  const selectedEnv = environments.find(e => e.id === selectedEnvId) || null;

  const handleAddEnv = () => {
    const name = newEnvName.trim();
    if (!name) return;
    addEnvironment(name);
    setNewEnvName('');
    // Select the newly added env (it's the last one)
    setTimeout(() => {
      const store = environments;
      // We'll rely on next render to pick it up
    }, 0);
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
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-[720px] max-h-[80vh] bg-bg-secondary border border-border rounded-xl shadow-2xl flex overflow-hidden">
        {/* Left: Environment List */}
        <div className="w-52 border-r border-border flex flex-col bg-bg-primary">
          <div className="p-3 border-b border-border">
            <h3 className="text-sm font-semibold text-text-primary flex items-center gap-1.5">
              <Globe size={13} />
              Environments
            </h3>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
            {environments.map(env => (
              <div
                key={env.id}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-xs cursor-pointer transition-all ${
                  selectedEnvId === env.id
                    ? 'bg-accent/10 text-accent border border-accent/20'
                    : 'text-text-secondary hover:bg-bg-hover border border-transparent'
                }`}
                onClick={() => setSelectedEnvId(env.id)}
              >
                {activeEnvId === env.id && (
                  <Check size={10} className="text-success shrink-0" />
                )}
                {editingEnvId === env.id ? (
                  <input
                    className="flex-1 bg-bg-input border border-border-active rounded px-1.5 py-0.5 text-xs text-text-primary outline-none"
                    value={editingName}
                    onChange={e => setEditingName(e.target.value)}
                    onBlur={commitRename}
                    onKeyDown={e => e.key === 'Enter' && commitRename()}
                    autoFocus
                    onClick={e => e.stopPropagation()}
                  />
                ) : (
                  <span className="flex-1 truncate">{env.name}</span>
                )}
              </div>
            ))}
          </div>

          {/* Add new env */}
          <div className="p-2 border-t border-border">
            <div className="flex gap-1">
              <input
                className="flex-1 bg-bg-input border border-border-subtle rounded px-2 py-1 text-xs text-text-primary outline-none focus:border-border-active placeholder:text-text-tertiary"
                placeholder="New environment"
                value={newEnvName}
                onChange={e => setNewEnvName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && handleAddEnv()}
              />
              <button
                className="p-1 rounded text-accent hover:bg-accent/10 transition-all disabled:opacity-30"
                onClick={handleAddEnv}
                disabled={!newEnvName.trim()}
              >
                <Plus size={13} />
              </button>
            </div>
          </div>
        </div>

        {/* Right: Variable Editor */}
        <div className="flex-1 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-3 border-b border-border">
            <div className="flex items-center gap-2">
              {selectedEnv ? (
                <>
                  <h3 className="text-sm font-semibold text-text-primary">{selectedEnv.name}</h3>
                  <button
                    className="p-1 rounded text-text-tertiary hover:text-text-secondary hover:bg-bg-hover transition-all"
                    onClick={() => startRename(selectedEnv)}
                    title="Rename"
                  >
                    <Edit3 size={11} />
                  </button>
                  {activeEnvId === selectedEnv.id ? (
                    <span className="text-[10px] px-1.5 py-0.5 bg-success/10 text-success rounded font-medium">Active</span>
                  ) : (
                    <button
                      className="text-[10px] px-1.5 py-0.5 bg-accent/10 text-accent rounded font-medium hover:bg-accent/20 transition-all"
                      onClick={() => setActiveEnvironment(selectedEnv.id)}
                    >
                      Set Active
                    </button>
                  )}
                </>
              ) : (
                <span className="text-xs text-text-tertiary">Select an environment</span>
              )}
            </div>

            <div className="flex items-center gap-1">
              {selectedEnv && (
                <button
                  className="p-1.5 rounded text-text-tertiary hover:text-danger hover:bg-danger/10 transition-all"
                  onClick={() => {
                    deleteEnvironment(selectedEnv.id);
                    setSelectedEnvId(environments.find(e => e.id !== selectedEnv.id)?.id || null);
                  }}
                  title="Delete environment"
                >
                  <Trash2 size={12} />
                </button>
              )}
              <button
                className="p-1.5 rounded text-text-tertiary hover:text-text-secondary hover:bg-bg-hover transition-all"
                onClick={onClose}
              >
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Variables table */}
          {selectedEnv ? (
            <div className="flex-1 overflow-y-auto p-3">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-text-tertiary border-b border-border-subtle">
                    <th className="text-left font-medium pb-2 pl-2 w-[40%]">Variable</th>
                    <th className="text-left font-medium pb-2 w-[50%]">Value</th>
                    <th className="pb-2 w-8"></th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(selectedEnv.variables).map(([key, value]) => (
                    <tr key={key} className="group border-b border-border-subtle/50 hover:bg-bg-hover/50">
                      <td className="py-1.5 pl-2">
                        <code className="text-accent font-mono text-xs">{`{{${key}}}`}</code>
                      </td>
                      <td className="py-1.5">
                        <input
                          className="w-full bg-transparent border border-transparent hover:border-border-subtle focus:border-border-active focus:bg-bg-input rounded px-1.5 py-0.5 text-xs text-text-secondary outline-none transition-all"
                          value={value}
                          onChange={e => setEnvVariable(selectedEnv.id, key, e.target.value)}
                        />
                      </td>
                      <td className="py-1.5 text-center">
                        <button
                          className="p-0.5 rounded text-text-tertiary opacity-0 group-hover:opacity-100 hover:text-danger transition-all"
                          onClick={() => deleteEnvVariable(selectedEnv.id, key)}
                        >
                          <Trash2 size={11} />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {/* Add variable row */}
              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-border-subtle">
                <input
                  className="flex-1 bg-bg-input border border-border-subtle rounded px-2 py-1.5 text-xs text-text-primary outline-none focus:border-border-active placeholder:text-text-tertiary"
                  placeholder="Variable name"
                  value={newVarKey}
                  onChange={e => setNewVarKey(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddVariable()}
                />
                <input
                  className="flex-1 bg-bg-input border border-border-subtle rounded px-2 py-1.5 text-xs text-text-primary outline-none focus:border-border-active placeholder:text-text-tertiary"
                  placeholder="Value"
                  value={newVarValue}
                  onChange={e => setNewVarValue(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleAddVariable()}
                />
                <button
                  className="flex items-center gap-1 px-2.5 py-1.5 rounded text-xs font-medium bg-accent/10 text-accent hover:bg-accent/20 transition-all disabled:opacity-30"
                  onClick={handleAddVariable}
                  disabled={!newVarKey.trim()}
                >
                  <Plus size={11} />
                  Add
                </button>
              </div>

              {Object.keys(selectedEnv.variables).length === 0 && (
                <div className="flex flex-col items-center justify-center py-8 text-text-tertiary">
                  <Variable size={24} className="mb-2 opacity-40" />
                  <p className="text-xs">No variables yet</p>
                  <p className="text-[10px] mt-1">Add variables above to use as <code className="text-accent">{`{{varName}}`}</code> in steps</p>
                </div>
              )}
            </div>
          ) : (
            <div className="flex-1 flex items-center justify-center text-text-tertiary text-xs">
              {environments.length === 0
                ? 'Create your first environment to get started'
                : 'Select an environment from the list'}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
