import React, { useRef, useCallback, useEffect } from 'react';
import { TestStep } from '../../schema';
import { ExecutionTimeline } from './ExecutionTimeline';
import { NetworkPanel } from './NetworkPanel';
import { ConsolePanel } from './ConsolePanel';
import { ScreenshotPanel } from './ScreenshotPanel';
import { VariablesPanel } from './VariablesPanel';
import { RunDropdown } from './RunDropdown';
import { saveRun, getRunHistory, StoredRun } from '../storage/db';
import {
  useStore,
  useSteps,
  useRunState, useResults, useRunHistory, usePaused,
  useHeaded, useErrorMsg, useHighlightedStepId,
  useRunMode, useRunAllProgress,
} from '../store';
import { StepResult } from '../store/executionSlice';
import { BottomTab } from '../store/uiSlice';
import { NetworkEntry, ConsoleEntry } from '../engine';
import {
  Play, Square, Monitor, MonitorOff, Clock,
  Activity, Globe, Terminal, Camera, Braces,
} from 'lucide-react';

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

const TABS: { id: BottomTab; label: string; icon: React.ReactNode }[] = [
  { id: 'timeline', label: 'Timeline', icon: <Activity size={12} /> },
  { id: 'network', label: 'Network', icon: <Globe size={12} /> },
  { id: 'console', label: 'Console', icon: <Terminal size={12} /> },
  { id: 'screenshots', label: 'Shots', icon: <Camera size={12} /> },
  { id: 'variables', label: 'Vars', icon: <Braces size={12} /> },
];

export function ExecutionPanel() {
  const steps = useSteps();
  const runState = useRunState();
  const results = useResults();
  const runHistory = useRunHistory();
  const paused = usePaused();
  const headed = useHeaded();
  const errorMsg = useErrorMsg();
  const highlightedStepId = useHighlightedStepId();
  const runMode = useRunMode();
  const runAllProgress = useRunAllProgress();
  const recordVideo = useStore(s => s.recordVideo);
  const consoleLog = useStore(s => s.consoleLog);
  const networkLog = useStore(s => s.networkLog);
  const screenshots = useStore(s => s.screenshots);
  const variables = useStore(s => s.variables);
  const bottomTab = useStore(s => s.bottomTab);
  const setBottomTab = useStore(s => s.setBottomTab);

  const store = useStore;
  const wsRef = useRef<WebSocket | null>(null);
  const stepStartTimes = useRef<Record<string, number>>({});

  // Cleanup WebSocket on unmount
  useEffect(() => {
    return () => { wsRef.current?.close(); };
  }, []);

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
        results,
      };
      saveRun(run).catch(() => {});
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

    let stepsToRun: typeof steps;
    if (mode === 'all' || mode === 'module') {
      // 'module' mode currently behaves the same as 'all' (runs all tests in the file)
      // In the future, when modular projects are loaded, 'module' will run only the active module's tests
      stepsToRun = s.file.tests.flatMap(t => t.steps);
      if (stepsToRun.length === 0) return;
      s.setRunAllProgress({
        currentTestIndex: 0,
        totalTests: s.file.tests.length,
        currentTestName: s.file.tests[0]?.name || 'Test 1',
      });
    } else {
      stepsToRun = (s.file.tests[s.activeTestIndex] || s.file.tests[0]).steps;
      if (stepsToRun.length === 0) return;
      s.setRunAllProgress(null);
    }

    s.setRunState('connecting');
    s.resetRun();
    stepStartTimes.current = {};

    const stepToTestIndex: Record<string, number> = {};
    if (mode === 'all' || mode === 'module') {
      s.file.tests.forEach((test, ti) => {
        test.steps.forEach(step => { stepToTestIndex[step.id] = ti; });
      });
    }

    const ws = new WebSocket('ws://localhost:3001/ws');
    wsRef.current = ws;

    ws.onopen = () => {
      const s = store.getState();
      s.setRunState('running');
      // Switch to timeline tab when run starts
      s.setBottomTab('timeline');

      // Resolve environment variables in step params before sending
      const resolvedSteps = resolveStepsVariables(stepsToRun, s.resolveVariables);

      ws.send(JSON.stringify({
        type: 'run',
        steps: resolvedSteps,
        headed: s.headed,
        recordVideo: s.recordVideo,
        breakpoints: Array.from(s.breakpoints),
        slowMo: 50,
      }));
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);
      const s = store.getState();

      switch (msg.type) {
        case 'step-start': {
          s.setHighlightedStepId(msg.data.stepId);
          stepStartTimes.current[msg.data.stepId] = Date.now();
          if ((mode === 'all' || mode === 'module') && msg.data.stepId in stepToTestIndex) {
            const ti = stepToTestIndex[msg.data.stepId];
            s.setRunAllProgress({
              currentTestIndex: ti,
              totalTests: s.file.tests.length,
              currentTestName: s.file.tests[ti]?.name || `Test ${ti + 1}`,
            });
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
            testIndex: (mode === 'all' || mode === 'module') ? stepToTestIndex[msg.data.stepId] : undefined,
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

  const passedCount = results.filter(r => r.status === 'passed').length;
  const failedCount = results.filter(r => r.status === 'failed').length;
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);
  const allTests = useStore(s => s.file.tests);
  const totalStepsForRun = runMode === 'all'
    ? allTests.reduce((sum, t) => sum + t.steps.length, 0)
    : steps.length;

  // Badge counts for tabs
  const networkCount = networkLog.filter(n => n.phase === 'response' || n.phase === 'error').length;
  const consoleCount = consoleLog.length;
  const screenshotCount = screenshots.length;
  const variableCount = Object.keys(variables).length;

  const getBadge = (tabId: BottomTab): number | null => {
    switch (tabId) {
      case 'network': return networkCount || null;
      case 'console': return consoleCount || null;
      case 'screenshots': return screenshotCount || null;
      case 'variables': return variableCount || null;
      default: return null;
    }
  };

  return (
    <div className="flex flex-col h-full bg-bg-primary border-l border-border">
      {/* Controls */}
      <div className="flex items-center gap-2 px-3 py-2.5 bg-bg-secondary border-b border-border shrink-0">
        <button
          className={`p-1.5 rounded transition-all ${headed ? 'bg-accent/10 text-accent' : 'text-text-tertiary hover:text-text-secondary'}`}
          onClick={() => store.getState().setHeaded(!headed)}
          title={headed ? 'Headed mode' : 'Headless mode'}
        >
          {headed ? <Monitor size={15} /> : <MonitorOff size={15} />}
        </button>

        <div className="flex-1" />

        {runState === 'running' || runState === 'connecting' ? (
          <div className="flex items-center gap-1.5">
            {paused && (
              <button
                className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium bg-success hover:bg-success/80 text-white transition-all"
                onClick={resumeRun}
              >
                <Play size={12} />
                Continue
              </button>
            )}
            <button
              className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium bg-danger hover:bg-danger/80 text-white transition-all"
              onClick={stopRun}
            >
              <Square size={12} />
              Stop
            </button>
          </div>
        ) : (
          <RunDropdown onRun={connectAndRun} disabled={totalStepsForRun === 0} />
        )}
      </div>

      {/* Status bar */}
      {runState !== 'idle' && (
        <div className="flex items-center gap-3 px-3 py-2 bg-bg-tertiary border-b border-border text-xs shrink-0">
          {runState === 'connecting' && <span className="text-text-tertiary">Connecting...</span>}
          {runState === 'running' && !paused && (
            <span className="text-accent font-medium flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-accent rounded-full animate-pulse" />
              {runAllProgress ? (
                <>Test {runAllProgress.currentTestIndex + 1}/{runAllProgress.totalTests}: {runAllProgress.currentTestName} ({results.length}/{totalStepsForRun})</>
              ) : (
                <>Running ({results.length}/{totalStepsForRun})</>
              )}
            </span>
          )}
          {runState === 'running' && paused && (
            <span className="text-warning font-medium">Paused ({results.length}/{totalStepsForRun})</span>
          )}
          {runState === 'done' && (
            <>
              <span className={`font-medium ${failedCount > 0 ? 'text-danger' : 'text-success'}`}>
                {failedCount > 0 ? 'Failed' : 'Passed'}
              </span>
              <span className="text-text-tertiary">{passedCount}/{results.length} passed</span>
              {runAllProgress && (
                <span className="text-text-tertiary">{runAllProgress.totalTests} tests</span>
              )}
              <span className="text-text-tertiary">{(totalDuration / 1000).toFixed(1)}s</span>
            </>
          )}
          {errorMsg && <span className="text-danger ml-2 truncate">{errorMsg}</span>}
        </div>
      )}

      {/* Tab bar */}
      <div className="flex items-center border-b border-border bg-bg-secondary shrink-0">
        {TABS.map(tab => {
          const badge = getBadge(tab.id);
          const isActive = bottomTab === tab.id;
          return (
            <button
              key={tab.id}
              className={`flex items-center gap-1 px-3 py-2 text-xs font-medium border-b-2 transition-colors ${
                isActive
                  ? 'border-accent text-accent'
                  : 'border-transparent text-text-tertiary hover:text-text-secondary hover:bg-bg-hover'
              }`}
              onClick={() => setBottomTab(tab.id)}
            >
              {tab.icon}
              <span>{tab.label}</span>
              {badge != null && badge > 0 && (
                <span className={`ml-1 px-1.5 py-0.5 rounded-full text-[9px] font-bold leading-none ${
                  isActive ? 'bg-accent/20 text-accent' : 'bg-bg-tertiary text-text-tertiary'
                }`}>
                  {badge > 99 ? '99+' : badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Tab content */}
      <div className="flex-1 min-h-0 overflow-hidden">
        {bottomTab === 'timeline' && (
          <div className="h-full overflow-y-auto">
            <ExecutionTimeline
              results={results}
              totalSteps={totalStepsForRun}
              highlightedStepId={highlightedStepId}
              consoleLog={consoleLog}
              networkLog={networkLog}
            />
          </div>
        )}
        {bottomTab === 'network' && <NetworkPanel networkLog={networkLog} />}
        {bottomTab === 'console' && <ConsolePanel consoleLog={consoleLog} />}
        {bottomTab === 'screenshots' && <ScreenshotPanel screenshots={screenshots} />}
        {bottomTab === 'variables' && <VariablesPanel variables={variables} />}
      </div>

      {/* Run History (compact collapsible footer) */}
      {runHistory.length > 0 && bottomTab === 'timeline' && (
        <div className="border-t border-border bg-bg-secondary shrink-0">
          <div className="px-3 py-1.5 flex items-center gap-2">
            <Clock size={11} className="text-text-tertiary" />
            <span className="text-[10px] uppercase tracking-wider text-text-tertiary font-semibold">History</span>
          </div>
          <div className="max-h-28 overflow-y-auto px-2 pb-2 space-y-0.5">
            {runHistory.slice(0, 5).map(run => (
              <div key={run.id} className="flex items-center gap-2 px-2 py-1.5 rounded bg-bg-card text-xs">
                <span className={`w-2 h-2 rounded-full shrink-0 ${run.failed > 0 ? 'bg-danger' : 'bg-success'}`} />
                <span className="text-text-primary font-medium">
                  {run.passed}/{run.total}
                </span>
                <span className="text-text-tertiary">{(run.duration / 1000).toFixed(1)}s</span>
                <span className="ml-auto text-text-tertiary text-[10px]">
                  {new Date(run.timestamp).toLocaleTimeString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
