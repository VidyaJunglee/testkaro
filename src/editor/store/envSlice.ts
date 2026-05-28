import { StateCreator } from 'zustand';
import { Environment } from '../../schema';

// ─── Environment Slice ───────────────────────────────────────────────────────
// Manages named environments with key-value pairs.
// Variables are referenced in step inputs via {{variableName}} syntax.

export interface EnvSlice {
  environments: Environment[];
  activeEnvironmentId: string | null;

  // CRUD
  addEnvironment: (name: string) => void;
  deleteEnvironment: (id: string) => void;
  renameEnvironment: (id: string, name: string) => void;
  setActiveEnvironment: (id: string | null) => void;

  // Variable management
  setEnvVariable: (envId: string, key: string, value: string) => void;
  deleteEnvVariable: (envId: string, key: string) => void;
  setEnvironments: (envs: Environment[]) => void;

  // Utility
  /** Resolve all {{varName}} references in a string using active environment */
  resolveVariables: (input: string) => string;
  /** Get all variable names from active environment (for autocomplete) */
  getActiveVariables: () => Record<string, string>;
}

export const createEnvSlice: StateCreator<EnvSlice, [], [], EnvSlice> = (set, get) => ({
  environments: [],
  activeEnvironmentId: null,

  addEnvironment: (name) => set(state => {
    const env: Environment = {
      id: crypto.randomUUID(),
      name,
      variables: {},
    };
    const environments = [...state.environments, env];
    return {
      environments,
      activeEnvironmentId: state.activeEnvironmentId || env.id,
    };
  }),

  deleteEnvironment: (id) => set(state => {
    const environments = state.environments.filter(e => e.id !== id);
    const activeEnvironmentId = state.activeEnvironmentId === id
      ? (environments[0]?.id || null)
      : state.activeEnvironmentId;
    return { environments, activeEnvironmentId };
  }),

  renameEnvironment: (id, name) => set(state => ({
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

  resolveVariables: (input: string) => {
    const state = get();
    const env = state.environments.find(e => e.id === state.activeEnvironmentId);
    if (!env) return input;
    return input.replace(/\{\{(\w+)\}\}/g, (match, varName) => {
      return varName in env.variables ? env.variables[varName] : match;
    });
  },

  getActiveVariables: () => {
    const state = get();
    const env = state.environments.find(e => e.id === state.activeEnvironmentId);
    return env?.variables || {};
  },
});
