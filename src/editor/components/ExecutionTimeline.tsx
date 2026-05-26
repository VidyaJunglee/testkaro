import React, { useEffect, useRef } from 'react';
import { StepResult } from '../store/executionSlice';
import { CheckCircle2, XCircle, Clock, Loader2 } from 'lucide-react';

interface Props {
  results: StepResult[];
  totalSteps: number;
  highlightedStepId?: string | null;
}

export function ExecutionTimeline({ results, totalSteps, highlightedStepId }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const maxDuration = Math.max(...results.map(r => r.duration), 1);
  const totalDuration = results.reduce((sum, r) => sum + r.duration, 0);

  // Auto-scroll to latest result
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [results.length]);

  if (results.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-text-tertiary">
        <Clock size={28} className="mb-3 opacity-30" />
        <p className="text-sm">Timeline will appear during execution</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Summary header */}
      <div className="flex items-center gap-4 px-3 py-2 bg-bg-secondary rounded-t border border-border-subtle mb-1 shrink-0">
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
      <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-0.5">
        {results.map((r, i) => {
          const barWidth = Math.max(4, (r.duration / maxDuration) * 100);
          const isHighlighted = r.stepId === highlightedStepId;

          return (
            <div
              key={r.stepId}
              className={`flex items-center gap-2 px-2 py-1.5 rounded text-xs transition-all ${
                isHighlighted ? 'bg-accent/10 ring-1 ring-accent/30' : 'hover:bg-bg-hover'
              }`}
            >
              {/* Step number */}
              <span className="text-text-tertiary w-5 text-right shrink-0 tabular-nums">{i + 1}</span>

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
          );
        })}

        {/* Pending steps */}
        {results.length < totalSteps && (
          <div className="flex items-center gap-2 px-2 py-1.5 text-xs text-text-tertiary">
            <span className="w-5 text-right shrink-0">{results.length + 1}</span>
            <Loader2 size={13} className="animate-spin shrink-0" />
            <span className="italic">Running...</span>
          </div>
        )}

        {/* Failed step error details */}
        {results.filter(r => r.error).map(r => (
          <div key={`err-${r.stepId}`} className="ml-7 mt-1 p-2 bg-danger/5 border border-danger/20 rounded text-xs">
            <p className="text-danger font-medium mb-0.5">Step "{r.type}" failed:</p>
            <pre className="text-text-secondary whitespace-pre-wrap text-[11px] leading-relaxed">{r.error}</pre>
          </div>
        ))}
      </div>
    </div>
  );
}
