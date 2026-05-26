// ─── Core Schema ─────────────────────────────────────────────────────────────
// The .testflow.json format — the single source of truth

export interface TestFile {
  version: string;
  name: string;
  description?: string;
  baseUrl?: string;
  variables?: Record<string, unknown>;
  tests: TestCase[];
}

export interface TestCase {
  id: string;
  name: string;
  steps: TestStep[];
  disabled?: boolean;
  tags?: string[];
}

export interface TestStep {
  id: string;
  type: string;
  params: Record<string, unknown>;
  children?: TestStep[];
}

// ─── Block System ────────────────────────────────────────────────────────────

export interface BlockDefinition {
  type: string;
  category: BlockCategory;
  label: string;
  description?: string;
  color: string;
  inputs: BlockInput[];
  hasChildren?: boolean; // For container blocks (if, repeat, etc.)
  execute: (params: Record<string, unknown>, ctx: ExecutionContext) => Promise<StepResult>;
}

export type BlockCategory = 'navigation' | 'interaction' | 'assertion' | 'api' | 'logic' | 'data';

export interface BlockInput {
  name: string;
  label: string;
  type: 'text' | 'number' | 'dropdown' | 'checkbox' | 'code';
  required?: boolean;
  default?: unknown;
  placeholder?: string;
  options?: Array<{ label: string; value: string }>; // For dropdowns
}

// ─── Execution ───────────────────────────────────────────────────────────────

export interface ExecutionContext {
  variables: Map<string, unknown>;
  page: unknown;       // Playwright Page
  browser: unknown;    // Playwright Browser
  baseUrl?: string;
  log: (msg: string) => void;
}

export interface StepResult {
  stepId: string;
  type: string;
  status: 'passed' | 'failed' | 'skipped';
  duration: number;
  error?: string;
  output?: unknown;
}

export interface TestResult {
  testId: string;
  testName: string;
  status: 'passed' | 'failed' | 'skipped';
  duration: number;
  steps: StepResult[];
  error?: string;
}

export interface RunResult {
  file: string;
  results: TestResult[];
  summary: { total: number; passed: number; failed: number; skipped: number; duration: number };
}
