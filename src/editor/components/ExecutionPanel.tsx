import React, { useRef, useCallback, useEffect } from 'react';
import { ExecutionTimeline } from './ExecutionTimeline';
import { saveRun, getRunHistory, StoredRun } from '../storage/db';
import {
  useStore,
  useSteps,
  useRunState, useResults, useRunHistory, usePaused,
  useHeaded, useErrorMsg, useHighlightedStepId,
} from '../store';
import { StepResult } from '../store/executionSlice';
import { Play, Square, Monitor, MonitorOff, Clock } from 'lucide-react';

export function ExecutionPanel() {
  const steps = useSteps();
  const runState = useRunState();
  const results = useResults();
  const runHistory = useRunHistory();
  const paused = usePaused();
  const headed = useHeaded();
  const errorMsg = useErrorMsg();
  const highlightedStepId = useHighlightedStepId();
  const recordVideo = useStore(s => s.recordVideo);

  const store = useStore;
  const wsRef = useRef<WebSocket | null>(null);

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
    if (steps.length === 0) return;
    const s = store.getState();

    s.setRunState('connecting');
    s.resetRun();

    const ws = new WebSocket('ws://localhost:3001/ws');
    wsRef.current = ws;

    ws.onopen = () => {
      const s = store.getState();
      s.setRunState('running');
      ws.send(JSON.stringify({
        type: 'run',
        steps,
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
        case 'step-start':
          s.setHighlightedStepId(msg.data.stepId);
          if (s.breakpoints.has(msg.data.stepId)) {
            s.setPaused(true);
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'pause' }));
            }
          }
          break;
        case 'step-end':
          s.addResult(msg.data);
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
      s.setErrorMsg('Cannot connect to TestFlow server. Make sure it\'s running on localhost:3001');
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
          <button
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-medium bg-accent hover:bg-accent-hover text-white transition-all disabled:opacity-50"
            onClick={connectAndRun}
            disabled={steps.length === 0}
          >
            <Play size={12} />
            Run
          </button>
        )}
      </div>

      {/* Status bar */}
      {runState !== 'idle' && (
        <div className="flex items-center gap-3 px-3 py-2 bg-bg-tertiary border-b border-border text-xs shrink-0">
          {runState === 'connecting' && <span className="text-text-tertiary">Connecting...</span>}
          {runState === 'running' && !paused && (
            <span className="text-accent font-medium flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-accent rounded-full animate-pulse" />
              Running ({results.length}/{steps.length})
            </span>
          )}
          {runState === 'running' && paused && (
            <span className="text-warning font-medium">Paused ({results.length}/{steps.length})</span>
          )}
          {runState === 'done' && (
            <>
              <span className={`font-medium ${failedCount > 0 ? 'text-danger' : 'text-success'}`}>
                {failedCount > 0 ? 'Failed' : 'Passed'}
              </span>
              <span className="text-text-tertiary">{passedCount}/{results.length} passed</span>
              <span className="text-text-tertiary">{(totalDuration / 1000).toFixed(1)}s</span>
            </>
          )}
          {errorMsg && <span className="text-danger ml-2 truncate">{errorMsg}</span>}
        </div>
      )}

      {/* Main content: Timeline */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <ExecutionTimeline results={results} totalSteps={steps.length} highlightedStepId={highlightedStepId} />
      </div>

      {/* Run History (compact footer) */}
      {runHistory.length > 0 && (
        <div className="border-t border-border bg-bg-secondary shrink-0">
          <div className="px-3 py-1.5 flex items-center gap-2">
            <Clock size={11} className="text-text-tertiary" />
            <span className="text-[10px] uppercase tracking-wider text-text-tertiary font-semibold">History</span>
          </div>
          <div className="max-h-32 overflow-y-auto px-2 pb-2 space-y-0.5">
            {runHistory.slice(0, 10).map(run => (
              <div key={run.id} className="flex items-center gap-2 px-2 py-1.5 rounded bg-bg-card text-xs">
                <span className={`w-2 h-2 rounded-full shrink-0 ${run.failed > 0 ? 'bg-danger' : 'bg-success'}`} />
                <span className="text-text-primary font-medium">
                  {run.passed}/{run.total} passed
                </span>
                <span className="text-text-tertiary">{(run.duration / 1000).toFixed(1)}s</span>
                <span className="ml-auto text-text-tertiary text-[10px]">
                  {new Date(run.timestamp).toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
