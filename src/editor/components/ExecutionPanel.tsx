import React, { useRef, useCallback, useEffect, useState, useMemo } from 'react';
import { ExecutionTimeline } from './ExecutionTimeline';
import { saveRun, getRunHistory, StoredRun } from '../storage/db';
import {
  useStore,
  useSteps,
  useRunState, useResults, useNetworkLog, useConsoleLog,
  useVariables, useScreenshots, useRunHistory, usePaused,
  useHeaded, useErrorMsg, useBottomTab, useHighlightedStepId,
} from '../store';
import { StepResult } from '../store/executionSlice';
import { Play, Square, Monitor, MonitorOff, Video, History, TrendingUp } from 'lucide-react';

export function ExecutionPanel() {
  const steps = useSteps();
  const runState = useRunState();
  const results = useResults();
  const networkLog = useNetworkLog();
  const consoleLog = useConsoleLog();
  const variables = useVariables();
  const screenshots = useScreenshots();
  const runHistory = useRunHistory();
  const paused = usePaused();
  const headed = useHeaded();
  const errorMsg = useErrorMsg();
  const bottomTab = useBottomTab();
  const highlightedStepId = useHighlightedStepId();
  const recordVideo = useStore(s => s.recordVideo);

  const store = useStore;
  const wsRef = useRef<WebSocket | null>(null);
  const consoleScrollRef = useRef<HTMLDivElement>(null);
  const [consoleFilter, setConsoleFilter] = useState<'all' | 'info' | 'warn' | 'error'>('all');

  const filteredConsole = useMemo(() => {
    if (consoleFilter === 'all') return consoleLog;
    return consoleLog.filter(c => c.level === consoleFilter);
  }, [consoleLog, consoleFilter]);

  // Auto-scroll console
  useEffect(() => {
    if (consoleScrollRef.current) {
      consoleScrollRef.current.scrollTop = consoleScrollRef.current.scrollHeight;
    }
  }, [consoleLog.length]);

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
        duration: results.reduce((s, r) => s + r.duration, 0),
        passed: results.filter(r => r.status === 'passed').length,
        failed: results.filter(r => r.status === 'failed').length,
        skipped: results.filter(r => r.status === 'skipped').length,
        total: results.length,
        results,
      };
      saveRun(run).catch(() => {});
    }
  }, [runState]);

  const connectAndRun = useCallback(() => {
    if (steps.length === 0) return;
    const s = store.getState();

    s.setRunState('connecting');
    s.resetRun();
    s.setBottomTab('results');

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

  const safeSend = useCallback((data: unknown) => {
    const ws = wsRef.current;
    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify(data));
    }
  }, []);

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
        {/* Headed toggle */}
        <button
          className={`p-2 rounded transition-all ${headed ? 'bg-accent/10 text-accent' : 'text-text-tertiary hover:text-text-secondary'}`}
          onClick={() => store.getState().setHeaded(!headed)}
          title={headed ? 'Headed mode (visible browser)' : 'Headless mode'}
        >
          {headed ? <Monitor size={16} /> : <MonitorOff size={16} />}
        </button>

        {/* Video toggle */}
        <button
          className={`p-2 rounded transition-all ${recordVideo ? 'bg-accent/10 text-accent' : 'text-text-tertiary hover:text-text-secondary'}`}
          onClick={() => store.getState().setRecordVideo(!recordVideo)}
          title={recordVideo ? 'Video recording ON' : 'Video recording OFF'}
        >
          <Video size={16} />
        </button>

        <div className="flex-1" />

        {/* Run / Stop / Continue */}
        {runState === 'running' || runState === 'connecting' ? (
          <div className="flex items-center gap-1.5">
            {paused && (
              <button
                className="flex items-center gap-2 px-4 py-2 rounded text-sm font-medium bg-success hover:bg-success/80 text-white transition-all"
                onClick={resumeRun}
              >
                <Play size={14} />
                Continue
              </button>
            )}
            <button
              className="flex items-center gap-2 px-4 py-2 rounded text-sm font-medium bg-danger hover:bg-danger/80 text-white transition-all"
              onClick={stopRun}
            >
              <Square size={14} />
              Stop
            </button>
          </div>
        ) : (
          <button
            className="flex items-center gap-2 px-4 py-2 rounded text-sm font-medium bg-accent hover:bg-accent-hover text-white transition-all disabled:opacity-50"
            onClick={connectAndRun}
            disabled={steps.length === 0}
          >
            <Play size={14} />
            Run
          </button>
        )}
      </div>

      {/* Status bar */}
      {runState !== 'idle' && (
        <div className="flex items-center gap-3 px-3 py-2 bg-bg-tertiary border-b border-border text-xs">
          {runState === 'connecting' && <span className="text-text-tertiary">Connecting to server...</span>}
          {runState === 'running' && !paused && (
            <span className="text-accent font-medium flex items-center gap-1.5">
              <span className="w-2 h-2 bg-accent rounded-full animate-pulse" />
              Running... ({results.length}/{steps.length} steps)
            </span>
          )}
          {runState === 'running' && paused && (
            <span className="text-warning font-medium flex items-center gap-1.5">
              <span className="w-2 h-2 bg-warning rounded-full" />
              Paused at breakpoint ({results.length}/{steps.length} steps)
            </span>
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
          {errorMsg && <span className="text-danger">{errorMsg}</span>}
        </div>
      )}

      {/* Execution progress (mini timeline) */}
      {results.length > 0 && (
        <div className="flex h-1.5 bg-bg-tertiary shrink-0">
          {results.map(r => (
            <div
              key={r.stepId}
              className={`flex-1 ${r.status === 'passed' ? 'bg-success' : r.status === 'failed' ? 'bg-danger' : 'bg-text-tertiary/30'}`}
              title={`${r.type} — ${r.status} (${r.duration}ms)`}
            />
          ))}
          {Array.from({ length: steps.length - results.length }).map((_, i) => (
            <div key={`pending-${i}`} className="flex-1 bg-border" />
          ))}
        </div>
      )}

      {/* Bottom Panel */}
      <div className="flex-1 flex flex-col min-h-0">
        {/* Tabs */}
        <div className="flex items-center gap-1 px-3 py-1.5 bg-bg-secondary border-b border-border shrink-0">
          {(['results', 'timeline', 'network', 'console', 'variables', 'screenshots', 'history'] as const).map(tab => {
            let count = 0;
            if (tab === 'results') count = results.length;
            else if (tab === 'timeline') count = results.length;
            else if (tab === 'network') count = networkLog.filter(n => n.phase !== 'request').length;
            else if (tab === 'console') count = consoleLog.length;
            else if (tab === 'variables') count = Object.keys(variables).length;
            else if (tab === 'screenshots') count = screenshots.length;
            else if (tab === 'history') count = runHistory.length;

            return (
              <button
                key={tab}
                className={`px-3 py-1.5 rounded text-xs font-medium capitalize transition-all ${
                  bottomTab === tab ? 'bg-bg-tertiary text-text-primary' : 'text-text-tertiary hover:text-text-secondary'
                }`}
                onClick={() => store.getState().setBottomTab(tab)}
              >
                {tab} {count > 0 && `(${count})`}
              </button>
            );
          })}
        </div>

        {/* Tab Content */}
        <div className="flex-1 overflow-y-auto p-2">
          {bottomTab === 'results' && (
            <div className="space-y-1">
              {results.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-text-tertiary">
                  <Play size={32} className="mb-3 opacity-30" />
                  <p className="text-sm">Click Run to execute test steps</p>
                  <p className="text-xs mt-1">A {headed ? 'visible' : 'headless'} browser will be launched</p>
                </div>
              )}
              {results.map((r, i) => (
                <div key={r.stepId} className="flex items-center gap-3 px-3 py-2 rounded bg-bg-card border border-border-subtle text-sm">
                  <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${
                    r.status === 'passed' ? 'bg-success' : r.status === 'failed' ? 'bg-danger' : 'bg-text-tertiary'
                  }`} />
                  <span className="text-text-tertiary w-6 text-xs">{i + 1}</span>
                  <span className="text-text-primary font-medium">{r.type}</span>
                  <span className="ml-auto text-text-tertiary text-xs">{r.duration}ms</span>
                </div>
              ))}
              {results.filter(r => r.error).map(r => (
                <div key={`err-${r.stepId}`} className="mt-2 p-3 bg-danger/5 border border-danger/20 rounded text-xs">
                  <p className="text-danger font-medium mb-1">Step "{r.type}" failed:</p>
                  <pre className="text-text-secondary whitespace-pre-wrap">{r.error}</pre>
                </div>
              ))}
            </div>
          )}

          {bottomTab === 'timeline' && (
            <ExecutionTimeline results={results} totalSteps={steps.length} highlightedStepId={highlightedStepId} />
          )}

          {bottomTab === 'network' && (
            <div className="space-y-0.5">
              {networkLog.filter(n => n.phase === 'response' || n.phase === 'error').length === 0 && (
                <p className="text-sm text-text-tertiary py-8 text-center">No network requests captured</p>
              )}
              {networkLog.filter(n => n.phase === 'response' || n.phase === 'error').map(n => (
                <div key={n.id} className="flex items-center gap-3 px-3 py-1.5 rounded bg-bg-card text-sm">
                  <span className={`font-mono text-xs font-medium px-1.5 py-0.5 rounded ${
                    n.method === 'GET' ? 'bg-accent/10 text-accent' :
                    n.method === 'POST' ? 'bg-success/10 text-success' :
                    n.method === 'PUT' ? 'bg-warning/10 text-warning' :
                    'bg-danger/10 text-danger'
                  }`}>{n.method}</span>
                  <span className={`w-10 text-xs font-medium ${
                    n.status && n.status < 400 ? 'text-success' : 'text-danger'
                  }`}>{n.status || 'ERR'}</span>
                  <span className="text-text-primary truncate flex-1 text-xs">{n.url}</span>
                </div>
              ))}
            </div>
          )}

          {bottomTab === 'console' && (
            <div className="flex flex-col h-full -m-2">
              {/* Console toolbar */}
              <div className="flex items-center gap-1 px-2 py-1 border-b border-border-subtle shrink-0">
                {(['all', 'info', 'warn', 'error'] as const).map(level => {
                  const count = level === 'all' ? consoleLog.length : consoleLog.filter(c => c.level === level).length;
                  return (
                    <button
                      key={level}
                      className={`px-2 py-0.5 rounded text-[10px] font-medium capitalize transition-all ${
                        consoleFilter === level ? 'bg-bg-tertiary text-text-primary' : 'text-text-tertiary hover:text-text-secondary'
                      }`}
                      onClick={() => setConsoleFilter(level)}
                    >
                      {level} {count > 0 && <span className="ml-0.5 opacity-60">({count})</span>}
                    </button>
                  );
                })}
                <div className="flex-1" />
                <button
                  className="px-2 py-0.5 rounded text-[10px] text-text-tertiary hover:text-danger transition-all"
                  onClick={() => { store.getState().resetRun(); }}
                  title="Clear console"
                >
                  Clear
                </button>
              </div>

              {/* Console output */}
              <div ref={consoleScrollRef} className="flex-1 overflow-y-auto font-mono text-xs p-2 space-y-px">
                {filteredConsole.length === 0 && (
                  <p className="text-sm text-text-tertiary py-8 text-center font-sans">
                    {consoleLog.length === 0 ? 'No console output' : 'No matching entries'}
                  </p>
                )}
                {filteredConsole.map((c, i) => (
                  <div
                    key={i}
                    className={`flex items-start gap-2 px-2 py-1 rounded ${
                      c.level === 'error' ? 'bg-danger/5 text-danger' :
                      c.level === 'warn' ? 'bg-warning/5 text-warning' :
                      'text-text-primary'
                    }`}
                  >
                    <span className={`shrink-0 w-1.5 h-1.5 rounded-full mt-1.5 ${
                      c.level === 'error' ? 'bg-danger' :
                      c.level === 'warn' ? 'bg-warning' :
                      'bg-accent/50'
                    }`} />
                    <span className="text-text-tertiary shrink-0 w-16">{new Date(c.timestamp).toLocaleTimeString()}</span>
                    <span className="whitespace-pre-wrap break-all">{c.message}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {bottomTab === 'variables' && (
            <div className="space-y-0.5 font-mono">
              {Object.keys(variables).length === 0 && (
                <p className="text-sm text-text-tertiary py-8 text-center font-sans">No variables extracted yet</p>
              )}
              {Object.entries(variables).filter(([k]) => !k.startsWith('__')).map(([name, value]) => (
                <div key={name} className="flex items-center gap-3 px-3 py-1.5 rounded bg-bg-card text-xs">
                  <span className="text-accent font-medium">${`{${name}}`}</span>
                  <span className="text-text-primary truncate">{value}</span>
                </div>
              ))}
            </div>
          )}

          {bottomTab === 'screenshots' && (
            <div className="grid grid-cols-2 gap-2">
              {screenshots.length === 0 && (
                <p className="col-span-2 text-sm text-text-tertiary py-8 text-center">No screenshots captured</p>
              )}
              {screenshots.map((s, i) => (
                <div key={i} className="rounded border border-border-subtle overflow-hidden">
                  <img src={s.data} alt={s.label} className="w-full h-auto" />
                  <p className="text-xs text-text-tertiary px-2 py-1 bg-bg-secondary truncate">{s.label}</p>
                </div>
              ))}
            </div>
          )}

          {bottomTab === 'history' && (
            <div className="space-y-1">
              {runHistory.length === 0 && (
                <div className="flex flex-col items-center justify-center py-12 text-text-tertiary">
                  <History size={32} className="mb-3 opacity-30" />
                  <p className="text-sm">No previous runs</p>
                  <p className="text-xs mt-1">Completed runs will appear here</p>
                </div>
              )}
              {runHistory.length > 0 && (
                <>
                  {/* Mini trend sparkline */}
                  <div className="flex items-center gap-2 px-3 py-2 mb-2 bg-bg-tertiary rounded">
                    <TrendingUp size={12} className="text-text-tertiary" />
                    <div className="flex items-end gap-px h-5 flex-1">
                      {runHistory.slice(0, 20).reverse().map((run, i) => {
                        const rate = run.total > 0 ? run.passed / run.total : 0;
                        return (
                          <div
                            key={run.id}
                            className="flex-1 rounded-t-sm"
                            style={{
                              height: `${Math.max(15, rate * 100)}%`,
                              backgroundColor: run.failed > 0 ? 'var(--color-danger)' : 'var(--color-success)',
                              opacity: 0.4 + (i / 20) * 0.6,
                            }}
                            title={`${new Date(run.timestamp).toLocaleString()} — ${run.passed}/${run.total} passed`}
                          />
                        );
                      })}
                    </div>
                    <span className="text-[10px] text-text-tertiary ml-2">
                      {runHistory.filter(r => r.failed === 0).length}/{runHistory.length} green
                    </span>
                  </div>

                  {/* Run list */}
                  {runHistory.map(run => (
                    <div key={run.id} className="flex items-center gap-3 px-3 py-2 rounded bg-bg-card border border-border-subtle text-sm">
                      <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${run.failed > 0 ? 'bg-danger' : 'bg-success'}`} />
                      <span className="text-text-primary text-xs font-medium">
                        {run.passed}/{run.total} passed
                      </span>
                      <span className="text-text-tertiary text-xs">{(run.duration / 1000).toFixed(1)}s</span>
                      <span className="ml-auto text-text-tertiary text-[10px]">
                        {new Date(run.timestamp).toLocaleString()}
                      </span>
                    </div>
                  ))}
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
