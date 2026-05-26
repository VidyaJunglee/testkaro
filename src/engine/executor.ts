import { TestFile, TestCase, TestStep, TestResult, StepResult, RunResult, ExecutionContext } from '../schema';
import { getBlock, registerAllBlocks } from '../blocks';

// ─── Variable Resolution ─────────────────────────────────────────────────────

function resolveVariables(value: unknown, variables: Map<string, unknown>): unknown {
  if (typeof value !== 'string') return value;
  return value.replace(/\$\{([^}]+)\}/g, (_, key) => {
    const val = variables.get(key.trim());
    return val !== undefined ? String(val) : `\${${key}}`;
  });
}

function resolveParams(params: Record<string, unknown>, variables: Map<string, unknown>): Record<string, unknown> {
  const resolved: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(params)) {
    resolved[key] = resolveVariables(value, variables);
  }
  return resolved;
}

// ─── Executor ────────────────────────────────────────────────────────────────

export interface ExecutorOptions {
  headless?: boolean;
  baseUrl?: string;
  timeout?: number;
  variables?: Record<string, unknown>;
  onStepStart?: (step: TestStep) => void;
  onStepEnd?: (step: TestStep, result: StepResult) => void;
}

export async function executeTestFile(file: TestFile, options: ExecutorOptions = {}): Promise<RunResult> {
  registerAllBlocks();

  // Launch browser
  const { chromium } = await import('playwright');
  const browser = await chromium.launch({ headless: options.headless ?? true });
  const context = await browser.newContext();
  const page = await context.newPage();

  const variables = new Map<string, unknown>(Object.entries({ ...file.variables, ...options.variables }));

  const ctx: ExecutionContext = {
    variables,
    page,
    browser,
    baseUrl: options.baseUrl || file.baseUrl,
    log: (msg) => console.log(`[testflow] ${msg}`),
  };

  const results: TestResult[] = [];

  for (const test of file.tests) {
    if (test.disabled) {
      results.push({ testId: test.id, testName: test.name, status: 'skipped', duration: 0, steps: [] });
      continue;
    }
    const result = await executeTest(test, ctx, options);
    results.push(result);
  }

  await browser.close();

  const duration = results.reduce((sum, r) => sum + r.duration, 0);
  return {
    file: file.name,
    results,
    summary: {
      total: results.length,
      passed: results.filter(r => r.status === 'passed').length,
      failed: results.filter(r => r.status === 'failed').length,
      skipped: results.filter(r => r.status === 'skipped').length,
      duration,
    },
  };
}

async function executeTest(test: TestCase, ctx: ExecutionContext, options: ExecutorOptions): Promise<TestResult> {
  const start = Date.now();
  const stepResults: StepResult[] = [];
  let failed = false;

  for (const step of test.steps) {
    const result = await executeStep(step, ctx, options);
    stepResults.push(result);
    if (result.status === 'failed') {
      failed = true;
      break;
    }
  }

  return {
    testId: test.id,
    testName: test.name,
    status: failed ? 'failed' : 'passed',
    duration: Date.now() - start,
    steps: stepResults,
    error: failed ? stepResults.find(s => s.status === 'failed')?.error : undefined,
  };
}

async function executeStep(step: TestStep, ctx: ExecutionContext, options: ExecutorOptions): Promise<StepResult> {
  options.onStepStart?.(step);

  const block = getBlock(step.type);
  if (!block) {
    const result: StepResult = { stepId: step.id, type: step.type, status: 'failed', duration: 0, error: `Unknown block type: ${step.type}` };
    options.onStepEnd?.(step, result);
    return result;
  }

  const resolvedParams = resolveParams(step.params, ctx.variables);

  try {
    const result = await block.execute(resolvedParams, ctx);
    result.stepId = step.id;

    // Handle container blocks (if, repeat)
    if (block.hasChildren && step.children?.length) {
      if (step.type === 'if' && result.output === true) {
        for (const child of step.children) {
          const childResult = await executeStep(child, ctx, options);
          if (childResult.status === 'failed') {
            options.onStepEnd?.(step, childResult);
            return childResult;
          }
        }
      } else if (step.type === 'repeat') {
        const times = Number(result.output) || 1;
        for (let i = 0; i < times; i++) {
          ctx.variables.set('_index', i);
          for (const child of step.children) {
            const childResult = await executeStep(child, ctx, options);
            if (childResult.status === 'failed') {
              options.onStepEnd?.(step, childResult);
              return childResult;
            }
          }
        }
      }
    }

    options.onStepEnd?.(step, result);
    return result;
  } catch (e: any) {
    const result: StepResult = { stepId: step.id, type: step.type, status: 'failed', duration: 0, error: e.message };
    options.onStepEnd?.(step, result);
    return result;
  }
}
