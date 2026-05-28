import React, { useEffect, useRef, useState } from 'react';
import { StepResult } from '../store/executionSlice';
import { NetworkEntry, ConsoleEntry } from '../engine';
import { generateCurl, copyToClipboard } from '../utils/curl';
import { useStore } from '../store';
import { CheckCircle2, XCircle, Clock, Loader2, ChevronDown, ChevronRight, Terminal, Globe, Copy, Check } from 'lucide-react';

interface Props {
  results: StepResult[];
  totalSteps: number;
  highlightedStepId?: string | null;
  consoleLog: ConsoleEntry[];
  networkLog: NetworkEntry[];
}

export function ExecutionTimeline({ results, totalSteps, highlightedStepId, consoleLog, networkLog }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [expandedStepId, setExpandedStepId] = useState<string | null>(null);
  const maxDuration = Math.max(...results.map(r => r.duration), 1);
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);

  // Auto-scroll to latest result
  useEffect(() => {
    if (scrollRef.current && !expandedStepId) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [results.length]);

  // Get logs/network for a specific step by timestamp range
  const getStepLogs = (stepIndex: number) => {
    const step = results[stepIndex];
    if (!step) return { logs: [], network: [] };

    const startTime = step.startedAt;
    const endTime = stepIndex < results.length - 1
      ? results[stepIndex + 1].startedAt
      : startTime + step.duration + 500; // add buffer for last step

    const logs = consoleLog.filter(c => c.timestamp >= startTime && c.timestamp <= endTime);
    const network = networkLog.filter(n =>
      n.timestamp >= startTime && n.timestamp <= endTime && n.phase === 'response'
    );
    // Also include request-only entries (no response yet) and errors
    const requestOnly = networkLog.filter(n =>
      n.timestamp >= startTime && n.timestamp <= endTime &&
      (n.phase === 'error' || (n.phase === 'request' && !networkLog.find(r => r.id === n.id && r.phase === 'response')))
    );

    // Merge: prefer response entries, add request-only/error entries
    const networkDeduped = [...network, ...requestOnly];
    const seen = new Set<string>();
    const uniqueNetwork = networkDeduped.filter(n => {
      if (seen.has(n.id)) return false;
      seen.add(n.id);
      return true;
    });

    return { logs, network: uniqueNetwork };
  };

  if (results.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-text-tertiary">
        <Clock size={28} className="mb-3 opacity-30" />
        <p className="text-sm">Timeline will appear during execution</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col">
      {/* Summary header */}
      <div className="flex items-center gap-4 px-3 py-2 bg-bg-secondary border-b border-border-subtle shrink-0">
        <div className="flex items-center gap-1.5">
          <Clock size={12} className="text-text-tertiary" />
          <span className="text-xs text-text-secondary font-medium">{(totalDuration / 1000).toFixed(2)}s</span>
        </div>
        <div className="flex items-center gap-1.5">
          <CheckCircle2 size={12} className="text-success" />
          <span className="text-xs text-text-secondary">{results.filter(r => r.status === 'passed').length}</span>
        </div>
        <div className="flex items-center gap-1.5">
          <XCircle size={12} className="text-danger" />
          <span className="text-xs text-text-secondary">{results.filter(r => r.status === 'failed').length}</span>
        </div>
        <span className="text-xs text-text-tertiary ml-auto">{results.length}/{totalSteps} steps</span>
      </div>

      {/* Waterfall rows */}
      <div ref={scrollRef} className="overflow-y-auto space-y-0.5 p-1">
        {results.map((r, i) => {
          const barWidth = Math.max(4, (r.duration / maxDuration) * 100);
          const isHighlighted = r.stepId === highlightedStepId;
          const isExpanded = r.stepId === expandedStepId;
          const { logs, network } = isExpanded ? getStepLogs(i) : { logs: [], network: [] };

          // Show test group header when testIndex changes (run-all mode)
          const showTestHeader = r.testIndex != null && (i === 0 || results[i - 1].testIndex !== r.testIndex);

          return (
            <div key={r.stepId} className="animate-fade-in">
              {/* Test group header */}
              {showTestHeader && (
                <TestGroupHeader testIndex={r.testIndex!} results={results} />
              )}
              {/* Row */}
              <div
                className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs cursor-pointer transition-all ${
                  isHighlighted ? 'bg-accent/10 ring-1 ring-accent/30' :
                  isExpanded ? 'bg-bg-tertiary' : 'hover:bg-bg-hover'
                }`}
                onClick={() => setExpandedStepId(isExpanded ? null : r.stepId)}
              >
                {/* Expand indicator */}
                <span className="shrink-0 text-text-tertiary w-3">
                  {isExpanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                </span>

                {/* Step number */}
                <span className="text-text-tertiary w-4 text-right shrink-0 tabular-nums">{i + 1}</span>

                {/* Status icon */}
                <span className="shrink-0">
                  {r.status === 'passed' && <CheckCircle2 size={13} className="text-success" />}
                  {r.status === 'failed' && <XCircle size={13} className="text-danger" />}
                  {r.status === 'skipped' && <Clock size={13} className="text-text-tertiary" />}
                </span>

                {/* Step type */}
                <span className="text-text-primary font-medium w-24 truncate shrink-0">{r.type}</span>

                {/* Duration bar (waterfall) */}
                <div className="flex-1 h-4 flex items-center">
                  <div
                    className={`h-3 rounded-sm transition-all ${
                      r.status === 'passed' ? 'bg-success/60' :
                      r.status === 'failed' ? 'bg-danger/60' :
                      'bg-text-tertiary/30'
                    }`}
                    style={{ width: `${barWidth}%`, minWidth: 3 }}
                  />
                </div>

                {/* Duration text */}
                <span className="text-text-tertiary w-14 text-right shrink-0 tabular-nums">
                  {r.duration >= 1000 ? `${(r.duration / 1000).toFixed(1)}s` : `${r.duration}ms`}
                </span>
              </div>

              {/* Expanded detail panel */}
              {isExpanded && (
                <StepDetailPanel
                  result={r}
                  logs={logs}
                  network={network}
                />
              )}
            </div>
          );
        })}

        {/* Pending steps */}
        {results.length < totalSteps && (
          <div className="flex items-center gap-2 px-2 py-1.5 text-xs text-text-tertiary">
            <span className="w-3" />
            <span className="w-4 text-right shrink-0">{results.length + 1}</span>
            <Loader2 size={13} className="animate-spin shrink-0" />
            <span className="italic">Running...</span>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Test Group Header (Run All mode) ─────────────────────────────────────────

function TestGroupHeader({ testIndex, results }: { testIndex: number; results: StepResult[] }) {
  const testName = useStore(s => s.file.tests[testIndex]?.name || `Test ${testIndex + 1}`);
  const testResults = results.filter(r => r.testIndex === testIndex);
  const passed = testResults.filter(r => r.status === 'passed').length;
  const failed = testResults.filter(r => r.status === 'failed').length;
  const allDone = testResults.length > 0 && testResults.every(r => r.status !== 'skipped');

  return (
    <div className="flex items-center gap-2 px-2 py-1.5 mt-1 mb-0.5 rounded bg-bg-secondary border border-border-subtle">
      <span className="text-[10px] font-bold uppercase tracking-wider text-accent">
        Test {testIndex + 1}
      </span>
      <span className="text-xs font-medium text-text-primary">{testName}</span>
      {allDone && (
        <span className={`ml-auto text-[10px] font-medium ${failed > 0 ? 'text-danger' : 'text-success'}`}>
          {failed > 0 ? `${failed} failed` : `${passed} passed`}
        </span>
      )}
    </div>
  );
}

// ─── Step Detail Panel (Accordion) ────────────────────────────────────────────

interface StepDetailProps {
  result: StepResult;
  logs: ConsoleEntry[];
  network: NetworkEntry[];
}

function StepDetailPanel({ result, logs, network }: StepDetailProps) {
  return (
    <div className="ml-9 mr-2 mb-1 mt-0.5 rounded border border-border-subtle bg-bg-card overflow-hidden animate-fade-in">
      {/* Error + Screenshot */}
      {result.error && (
        <div className="px-3 py-2 bg-danger/5 border-b border-danger/20">
          <p className="text-danger text-xs font-medium mb-0.5">Error</p>
          <pre className="text-text-secondary whitespace-pre-wrap text-[11px] leading-relaxed">{result.error}</pre>
          {result.screenshot && (
            <div className="mt-2">
              <img
                src={result.screenshot}
                alt="Failure screenshot"
                className="rounded border border-border-subtle max-h-40 object-contain object-left cursor-pointer hover:opacity-90 transition-opacity"
                onClick={() => window.open(result.screenshot, '_blank')}
              />
            </div>
          )}
        </div>
      )}

      {/* Console Logs */}
      <div className="border-b border-border-subtle">
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-bg-secondary">
          <Terminal size={11} className="text-text-tertiary" />
          <span className="text-[10px] uppercase tracking-wider text-text-tertiary font-semibold">Console</span>
          <span className="text-[10px] text-text-tertiary ml-auto">{logs.length}</span>
        </div>
        {logs.length === 0 ? (
          <p className="px-3 py-2 text-[11px] text-text-tertiary italic">No console output</p>
        ) : (
          <div className="max-h-32 overflow-y-auto">
            {logs.map((log, i) => (
              <div key={i} className="flex items-start gap-2 px-3 py-1 text-[11px] border-b border-border-subtle last:border-0">
                <span className={`shrink-0 font-mono ${
                  log.level === 'error' ? 'text-danger' :
                  log.level === 'warn' ? 'text-warning' :
                  'text-text-tertiary'
                }`}>
                  {log.level === 'error' ? 'ERR' : log.level === 'warn' ? 'WRN' : 'LOG'}
                </span>
                <span className="text-text-secondary break-all">{log.message}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Network Requests */}
      <div>
        <div className="flex items-center gap-1.5 px-3 py-1.5 bg-bg-secondary">
          <Globe size={11} className="text-text-tertiary" />
          <span className="text-[10px] uppercase tracking-wider text-text-tertiary font-semibold">Network</span>
          <span className="text-[10px] text-text-tertiary ml-auto">{network.length}</span>
        </div>
        {network.length === 0 ? (
          <p className="px-3 py-2 text-[11px] text-text-tertiary italic">No network requests</p>
        ) : (
          <div className="max-h-48 overflow-y-auto">
            {network.map((entry) => (
              <NetworkRow key={entry.id} entry={entry} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Network Row with cURL copy ───────────────────────────────────────────────

function NetworkRow({ entry }: { entry: NetworkEntry }) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const curl = generateCurl(entry);
    const ok = await copyToClipboard(curl);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const statusColor = entry.status
    ? entry.status >= 400 ? 'text-danger' : entry.status >= 300 ? 'text-warning' : 'text-success'
    : entry.phase === 'error' ? 'text-danger' : 'text-text-tertiary';

  // Shorten URL for display
  const shortUrl = (() => {
    try {
      const u = new URL(entry.url);
      const path = u.pathname + u.search;
      return path.length > 60 ? path.slice(0, 57) + '...' : path;
    } catch {
      return entry.url.slice(0, 60);
    }
  })();

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 text-[11px] border-b border-border-subtle last:border-0 hover:bg-bg-hover group">
      {/* Method */}
      <span className="font-mono font-medium text-accent shrink-0 w-10">{entry.method}</span>

      {/* Status */}
      <span className={`font-mono shrink-0 w-7 ${statusColor}`}>
        {entry.status || (entry.phase === 'error' ? 'ERR' : '...')}
      </span>

      {/* URL */}
      <span className="text-text-secondary truncate flex-1 font-mono" title={entry.url}>
        {shortUrl}
      </span>

      {/* Duration */}
      {entry.duration != null && (
        <span className="text-text-tertiary shrink-0 tabular-nums">
          {entry.duration}ms
        </span>
      )}

      {/* Copy cURL button */}
      <button
        className="shrink-0 p-0.5 rounded text-text-tertiary hover:text-accent opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={handleCopy}
        title="Copy as cURL"
      >
        {copied ? <Check size={12} className="text-success" /> : <Copy size={12} />}
      </button>
    </div>
  );
}
