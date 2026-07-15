import React from 'react';
import { ExecutionTimeline } from './ExecutionTimeline';
import { NetworkPanel } from './NetworkPanel';
import { ConsolePanel } from './ConsolePanel';
import { ScreenshotPanel } from './ScreenshotPanel';
import { VariablesPanel } from './VariablesPanel';
import { RunDropdown } from './RunDropdown';
import {
  useStore,
  useResults, useRunState, useRunHistory, usePaused,
  useHeaded, useBrowserType, useErrorMsg, useHighlightedStepId,
  useRunMode, useRunAllProgress,
} from '../store';
import { BottomTab } from '../store/uiSlice';
import { BrowserType } from '../store/executionSlice';
import { exportRunReport } from '../utils/report';
import { MobileRunBar } from './MobileRunBar';
import {
  Play, Square, Monitor, MonitorOff, Clock,
  Activity, Globe, Terminal, Camera, Braces, Maximize2, X, Download,
} from 'lucide-react';

const TABS: { id: BottomTab; label: string; icon: React.ReactNode }[] = [
  { id: 'timeline', label: 'Timeline', icon: <Activity size={12} /> },
  { id: 'network', label: 'Network', icon: <Globe size={12} /> },
  { id: 'console', label: 'Console', icon: <Terminal size={12} /> },
  { id: 'screenshots', label: 'Shots', icon: <Camera size={12} /> },
  { id: 'variables', label: 'Vars', icon: <Braces size={12} /> },
];

interface Props {
  onRun: () => void;
  onStop: () => void;
  onResume: () => void;
  isPopup?: boolean;
  onExpand?: () => void;
  onClose?: () => void;
}

export function RunnerView({ onRun, onStop, onResume, isPopup, onExpand, onClose }: Props) {
  const store = useStore;
  const results = useResults();
  const runState = useRunState();
  const runHistory = useRunHistory();
  const paused = usePaused();
  const headed = useHeaded();
  const browserType = useBrowserType();
  const engine = useStore(s => s.file.engine || 'web');
  const errorMsg = useErrorMsg();
  const highlightedStepId = useHighlightedStepId();
  const runMode = useRunMode();
  const runAllProgress = useRunAllProgress();
  const consoleLog = useStore(s => s.consoleLog);
  const networkLog = useStore(s => s.networkLog);
  const screenshots = useStore(s => s.screenshots);
  const variables = useStore(s => s.variables);
  const bottomTab = useStore(s => s.bottomTab);
  const setBottomTab = useStore(s => s.setBottomTab);
  const allTests = useStore(s => s.file.tests);
  const modules = useStore(s => s.modules);
  const steps = useStore(s => s.file.tests?.[s.activeTestIndex]?.steps || []);

  const passedCount = results.filter(r => r.status === 'passed').length;
  const failedCount = results.filter(r => r.status === 'failed').length;
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);

  const totalStepsForRun = runMode === 'all-modules'
    ? (modules || []).reduce((sum, m) => sum + (m.tests || []).reduce((s2, t) => s2 + (t.steps?.length || 0), 0), 0)
    : runMode === 'all'
      ? allTests.reduce((sum, t) => sum + t.steps.length, 0)
      : steps.length;

  const networkCount = networkLog.filter(n => n.phase === 'response' || n.phase === 'error').length;
  const consoleCount = consoleLog.length;
  const screenshotCount = screenshots.length;
  const variableCount = Object.keys(variables).length;

  const getBadge = (tabId: BottomTab): number | null => {
    switch (tabId) {
      case 'network':     return networkCount || null;
      case 'console':     return consoleCount || null;
      case 'screenshots': return screenshotCount || null;
      case 'variables':   return variableCount || null;
      default:            return null;
    }
  };

  return (
    <div className="flex flex-col h-full">

      {/* ── Header ── */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border shrink-0">
        <div className="flex items-center gap-2">
          <Activity size={13} className="text-text-tertiary" />
          <span className="text-xs font-bold text-text-secondary uppercase tracking-widest">Runner</span>
        </div>
        <div className="flex items-center gap-2">
          {isPopup ? (
            <button
              className="p-1.5 rounded-lg text-text-tertiary hover:text-text-secondary hover:bg-bg-hover transition-all"
              onClick={onClose}
              title="Close (Esc)"
            >
              <X size={14} />
            </button>
          ) : (
            <button
              className="p-1.5 rounded-lg text-text-tertiary hover:text-text-secondary hover:bg-bg-hover transition-all"
              onClick={onExpand}
              title="Expand to full view"
            >
              <Maximize2 size={14} />
            </button>
          )}

          <select
            className="px-2 py-1 rounded-lg text-[11px] font-medium bg-transparent border border-border-subtle text-text-tertiary hover:text-text-secondary hover:bg-bg-hover outline-none transition-all"
            value={engine}
            onChange={e => {
              const nextEngine = e.target.value as 'web' | 'mobile';
              const s = store.getState();
              if (nextEngine === 'mobile') s.setModuleEngine('mobile', s.file.mobileConfig || { platform: 'android' });
              else s.setModuleEngine('web');
            }}
            disabled={runState === 'running' || runState === 'connecting'}
            title="Test engine"
          >
            <option value="web">Web</option>
            <option value="mobile">Mobile</option>
          </select>

          {engine === 'mobile' ? (
            <MobileRunBar />
          ) : (
            <>
              <select
                className="px-2 py-1 rounded-lg text-[11px] font-medium bg-transparent border border-border-subtle text-text-tertiary hover:text-text-secondary hover:bg-bg-hover outline-none transition-all capitalize"
                value={browserType}
                onChange={e => store.getState().setBrowserType(e.target.value as BrowserType)}
                disabled={runState === 'running' || runState === 'connecting'}
                title="Browser engine"
              >
                <option value="chromium">Chromium</option>
                <option value="firefox">Firefox</option>
                <option value="webkit">WebKit</option>
              </select>

              <button
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium transition-all border ${
                  headed
                    ? 'bg-accent/10 text-accent border-accent/20'
                    : 'text-text-tertiary border-border-subtle hover:text-text-secondary hover:bg-bg-hover'
                }`}
                onClick={() => store.getState().setHeaded(!headed)}
                title={headed ? 'Headed mode (browser visible)' : 'Headless mode'}
              >
                {headed ? <Monitor size={11} /> : <MonitorOff size={11} />}
                {headed ? 'Headed' : 'Headless'}
              </button>
            </>
          )}

          {runState === 'running' || runState === 'connecting' ? (
            <div className="flex items-center gap-1.5">
              {paused && (
                <button
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-success hover:bg-success/80 text-white transition-all"
                  onClick={onResume}
                >
                  <Play size={11} />
                  Continue
                </button>
              )}
              <button
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-danger hover:bg-danger/80 text-white transition-all"
                onClick={onStop}
              >
                <Square size={11} />
                Stop
              </button>
            </div>
          ) : (
            <RunDropdown onRun={onRun} disabled={totalStepsForRun === 0} />
          )}
        </div>
      </div>

      {/* ── Status bar ── */}
      {runState !== 'idle' && (
        <div className="flex items-center gap-3 px-3 py-2 bg-bg-tertiary border-b border-border text-xs shrink-0">
          {runState === 'connecting' && <span className="text-text-tertiary">Connecting...</span>}
          {runState === 'running' && !paused && (
            <span className="text-accent font-medium flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-accent rounded-full animate-pulse" />
              {runAllProgress ? (
                runAllProgress.totalModules ? (
                  <>Module {(runAllProgress.currentModuleIndex ?? 0) + 1}/{runAllProgress.totalModules}: {runAllProgress.currentModuleName} — Test {runAllProgress.currentTestIndex + 1}/{runAllProgress.totalTests} ({results.length}/{totalStepsForRun})</>
                ) : (
                  <>Test {runAllProgress.currentTestIndex + 1}/{runAllProgress.totalTests}: {runAllProgress.currentTestName} ({results.length}/{totalStepsForRun})</>
                )
              ) : (
                <>Running ({results.length}/{totalStepsForRun})</>
              )}
            </span>
          )}
          {runState === 'running' && paused && (
            <span className="text-warning font-medium">Paused ({results.length}/{totalStepsForRun})</span>
          )}
          {runState === 'done' && results.length === 0 && errorMsg && (
            <span className="font-medium text-danger">Blocked</span>
          )}
          {runState === 'done' && (results.length > 0 || !errorMsg) && (
            <>
              <span className={`font-medium ${failedCount > 0 ? 'text-danger' : 'text-success'}`}>
                {failedCount > 0 ? 'Failed' : 'Passed'}
              </span>
              <span className="text-text-tertiary">{passedCount}/{results.length} passed</span>
              {runAllProgress?.totalModules && (
                <span className="text-text-tertiary">{runAllProgress.totalModules} modules</span>
              )}
              {runAllProgress && (
                <span className="text-text-tertiary">{runAllProgress.totalTests} tests</span>
              )}
              <span className="text-text-tertiary">{(totalDuration / 1000).toFixed(1)}s</span>
            </>
          )}
          {errorMsg && (
            <span className="flex items-center gap-2 ml-2 min-w-0">
              <span className="text-danger truncate">{errorMsg}</span>
              <button
                className="shrink-0 px-2 py-0.5 rounded-md text-[11px] font-medium text-danger border border-danger/30 hover:bg-danger/10 transition-all"
                onClick={onRun}
              >
                Retry
              </button>
            </span>
          )}
        </div>
      )}

      {/* ── Tab bar ── */}
      <div className="flex items-center border-b border-border shrink-0 px-1 gap-0.5">
        {TABS.map(tab => {
          const badge = getBadge(tab.id);
          const isActive = bottomTab === tab.id;
          return (
            <button
              key={tab.id}
              className={`flex items-center gap-1.5 px-3 py-2 text-[11px] font-medium rounded-t-md transition-all relative ${
                isActive
                  ? 'text-accent bg-accent/5'
                  : 'text-text-tertiary hover:text-text-secondary hover:bg-bg-hover'
              }`}
              onClick={() => setBottomTab(tab.id)}
            >
              {isActive && <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-accent rounded-t-full" />}
              {tab.icon}
              <span>{tab.label}</span>
              {badge != null && badge > 0 && (
                <span className={`px-1.5 py-0.5 rounded-full text-[9px] font-bold leading-none ${
                  isActive ? 'bg-accent/20 text-accent' : 'bg-bg-tertiary text-text-tertiary'
                }`}>
                  {badge > 99 ? '99+' : badge}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* ── Tab content ── */}
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
        {bottomTab === 'network'     && <NetworkPanel networkLog={networkLog} />}
        {bottomTab === 'console'     && <ConsolePanel consoleLog={consoleLog} />}
        {bottomTab === 'screenshots' && <ScreenshotPanel screenshots={screenshots} />}
        {bottomTab === 'variables'   && <VariablesPanel variables={variables} />}
      </div>

      {/* ── Run History ── */}
      {runHistory.length > 0 && bottomTab === 'timeline' && (
        <div className="border-t border-border bg-bg-secondary shrink-0">
          <div className="px-3 py-1.5 flex items-center gap-2">
            <Clock size={11} className="text-text-tertiary" />
            <span className="text-[10px] uppercase tracking-wider text-text-tertiary font-semibold">History</span>
          </div>
          <div className="max-h-28 overflow-y-auto px-2 pb-2 space-y-0.5">
            {runHistory.slice(0, 5).map(run => (
              <div key={run.id} className="group flex items-center gap-2 px-2 py-1.5 rounded bg-bg-card text-xs">
                <span className={`w-2 h-2 rounded-full shrink-0 ${run.failed > 0 ? 'bg-danger' : 'bg-success'}`} />
                <span className="text-text-primary font-medium">{run.passed}/{run.total}</span>
                <span className="text-text-tertiary">{(run.duration / 1000).toFixed(1)}s</span>
                <button
                  className="opacity-0 group-hover:opacity-100 text-text-tertiary hover:text-accent transition-all ml-auto"
                  title="Export report"
                  onClick={() => exportRunReport(run, run.testName, 'html')}
                >
                  <Download size={11} />
                </button>
                <span className="text-text-tertiary text-[10px]">
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
