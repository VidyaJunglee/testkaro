import React, { useState, useRef, useEffect } from 'react';
import { ConsoleEntry } from '../engine';
import { Terminal, ArrowDown } from 'lucide-react';

interface Props {
  consoleLog: ConsoleEntry[];
}

type LevelFilter = 'all' | 'log' | 'warn' | 'error';

export function ConsolePanel({ consoleLog }: Props) {
  const [levelFilter, setLevelFilter] = useState<LevelFilter>('all');
  const [autoScroll, setAutoScroll] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  const filtered = consoleLog.filter(entry => {
    if (levelFilter === 'all') return true;
    return entry.level === levelFilter;
  });

  // Auto-scroll to bottom
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [consoleLog.length, autoScroll]);

  const handleScroll = () => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    setAutoScroll(scrollHeight - scrollTop - clientHeight < 40);
  };

  if (consoleLog.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-text-tertiary">
        <Terminal size={28} className="mb-3 opacity-30" />
        <p className="text-sm">No console output</p>
      </div>
    );
  }

  const counts = {
    all: consoleLog.length,
    log: consoleLog.filter(e => e.level === 'log').length,
    warn: consoleLog.filter(e => e.level === 'warn').length,
    error: consoleLog.filter(e => e.level === 'error').length,
  };

  return (
    <div className="flex flex-col h-full">
      {/* Filter bar */}
      <div className="flex items-center gap-1 px-3 py-2 border-b border-border-subtle shrink-0">
        {(['all', 'log', 'warn', 'error'] as const).map(level => (
          <button
            key={level}
            className={`flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-colors ${
              levelFilter === level ? 'bg-accent/10 text-accent' : 'text-text-tertiary hover:text-text-secondary hover:bg-bg-hover'
            }`}
            onClick={() => setLevelFilter(level)}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${
              level === 'error' ? 'bg-danger' :
              level === 'warn' ? 'bg-warning' :
              level === 'log' ? 'bg-text-tertiary' :
              'bg-accent'
            }`} />
            {level.toUpperCase()}
            <span className="text-text-tertiary">({counts[level]})</span>
          </button>
        ))}

        <div className="flex-1" />

        {!autoScroll && (
          <button
            className="flex items-center gap-1 px-2 py-1 rounded text-[10px] text-accent hover:bg-accent/10"
            onClick={() => { setAutoScroll(true); scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' }); }}
          >
            <ArrowDown size={10} />
            Scroll to bottom
          </button>
        )}
      </div>

      {/* Log entries */}
      <div ref={scrollRef} onScroll={handleScroll} className="flex-1 overflow-y-auto font-mono text-[11px]">
        {filtered.length === 0 ? (
          <p className="px-3 py-4 text-xs text-text-tertiary text-center">No entries match filter</p>
        ) : (
          filtered.map((entry, i) => (
            <div
              key={i}
              className={`flex items-start gap-2 px-3 py-1.5 border-b border-border-subtle last:border-0 ${
                entry.level === 'error' ? 'bg-danger/5' :
                entry.level === 'warn' ? 'bg-warning/5' : ''
              }`}
            >
              <span className={`shrink-0 w-8 text-[10px] font-semibold ${
                entry.level === 'error' ? 'text-danger' :
                entry.level === 'warn' ? 'text-warning' :
                'text-text-tertiary'
              }`}>
                {entry.level === 'error' ? 'ERR' : entry.level === 'warn' ? 'WRN' : 'LOG'}
              </span>
              <span className="text-text-secondary break-all flex-1">{entry.message}</span>
              <span className="text-text-tertiary text-[9px] shrink-0 tabular-nums">
                {new Date(entry.timestamp).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </span>
            </div>
          ))
        )}
      </div>

      {/* Footer */}
      <div className="px-3 py-1.5 border-t border-border-subtle bg-bg-secondary text-[10px] text-text-tertiary shrink-0">
        {filtered.length} entries
      </div>
    </div>
  );
}
