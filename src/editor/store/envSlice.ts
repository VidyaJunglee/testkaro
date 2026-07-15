import { StateCreator } from 'zustand';
import { Environment } from '../../schema';

export interface EnvSlice {
  // Local (per-app) environments
  environments: Environment[];
  activeEnvironmentId: string | null;

  // Global (shared across apps) environments
  globalEnvironments: Environment[];
  activeGlobalEnvironmentId: string | null;

  // Local env CRUD
  addEnvironment: (name: string, id?: string) => void;
  deleteEnvironment: (id: string) => void;
  renameEnvironment: (id: string, name: string) => void;
  setActiveEnvironment: (id: string | null) => void;
  setEnvVariable: (envId: string, key: string, value: string) => void;
  deleteEnvVariable: (envId: string, key: string) => void;
  setEnvironments: (envs: Environment[]) => void;
  renameEnvLocal: (id: string, name: string) => void;

  // Global env CRUD
  setGlobalEnvironments: (envs: Environment[]) => void;
  setActiveGlobalEnvironment: (id: string | null) => void;
  addGlobalEnvironment: (name: string) => Environment;
  deleteGlobalEnvironment: (id: string) => void;
  renameGlobalEnvironment: (id: string, name: string) => void;
  setGlobalEnvVariable: (envId: string, key: string, value: string) => void;
  deleteGlobalEnvVariable: (envId: string, key: string) => void;

  // Utilities
  resolveVariables: (input: string) => string;
  getActiveVariables: () => Record<string, string>;
}

export const createEnvSlice: StateCreator<EnvSlice, [], [], EnvSlice> = (set, get) => ({
  environments: [],
  activeEnvironmentId: null,
  globalEnvironments: [],
  activeGlobalEnvironmentId: null,

  // ── Local env actions ──────────────────────────────────────────────────────

  addEnvironment: (name, id) => set(state => {
    const env: Environment = { id: id ?? crypto.randomUUID(), name, variables: {} };
    const environments = [...state.environments, env];
    return { environments, activeEnvironmentId: state.activeEnvironmentId || env.id };
  }),

  deleteEnvironment: (id) => set(state => {
    const environments = state.environments.filter(e => e.id !== id);
    const activeEnvironmentId = state.activeEnvironmentId === id
      ? (environments[0]?.id || null) : state.activeEnvironmentId;
    return { environments, activeEnvironmentId };
  }),

  renameEnvironment: (id, name) => set(state => ({
    environments: state.environments.map(e => e.id === id ? { ...e, name } : e),
  })),

  renameEnvLocal: (id, name) => set(state => ({
    environments: state.environments.map(e => e.id === id ? { ...e, name } : e),
  })),

  setActiveEnvironment: (id) => set({ activeEnvironmentId: id }),

  setEnvVariable: (envId, key, value) => set(state => ({
    environments: state.environments.map(e =>
      e.id === envId ? { ...e, variables: { ...e.variables, [key]: value } } : e
    ),
  })),

  deleteEnvVariable: (envId, key) => set(state => ({
    environments: state.environments.map(e => {
      if (e.id !== envId) return e;
      const { [key]: _, ...rest } = e.variables;
      return { ...e, variables: rest };
    }),
  })),

  setEnvironments: (envs) => set({ environments: envs }),

  // ── Global env actions ─────────────────────────────────────────────────────

  setGlobalEnvironments: (envs) => set({ globalEnvironments: envs }),

  setActiveGlobalEnvironment: (id) => set({ activeGlobalEnvironmentId: id }),

  addGlobalEnvironment: (name) => {
    const env: Environment = { id: crypto.randomUUID(), name, variables: {} };
    set(state => ({
      globalEnvironments: [...state.globalEnvironments, env],
      activeGlobalEnvironmentId: state.activeGlobalEnvironmentId || env.id,
    }));
    return env;
  },

  deleteGlobalEnvironment: (id) => set(state => {
    const globalEnvironments = state.globalEnvironments.filter(e => e.id !== id);
    const activeGlobalEnvironmentId = state.activeGlobalEnvironmentId === id
      ? (globalEnvironments[0]?.id || null) : state.activeGlobalEnvironmentId;
    return { globalEnvironments, activeGlobalEnvironmentId };
  }),

  renameGlobalEnvironment: (id, name) => set(state => ({
    globalEnvironments: state.globalEnvironments.map(e => e.id === id ? { ...e, name } : e),
  })),

  setGlobalEnvVariable: (envId, key, value) => set(state => ({
    globalEnvironments: state.globalEnvironments.map(e =>
      e.id === envId ? { ...e, variables: { ...e.variables, [key]: value } } : e
    ),
  })),

  deleteGlobalEnvVariable: (envId, key) => set(state => ({
    globalEnvironments: state.globalEnvironments.map(e => {
      if (e.id !== envId) return e;
      const { [key]: _, ...rest } = e.variables;
      return { ...e, variables: rest };
    }),
  })),

  // ── Utilities ──────────────────────────────────────────────────────────────

  resolveVariables: (input: string) => {
    const state = get();
    const globalEnv = state.globalEnvironments.find(e => e.id === state.activeGlobalEnvironmentId);
    const localEnv = state.environments.find(e => e.id === state.activeEnvironmentId);
    // Merge: local wins over global on conflict
    const merged = { ...(globalEnv?.variables || {}), ...(localEnv?.variables || {}) };
    return input.replace(/\{\{(\w+)\}\}/g, (match, varName) =>
      varName in merged ? String(merged[varName]) : match
    );
  },

  getActiveVariables: () => {
    const state = get();
    const globalEnv = state.globalEnvironments.find(e => e.id === state.activeGlobalEnvironmentId);
    const localEnv = state.environments.find(e => e.id === state.activeEnvironmentId);
    return { ...(globalEnv?.variables || {}), ...(localEnv?.variables || {}) };
  },
});
