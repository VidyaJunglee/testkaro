import React, { useRef, useCallback, useEffect, useState } from 'react';
import { TestStep } from '../../schema';
import { RunnerView } from './RunnerView';
import { saveRun, getRunHistory, StoredRun } from '../storage/db';
import { BLOCKS } from '../blocks';
import { toast } from '../store/toast';
import { useStore, useSteps, useRunState, useResults, useRunHistory } from '../store';

const BLOCKS_BY_TYPE = new Map(BLOCKS.map(b => [b.type, b]));

// Walks steps (and nested children) checking required params against the
// block registry. Returns a human-readable message for the first violation
// found, or null if every step passes.
function findMissingRequiredParam(steps: TestStep[]): string | null {
  for (const step of steps) {
    const block = BLOCKS_BY_TYPE.get(step.type);
    if (block) {
      for (const input of block.inputs) {
        if (!input.required) continue;
        const value = step.params?.[input.name];
        if (value === undefined || value === null || String(value).trim() === '') {
          return `"${block.label}" step is missing required field "${input.label}"`;
        }
      }
    }
    if (step.children && step.children.length > 0) {
      const nested = findMissingRequiredParam(step.children);
      if (nested) return nested;
    }
  }
  return null;
}

// Deep-resolve {{varName}} references in all string values of step params
function resolveStepsVariables(steps: TestStep[], resolve: (input: string) => string): TestStep[] {
  const resolveValue = (val: unknown): unknown => {
    if (typeof val === 'string') return resolve(val);
    if (Array.isArray(val)) return val.map(resolveValue);
    if (val && typeof val === 'object') {
      const out: Record<string, unknown> = {};
      for (const [k, v] of Object.entries(val)) out[k] = resolveValue(v);
      return out;
    }
    return val;
  };
  return steps.map(step => ({
    ...step,
    params: step.params ? resolveValue(step.params) as Record<string, unknown> : step.params,
    children: step.children ? resolveStepsVariables(step.children, resolve) : step.children,
  }));
}

export function ExecutionPanel() {
  const steps = useSteps();
  const runState = useRunState();
  const results = useResults();
  const store = useStore;
  const wsRef = useRef<WebSocket | null>(null);
  const stepStartTimes = useRef<Record<string, number>>({});
  const [panelExpanded, setPanelExpanded] = useState(false);

  // Close popup on Escape
  useEffect(() => {
    if (!panelExpanded) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setPanelExpanded(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [panelExpanded]);

  // Cleanup WebSocket on unmount
  useEffect(() => {
    return () => { wsRef.current?.close(); };
  }, []);

  // Clear execution state when the active test changes
  const activeTestIndex = useStore(s => s.activeTestIndex);
  useEffect(() => {
    const s = store.getState();
    if (s.runState !== 'running' && s.runState !== 'connecting') {
      s.resetRun();
    }
  }, [activeTestIndex]);

  // Load run history on mount and after each completed run
  useEffect(() => {
    getRunHistory(20).then(h => store.getState().setRunHistory(h)).catch(() => {});
  }, []);

  useEffect(() => {
    if (runState === 'done') {
      getRunHistory(20).then(h => store.getState().setRunHistory(h)).catch(() => {});
    }
  }, [runState]);

  // Save run to history when done
  useEffect(() => {
    if (runState === 'done' && results.length > 0) {
      const s = store.getState();
      // Failure screenshots are large base64 PNGs — drop them from the persisted
      // history (the error message survives) to keep IndexedDB lean. The live
      // panel still shows them for the current run via in-memory `results`.
      const resultsForHistory = results.map(({ screenshot, ...rest }) => rest);
      const run: StoredRun = {
        id: crypto.randomUUID(),
        fileId: s.fileId,
        testName: s.file.tests[s.activeTestIndex]?.name || '',
        timestamp: Date.now(),
        duration: results.reduce((sum, r) => sum + r.duration, 0),
        passed: results.filter(r => r.status === 'passed').length,
        failed: results.filter(r => r.status === 'failed').length,
        skipped: results.filter(r => r.status === 'skipped').length,
        total: results.length,
        results: resultsForHistory,
        screenshots: s.screenshots.slice(-10),
      };
      saveRun(run).catch(() => {
        toast.error('Failed to save run to history');
      });
    }
  }, [runState]);

  const safeSend = useCallback((data: unknown) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
    }
  }, []);

  const connectAndRun = useCallback(() => {
    const s = store.getState();
    const mode = s.runMode;

    if (s.jsonInvalid) {
      s.setErrorMsg('Fix the invalid JSON in the editor before running');
      s.setRunState('done');
      return;
    }

    let stepsToRun: typeof steps;
    const stepToTestIndex: Record<string, number> = {};
    const stepToModuleIndex: Record<string, number> = {};
    const stepToModuleName: Record<string, string> = {};

    if (mode === 'all-modules' && s.file.engine === 'mobile') {
      toast.info('"Run all modules" is not supported for mobile modules yet — run this module on its own');
      return;
    }

    if (mode === 'all-modules') {
      const allModules = s.modules || [];
      if (allModules.length === 0) {
        toast.info('No modules to run');
        return;
      }
      let globalTestIdx = 0;
      const totalTests = allModules.reduce((sum, m) => sum + (m.tests?.length || 0), 0);
      stepsToRun = allModules.flatMap((mod, mi) =>
        (mod.tests || []).flatMap((test, _ti) => {
          const currentGlobalIdx = globalTestIdx++;
          return (test.steps || []).map(step => {
            stepToTestIndex[step.id] = currentGlobalIdx;
            stepToModuleIndex[step.id] = mi;
            stepToModuleName[step.id] = mod.name;
            return step;
          });
        })
      );
      if (stepsToRun.length === 0) {
        toast.info('No steps to run — every test across all modules is empty');
        return;
      }
      const firstMod = allModules[0];
      s.setRunAllProgress({
        currentTestIndex: 0,
        totalTests,
        currentTestName: firstMod.tests?.[0]?.name || 'Test 1',
        currentModuleIndex: 0,
        totalModules: allModules.length,
        currentModuleName: firstMod.name,
      });
    } else if (mode === 'all' || mode === 'module') {
      stepsToRun = s.file.tests.flatMap(t => t.steps);
      if (stepsToRun.length === 0) {
        toast.info('No steps to run — every test in this module is empty');
        return;
      }
      s.file.tests.forEach((test, ti) => {
        test.steps.forEach(step => { stepToTestIndex[step.id] = ti; });
      });
      s.setRunAllProgress({
        currentTestIndex: 0,
        totalTests: s.file.tests.length,
        currentTestName: s.file.tests[0]?.name || 'Test 1',
      });
    } else {
      stepsToRun = (s.file.tests[s.activeTestIndex] || s.file.tests[0]).steps;
      if (stepsToRun.length === 0) {
        toast.info('No steps to run — add a step first');
        return;
      }
      s.setRunAllProgress(null);
    }

    const missingParamError = findMissingRequiredParam(stepsToRun);
    if (missingParamError) {
      s.resetRun();
      s.setErrorMsg(missingParamError);
      s.setRunState('done');
      return;
    }

    if (s.file.engine === 'mobile' && !s.file.mobileConfig?.deviceId) {
      s.resetRun();
      s.setErrorMsg('Select a target device in the run bar before running a mobile test');
      s.setRunState('done');
      return;
    }

    s.setRunState('connecting');
    s.resetRun();
    stepStartTimes.current = {};

    const ws = new WebSocket('ws://localhost:3001/ws');
    wsRef.current = ws;

    ws.onopen = () => {
      const s = store.getState();
      s.setRunState('running');
      s.setBottomTab('timeline');

      const resolvedSteps = resolveStepsVariables(stepsToRun, s.resolveVariables);

      let execSettings: Record<string, unknown> = {};
      try { execSettings = JSON.parse(localStorage.getItem('testkaro-settings') || '{}'); } catch {}

      if (s.file.engine === 'mobile') {
        ws.send(JSON.stringify({
          type: 'run',
          engine: 'mobile',
          steps: resolvedSteps,
          mobileConfig: s.file.mobileConfig,
          breakpoints: Array.from(s.breakpoints),
          screenshotOnFailure: execSettings.screenshotOnFailure !== false,
        }));
        return;
      }

      ws.send(JSON.stringify({
        type: 'run',
        steps: resolvedSteps,
        headed: s.headed,
        browserType: s.browserType,
        recordVideo: s.recordVideo,
        breakpoints: Array.from(s.breakpoints),
        slowMo: Number(execSettings.interStepDelay ?? 120),
        screenshotOnFailure: execSettings.screenshotOnFailure !== false,
        videoDir: execSettings.videoDir as string || undefined,
      }));
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      const s = store.getState();

      switch (msg.type) {
        case 'step-start': {
          s.setHighlightedStepId(msg.data.stepId);
          stepStartTimes.current[msg.data.stepId] = Date.now();
          if ((mode === 'all' || mode === 'module' || mode === 'all-modules') && msg.data.stepId in stepToTestIndex) {
            const ti = stepToTestIndex[msg.data.stepId];
            const progress: any = {
              currentTestIndex: ti,
              totalTests: mode === 'all-modules'
                ? (s.modules || []).reduce((sum: number, m: any) => sum + (m.tests?.length || 0), 0)
                : s.file.tests.length,
              currentTestName: mode === 'all-modules'
                ? (stepToModuleName[msg.data.stepId] ? `${stepToModuleName[msg.data.stepId]} / Test ${ti + 1}` : `Test ${ti + 1}`)
                : (s.file.tests[ti]?.name || `Test ${ti + 1}`),
            };
            if (mode === 'all-modules') {
              progress.currentModuleIndex = stepToModuleIndex[msg.data.stepId];
              progress.totalModules = (s.modules || []).length;
              progress.currentModuleName = stepToModuleName[msg.data.stepId];
            }
            s.setRunAllProgress(progress);
          }
          if (s.breakpoints.has(msg.data.stepId)) {
            s.setPaused(true);
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'pause' }));
            }
          }
          break;
        }
        case 'step-end':
          s.addResult({
            ...msg.data,
            startedAt: stepStartTimes.current[msg.data.stepId] || Date.now() - (msg.data.duration || 0),
            testIndex: (mode === 'all' || mode === 'module' || mode === 'all-modules') ? stepToTestIndex[msg.data.stepId] : undefined,
            moduleIndex: mode === 'all-modules' ? stepToModuleIndex[msg.data.stepId] : undefined,
            moduleName: mode === 'all-modules' ? stepToModuleName[msg.data.stepId] : undefined,
          });
          break;
        case 'console':
          s.addConsoleEntry(msg.data);
          break;
        case 'network': {
          const existing = s.networkLog.find(n => n.id === msg.data.id);
          if (existing) s.updateNetworkEntry(msg.data);
          else s.addNetworkEntry(msg.data);
          break;
        }
        case 'variable':
          s.setVariable(msg.data.name, msg.data.value);
          break;
        case 'screenshot':
          s.addScreenshot({ label: msg.data.label, data: msg.data.screenshot });
          break;
        case 'done':
          s.setRunState('done');
          s.setHighlightedStepId(null);
          ws.close();
          break;
        case 'error':
          s.setErrorMsg(msg.data.message);
          s.setRunState('done');
          s.setHighlightedStepId(null);
          ws.close();
          break;
      }
    };

    ws.onerror = () => {
      const s = store.getState();
      s.setErrorMsg('Cannot connect to TestKaro server. Make sure it\'s running on localhost:3001');
      s.setRunState('done');
    };

    ws.onclose = () => {
      wsRef.current = null;
      const s = store.getState();
      if (s.runState === 'running' || s.runState === 'connecting') {
        s.setRunState('done');
        s.setPaused(false);
        s.setHighlightedStepId(null);
      }
    };
  }, [steps]);

  const stopRun = useCallback(() => {
    safeSend({ type: 'stop' });
    wsRef.current?.close();
    const s = store.getState();
    s.setRunState('done');
    s.setPaused(false);
    s.setHighlightedStepId(null);
  }, [safeSend]);

  const resumeRun = useCallback(() => {
    store.getState().setPaused(false);
    safeSend({ type: 'resume' });
  }, [safeSend]);

  const sharedProps = {
    onRun: connectAndRun,
    onStop: stopRun,
    onResume: resumeRun,
  };

  return (
    <>
      {/* ── Inline side panel ── */}
      <div className="flex flex-col h-full bg-bg-secondary border-l border-border glass-panel">
        <RunnerView {...sharedProps} onExpand={() => setPanelExpanded(true)} />
      </div>

      {/* ── Fullscreen popup ── */}
      {panelExpanded && (
        <div
          className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/60 backdrop-blur-sm p-6"
          onClick={e => { if (e.target === e.currentTarget) setPanelExpanded(false); }}
        >
          <div
            className="w-full h-full bg-bg-elevated border border-border rounded-2xl shadow-2xl overflow-hidden flex flex-col animate-glass-reveal"
            style={{ maxWidth: 1280, maxHeight: 900 }}
          >
            <RunnerView {...sharedProps} isPopup onClose={() => setPanelExpanded(false)} />
          </div>
        </div>
      )}
    </>
  );
}
