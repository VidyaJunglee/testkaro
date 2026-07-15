import { useState, useEffect, useRef } from 'react';
import { X, Plus, Trash2, Check, Pencil, Globe, FolderOpen, Eye, EyeOff, ChevronRight } from 'lucide-react';
import {
  useStore,
  useEnvironments, useActiveEnvironmentId, useEnvActions,
  useGlobalEnvironments, useGlobalEnvActions,
  useEnvDrawerOpen,
} from '../store';
import { Environment } from '../../schema';
import { useFocusTrap } from '../hooks/useFocusTrap';

type Tab = 'global' | 'custom';

export function EnvDrawer() {
  const open = useEnvDrawerOpen();
  const trapRef = useFocusTrap<HTMLDivElement>(open);

  const localEnvs = useEnvironments();
  const activeLocalId = useActiveEnvironmentId();
  const { addEnvironment, deleteEnvironment, renameEnvironment, setActiveEnvironment, setEnvVariable, deleteEnvVariable } = useEnvActions();

  const globalEnvs = useGlobalEnvironments();
  const { addGlobalEnvironment, setActiveGlobalEnvironment, setGlobalEnvVariable, deleteGlobalEnvVariable } = useGlobalEnvActions();

  const [tab, setTab] = useState<Tab>('global');
  const [showValues, setShowValues] = useState(false);
  const [selectedLocalId, setSelectedLocalId] = useState<string | null>(null);
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [renamingName, setRenamingName] = useState('');
  const [addingEnv, setAddingEnv] = useState(false);
  const [newEnvName, setNewEnvName] = useState('');
  const [newVarKey, setNewVarKey] = useState('');
  const [newVarValue, setNewVarValue] = useState('');
  const newEnvInputRef = useRef<HTMLInputElement>(null);
  const newVarKeyRef = useRef<HTMLInputElement>(null);

  const globalEnv: Environment | null = globalEnvs[0] || null;

  const ensureGlobalEnv = (): string => {
    if (globalEnv) return globalEnv.id;
    const env = addGlobalEnvironment('Global');
    setActiveGlobalEnvironment(env.id);
    return env.id;
  };

  useEffect(() => {
    if (!open) return;
    if (!selectedLocalId && localEnvs.length > 0) setSelectedLocalId(localEnvs[0].id);
  }, [open, localEnvs]);

  useEffect(() => {
    if (addingEnv) newEnvInputRef.current?.focus();
  }, [addingEnv]);

  // Keyboard shortcuts: 1–9 select nth custom env, Escape closes
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
      if (e.key === 'Escape') { close(); return; }
      if (tab === 'custom') {
        const idx = parseInt(e.key) - 1;
        if (!isNaN(idx) && idx >= 0 && idx < localEnvs.length) {
          setSelectedLocalId(localEnvs[idx].id);
          setActiveEnvironment(localEnvs[idx].id);
        }
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, tab, localEnvs]);

  const close = () => {
    useStore.getState().setEnvDrawerOpen(false);
    setRenamingId(null);
    setAddingEnv(false);
  };

  if (!open) return null;

  // ── Helpers ──
  const localEnv: Environment | null = localEnvs.find(e => e.id === selectedLocalId) || null;
  const isActiveLocal = selectedLocalId === activeLocalId;

  const deleteLocalEnv = (id: string) => {
    deleteEnvironment(id);
    if (selectedLocalId === id) {
      const remaining = localEnvs.filter(e => e.id !== id);
      setSelectedLocalId(remaining.length > 0 ? remaining[0].id : null);
    }
  };

  const commitRename = () => {
    if (!renamingId || !renamingName.trim()) { setRenamingId(null); return; }
    renameEnvironment(renamingId, renamingName.trim());
    setRenamingId(null);
  };

  const handleAddLocalEnv = () => {
    const name = newEnvName.trim();
    if (!name) { setAddingEnv(false); return; }
    const newId = crypto.randomUUID();
    addEnvironment(name, newId);
    setNewEnvName('');
    setAddingEnv(false);
    setSelectedLocalId(newId);
  };

  // ── Variable helpers (shared) ──
  const currentEnv = tab === 'global' ? globalEnv : localEnv;

  const setVar = (key: string, value: string) => {
    if (tab === 'global') {
      setGlobalEnvVariable(ensureGlobalEnv(), key, value);
    } else {
      if (selectedLocalId) setEnvVariable(selectedLocalId, key, value);
    }
  };

  const deleteVar = (key: string) => {
    if (tab === 'global') {
      if (globalEnv) deleteGlobalEnvVariable(globalEnv.id, key);
    } else {
      if (selectedLocalId) deleteEnvVariable(selectedLocalId, key);
    }
  };

  const handleAddVar = () => {
    const key = newVarKey.trim();
    if (!key) return;
    setVar(key, newVarValue);
    setNewVarKey('');
    setNewVarValue('');
    newVarKeyRef.current?.focus();
  };

  const varEntries = currentEnv ? Object.entries(currentEnv.variables) : [];
  const globalVarCount = globalEnv ? Object.keys(globalEnv.variables).length : 0;

  // ── Variable panel (shared between global and custom) ──
  // Grid: [key 11rem] [value 1fr] [actions 3rem]
  const colGrid = 'grid grid-cols-[11rem_1fr_3rem]';

  const varPanel = (
    <div className="flex flex-col flex-1 min-h-0">
      {/* Table header */}
      <div className={`${colGrid} items-center px-4 py-2 border-b border-border-subtle bg-bg-primary/30 shrink-0`}>
        <span className="text-[10px] uppercase tracking-wider font-semibold text-text-tertiary">Key</span>
        <span className="text-[10px] uppercase tracking-wider font-semibold text-text-tertiary">Value</span>
        <span />
      </div>

      {/* Variable rows */}
      <div className="flex-1 overflow-y-auto">
        {varEntries.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-center py-10">
            <div className="w-10 h-10 rounded-xl bg-bg-tertiary flex items-center justify-center mb-1">
              <Plus size={16} className="text-text-tertiary" />
            </div>
            <p className="text-xs font-medium text-text-secondary">No variables yet</p>
            <p className="text-[11px] text-text-tertiary">Add one using the form below</p>
          </div>
        ) : (
          varEntries.map(([key, value]) => (
            <VarRow
              key={key}
              varKey={key}
              value={String(value)}
              accent={tab === 'global' ? 'accent' : 'warning'}
              showValue={showValues}
              onSave={v => setVar(key, v)}
              onDelete={() => deleteVar(key)}
            />
          ))
        )}
      </div>

      {/* Add variable — grid matches table columns */}
      <div className={`${colGrid} items-center gap-2 px-4 py-3 border-t border-border bg-bg-secondary/40 shrink-0`}>
        <input
          ref={newVarKeyRef}
          className="w-full bg-bg-input border border-border rounded-lg px-3 py-2 text-xs text-text-primary placeholder:text-text-tertiary outline-none focus:border-border-active transition-colors font-mono"
          value={newVarKey}
          onChange={e => setNewVarKey(e.target.value)}
          onKeyDown={e => {
            if (e.key === 'Enter') handleAddVar();
            if (e.key === 'Tab' && newVarKey.trim()) { e.preventDefault(); document.getElementById('env-val-input')?.focus(); }
          }}
          placeholder="VARIABLE_NAME"
        />
        <input
          id="env-val-input"
          type={showValues ? 'text' : 'password'}
          className="w-full bg-bg-input border border-border rounded-lg px-3 py-2 text-xs text-text-primary placeholder:text-text-tertiary outline-none focus:border-border-active transition-colors"
          value={newVarValue}
          onChange={e => setNewVarValue(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') handleAddVar(); }}
          placeholder="value"
        />
        <button
          onClick={handleAddVar}
          disabled={!newVarKey.trim()}
          className={`flex items-center justify-center gap-1 py-2 rounded-lg text-xs font-medium transition-all w-full ${
            newVarKey.trim()
              ? 'bg-accent text-on-accent hover:bg-accent-hover'
              : 'bg-bg-tertiary text-text-tertiary cursor-not-allowed'
          }`}
        >
          <Plus size={11} />
          Add
        </button>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60" onClick={close} />

      <div
        ref={trapRef}
        className="relative w-full flex flex-col bg-bg-elevated border border-border rounded-2xl shadow-2xl overflow-hidden animate-glass-reveal"
        style={{ maxWidth: tab === 'custom' ? 720 : 560, height: 'min(640px, 92vh)' }}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-border shrink-0">
          <div className="flex items-center gap-3">
            <span className="text-sm font-semibold text-text-primary">Environments</span>
            <span className="text-[11px] text-text-tertiary hidden sm:block">
              type <code className="font-mono bg-bg-tertiary px-1.5 py-0.5 rounded text-text-secondary">@key</code> to insert a variable
            </span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowValues(v => !v)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-medium border transition-all ${
                showValues
                  ? 'bg-accent/10 text-accent border-accent/25'
                  : 'text-text-tertiary border-border-subtle hover:text-text-secondary hover:border-border'
              }`}
            >
              {showValues ? <EyeOff size={12} /> : <Eye size={12} />}
              {showValues ? 'Hide' : 'Reveal'}
            </button>
            <button onClick={close} className="p-1.5 rounded-lg text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-all">
              <X size={15} />
            </button>
          </div>
        </div>

        {/* ── Tab bar ── */}
        <div className="flex border-b border-border shrink-0">
          <button
            onClick={() => { setTab('global'); setRenamingId(null); setAddingEnv(false); }}
            className={`flex items-center gap-2 px-5 py-2.5 text-xs font-semibold border-b-2 transition-all ${
              tab === 'global' ? 'border-accent text-accent' : 'border-transparent text-text-tertiary hover:text-text-secondary'
            }`}
          >
            <Globe size={12} />
            Global
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
              tab === 'global' ? 'bg-accent/15 text-accent' : 'bg-bg-tertiary text-text-tertiary'
            }`}>{globalVarCount}</span>
          </button>
          <button
            onClick={() => { setTab('custom'); setRenamingId(null); setAddingEnv(false); }}
            className={`flex items-center gap-2 px-5 py-2.5 text-xs font-semibold border-b-2 transition-all ${
              tab === 'custom' ? 'border-text-primary text-text-primary' : 'border-transparent text-text-tertiary hover:text-text-secondary'
            }`}
          >
            <FolderOpen size={12} />
            Custom
            <span className={`px-1.5 py-0.5 rounded-full text-[10px] font-bold ${
              tab === 'custom' ? 'bg-bg-tertiary text-text-secondary' : 'bg-bg-tertiary text-text-tertiary'
            }`}>{localEnvs.length}</span>
          </button>
          <div className="flex-1" />
          <span className="self-center pr-4 text-[10px] text-text-tertiary">
            {tab === 'global' ? 'shared across all apps' : 'scoped to this app'}
          </span>
        </div>

        {/* ── Content ── */}
        {tab === 'global' ? (
          /* Global: single-panel */
          varPanel
        ) : (
          /* Custom: two-panel */
          <div className="flex flex-1 min-h-0">

            {/* ── Left: Env list ── */}
            <div className="w-52 shrink-0 border-r border-border flex flex-col bg-bg-primary/20">
              {/* List */}
              <div className="flex-1 overflow-y-auto py-1.5">
                {localEnvs.length === 0 && !addingEnv ? (
                  <div className="flex flex-col items-center justify-center h-full gap-2 px-4 py-8 text-center">
                    <FolderOpen size={22} className="text-text-tertiary/40" />
                    <p className="text-[11px] text-text-tertiary">No environments yet</p>
                  </div>
                ) : (
                  localEnvs.map((env, idx) => {
                    const isSel = env.id === selectedLocalId;
                    const isAct = env.id === activeLocalId;

                    if (renamingId === env.id) {
                      return (
                        <form
                          key={env.id}
                          className="px-3 py-1.5"
                          onSubmit={e => { e.preventDefault(); commitRename(); }}
                        >
                          <input
                            className="w-full bg-bg-input border border-border-active rounded-lg px-2.5 py-1.5 text-xs text-text-primary outline-none"
                            value={renamingName}
                            onChange={e => setRenamingName(e.target.value)}
                            onKeyDown={e => { if (e.key === 'Escape') setRenamingId(null); }}
                            onBlur={commitRename}
                            autoFocus
                          />
                        </form>
                      );
                    }

                    return (
                      <div
                        key={env.id}
                        onClick={() => setSelectedLocalId(env.id)}
                        className={`group/env relative flex items-center gap-2.5 px-3 py-2.5 mx-1.5 rounded-lg cursor-pointer transition-all ${
                          isSel
                            ? 'bg-bg-elevated text-text-primary shadow-sm'
                            : 'text-text-secondary hover:bg-bg-hover/60 hover:text-text-primary'
                        }`}
                      >
                        {/* Active indicator */}
                        <div className={`w-1.5 h-1.5 rounded-full shrink-0 transition-colors ${
                          isAct ? 'bg-success' : 'bg-transparent'
                        }`} />

                        {/* Name + var count */}
                        <div className="flex-1 min-w-0">
                          <span className="text-xs font-medium block truncate">{env.name}</span>
                          <span className="text-[10px] text-text-tertiary">
                            {Object.keys(env.variables).length} var{Object.keys(env.variables).length !== 1 ? 's' : ''}
                            {isAct && <span className="ml-1.5 text-success font-medium">· active</span>}
                          </span>
                        </div>

                        {/* Keyboard hint */}
                        {idx < 9 && (
                          <kbd className={`text-[9px] px-1 py-0.5 rounded font-mono shrink-0 transition-opacity ${
                            isSel ? 'opacity-60' : 'opacity-0 group-hover/env:opacity-40'
                          } bg-bg-tertiary text-text-tertiary`}>{idx + 1}</kbd>
                        )}

                        {/* Hover actions */}
                        <div className="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-0.5 opacity-0 group-hover/env:opacity-100 transition-opacity bg-bg-elevated rounded-md shadow-sm border border-border-subtle">
                          <button
                            className="p-1.5 text-text-tertiary hover:text-text-primary transition-colors"
                            onClick={e => { e.stopPropagation(); setRenamingId(env.id); setRenamingName(env.name); }}
                            title="Rename"
                          >
                            <Pencil size={10} />
                          </button>
                          {!isAct && (
                            <button
                              className="p-1.5 text-text-tertiary hover:text-danger transition-colors border-l border-border-subtle"
                              onClick={e => { e.stopPropagation(); deleteLocalEnv(env.id); }}
                              title="Delete"
                            >
                              <Trash2 size={10} />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}

                {/* Inline new env form */}
                {addingEnv && (
                  <form
                    className="px-3 py-1.5 mx-1.5"
                    onSubmit={e => { e.preventDefault(); handleAddLocalEnv(); }}
                  >
                    <input
                      ref={newEnvInputRef}
                      className="w-full bg-bg-input border border-border-active rounded-lg px-2.5 py-1.5 text-xs text-text-primary outline-none"
                      value={newEnvName}
                      onChange={e => setNewEnvName(e.target.value)}
                      placeholder="Environment name"
                      onKeyDown={e => { if (e.key === 'Escape') { setAddingEnv(false); setNewEnvName(''); } }}
                      onBlur={() => { if (!newEnvName.trim()) { setAddingEnv(false); } else handleAddLocalEnv(); }}
                    />
                  </form>
                )}
              </div>

              {/* New env button */}
              <div className="px-3 py-2.5 border-t border-border-subtle shrink-0">
                <button
                  onClick={() => setAddingEnv(true)}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-text-tertiary hover:text-text-secondary hover:bg-bg-hover border border-dashed border-border-subtle hover:border-border transition-all"
                >
                  <Plus size={12} />
                  New environment
                </button>
              </div>
            </div>

            {/* ── Right: Variable panel ── */}
            <div className="flex-1 flex flex-col min-w-0">
              {localEnv ? (
                <>
                  {/* Env header */}
                  <div className="flex items-center justify-between px-4 py-2.5 border-b border-border-subtle shrink-0">
                    <div className="flex items-center gap-2 min-w-0">
                      <FolderOpen size={13} className="text-text-tertiary shrink-0" />
                      <span className="text-xs font-semibold text-text-primary truncate">{localEnv.name}</span>
                      <span className="text-[10px] text-text-tertiary">
                        {varEntries.length} variable{varEntries.length !== 1 ? 's' : ''}
                      </span>
                    </div>
                    <button
                      onClick={() => { if (selectedLocalId) setActiveEnvironment(selectedLocalId); }}
                      className={`flex items-center gap-1.5 text-[11px] px-2.5 py-1 rounded-lg font-medium transition-all border shrink-0 ${
                        isActiveLocal
                          ? 'bg-success/10 text-success border-success/20 cursor-default'
                          : 'text-text-secondary border-border hover:border-border-active hover:text-text-primary'
                      }`}
                    >
                      {isActiveLocal ? <Check size={10} /> : <ChevronRight size={10} />}
                      {isActiveLocal ? 'Active' : 'Set active'}
                    </button>
                  </div>

                  {varPanel}
                </>
              ) : (
                /* No env selected */
                <div className="flex-1 flex flex-col items-center justify-center gap-3 text-center px-8">
                  <div className="w-12 h-12 rounded-2xl bg-bg-tertiary flex items-center justify-center">
                    <FolderOpen size={20} className="text-text-tertiary" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-text-primary">Select an environment</p>
                    <p className="text-xs text-text-tertiary mt-1">Choose from the list or create a new one</p>
                  </div>
                  <button
                    onClick={() => setAddingEnv(true)}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-accent text-on-accent text-xs font-medium hover:bg-accent-hover transition-colors mt-1"
                  >
                    <Plus size={12} />
                    New environment
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Inline-editable variable row ─────────────────────────────────────────────

interface VarRowProps {
  varKey: string;
  value: string;
  accent: 'accent' | 'warning';
  showValue: boolean;
  onSave: (value: string) => void;
  onDelete: () => void;
}

function VarRow({ varKey, value, accent, showValue, onSave, onDelete }: VarRowProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [revealed, setRevealed] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  // When global reveal turns off, reset individual reveal too
  useEffect(() => {
    if (!showValue) setRevealed(false);
  }, [showValue]);

  const commit = () => {
    setEditing(false);
    if (draft !== value) onSave(draft);
  };

  const isVisible = showValue || revealed;
  const masked = draft ? '•'.repeat(Math.min(draft.length, 18)) : '';

  return (
    <div className="group grid grid-cols-[11rem_1fr_3rem] items-center px-4 border-b border-border-subtle last:border-0 hover:bg-bg-hover/30 transition-colors min-h-[38px]">
      {/* Key */}
      <div className="py-2.5 min-w-0">
        <code className={`text-xs font-mono px-1.5 py-0.5 rounded inline-block max-w-full truncate ${
          accent === 'accent' ? 'text-accent bg-accent/8' : 'text-text-secondary bg-bg-tertiary'
        }`}>
          {varKey}
        </code>
      </div>

      {/* Value */}
      <div
        className="py-2 min-w-0 cursor-text pr-1"
        onClick={() => { setEditing(true); setTimeout(() => inputRef.current?.focus(), 0); }}
      >
        {editing ? (
          <input
            ref={inputRef}
            className="w-full bg-bg-input border border-border-active rounded-md px-2 py-1 text-xs text-text-primary outline-none font-mono"
            value={draft}
            onChange={e => setDraft(e.target.value)}
            onBlur={commit}
            onKeyDown={e => {
              if (e.key === 'Enter') inputRef.current?.blur();
              if (e.key === 'Escape') { setDraft(value); setEditing(false); }
            }}
            autoFocus
          />
        ) : (
          <span className={`text-xs block truncate font-mono ${draft ? 'text-text-primary' : 'text-text-tertiary italic'}`}>
            {draft ? (isVisible ? draft : masked) : '(empty)'}
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center justify-end gap-0.5 py-2 opacity-0 group-hover:opacity-100 transition-opacity">
        {draft && !editing && (
          <button
            onClick={e => { e.stopPropagation(); setRevealed(r => !r); }}
            className={`p-1 rounded transition-colors ${
              revealed && !showValue ? 'text-accent' : 'text-text-tertiary hover:text-text-secondary'
            }`}
            title={isVisible ? 'Hide value' : 'Reveal value'}
          >
            {isVisible ? <EyeOff size={11} /> : <Eye size={11} />}
          </button>
        )}
        <button
          onClick={onDelete}
          className="p-1 rounded text-text-tertiary hover:text-danger transition-colors"
        >
          <Trash2 size={11} />
        </button>
      </div>
    </div>
  );
}
