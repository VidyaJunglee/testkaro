import React, { useState } from 'react';
import { NetworkEntry } from '../engine';
import { generateCurl, copyToClipboard } from '../utils/curl';
import { Globe, Copy, Check, ChevronDown, ChevronRight, Search, X } from 'lucide-react';

interface Props {
  networkLog: NetworkEntry[];
}

export function NetworkPanel({ networkLog }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [filter, setFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | '2xx' | '3xx' | '4xx' | '5xx'>('all');

  // Only show response/error phase entries (deduplicated)
  const entries = networkLog.filter(n => n.phase === 'response' || n.phase === 'error');

  const filtered = entries.filter(entry => {
    if (filter && !entry.url.toLowerCase().includes(filter.toLowerCase()) && !entry.method.toLowerCase().includes(filter.toLowerCase())) {
      return false;
    }
    if (statusFilter !== 'all' && entry.status) {
      const code = entry.status;
      if (statusFilter === '2xx' && (code < 200 || code >= 300)) return false;
      if (statusFilter === '3xx' && (code < 300 || code >= 400)) return false;
      if (statusFilter === '4xx' && (code < 400 || code >= 500)) return false;
      if (statusFilter === '5xx' && code < 500) return false;
    }
    return true;
  });

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-text-tertiary">
        <Globe size={28} className="mb-3 opacity-30" />
        <p className="text-sm">No network requests captured</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Filter bar */}
      <div className="flex items-center gap-2 px-3 py-2 border-b border-border-subtle shrink-0">
        <div className="relative flex-1">
          <Search size={12} className="absolute left-2 top-1/2 -translate-y-1/2 text-text-tertiary" />
          <input
            type="text"
            value={filter}
            onChange={e => setFilter(e.target.value)}
            placeholder="Filter by URL or method..."
            className="w-full pl-7 pr-7 py-1.5 rounded bg-bg-input border border-border text-xs text-text-primary placeholder:text-text-tertiary focus:outline-none focus:border-accent"
          />
          {filter && (
            <button onClick={() => setFilter('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-secondary">
              <X size={12} />
            </button>
          )}
        </div>
        <div className="flex items-center gap-0.5">
          {(['all', '2xx', '3xx', '4xx', '5xx'] as const).map(s => (
            <button
              key={s}
              className={`px-2 py-1 rounded text-[10px] font-medium transition-colors ${
                statusFilter === s ? 'bg-accent/10 text-accent' : 'text-text-tertiary hover:text-text-secondary hover:bg-bg-hover'
              }`}
              onClick={() => setStatusFilter(s)}
            >
              {s.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* Header */}
      <div className="flex items-center gap-2 px-3 py-1.5 bg-bg-tertiary border-b border-border-subtle text-[10px] uppercase tracking-wider text-text-tertiary font-semibold shrink-0">
        <span className="w-4" />
        <span className="w-12">Method</span>
        <span className="w-10">Status</span>
        <span className="flex-1">URL</span>
        <span className="w-16 text-right">Duration</span>
        <span className="w-8" />
      </div>

      {/* Rows */}
      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <p className="px-3 py-4 text-xs text-text-tertiary text-center">No requests match filter</p>
        ) : (
          filtered.map(entry => (
            <NetworkEntryRow
              key={entry.id}
              entry={entry}
              isExpanded={expandedId === entry.id}
              onToggle={() => setExpandedId(expandedId === entry.id ? null : entry.id)}
            />
          ))
        )}
      </div>

      {/* Footer */}
      <div className="px-3 py-1.5 border-t border-border-subtle bg-bg-secondary text-[10px] text-text-tertiary shrink-0">
        {filtered.length} / {entries.length} requests
      </div>
    </div>
  );
}

function NetworkEntryRow({ entry, isExpanded, onToggle }: { entry: NetworkEntry; isExpanded: boolean; onToggle: () => void }) {
  const [copied, setCopied] = useState(false);

  const statusColor = entry.status
    ? entry.status >= 400 ? 'text-danger' : entry.status >= 300 ? 'text-warning' : 'text-success'
    : entry.phase === 'error' ? 'text-danger' : 'text-text-tertiary';

  const shortUrl = (() => {
    try {
      const u = new URL(entry.url);
      return u.pathname + u.search;
    } catch {
      return entry.url;
    }
  })();

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const curl = generateCurl(entry);
    const ok = await copyToClipboard(curl);
    if (ok) { setCopied(true); setTimeout(() => setCopied(false), 2000); }
  };

  return (
    <div className="border-b border-border-subtle last:border-0">
      <div
        className={`flex items-center gap-2 px-3 py-2 text-xs cursor-pointer transition-colors ${isExpanded ? 'bg-bg-tertiary' : 'hover:bg-bg-hover'}`}
        onClick={onToggle}
      >
        <span className="w-4 shrink-0 text-text-tertiary">
          {isExpanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
        </span>
        <span className="w-12 shrink-0 font-mono font-medium text-accent">{entry.method}</span>
        <span className={`w-10 shrink-0 font-mono ${statusColor}`}>
          {entry.status || (entry.phase === 'error' ? 'ERR' : '...')}
        </span>
        <span className="flex-1 font-mono text-text-secondary truncate" title={entry.url}>{shortUrl}</span>
        <span className="w-16 text-right text-text-tertiary tabular-nums shrink-0">
          {entry.duration != null ? `${entry.duration}ms` : '-'}
        </span>
        <button
          className="w-8 shrink-0 flex justify-center p-0.5 rounded text-text-tertiary hover:text-accent transition-colors"
          onClick={handleCopy}
          title="Copy as cURL"
        >
          {copied ? <Check size={12} className="text-success" /> : <Copy size={12} />}
        </button>
      </div>

      {isExpanded && (
        <div className="px-3 pb-3 pt-1 ml-6 animate-fade-in">
          <div className="rounded border border-border-subtle bg-bg-card overflow-hidden text-[11px]">
            {/* Full URL */}
            <div className="px-3 py-2 border-b border-border-subtle">
              <span className="text-text-tertiary">URL: </span>
              <span className="text-text-primary font-mono break-all">{entry.url}</span>
            </div>

            {/* Request Headers */}
            {entry.requestHeaders && Object.keys(entry.requestHeaders).length > 0 && (
              <div className="px-3 py-2 border-b border-border-subtle">
                <p className="text-text-tertiary font-semibold mb-1">Request Headers</p>
                <div className="space-y-0.5 font-mono">
                  {Object.entries(entry.requestHeaders).map(([k, v]) => (
                    <div key={k}><span className="text-accent">{k}:</span> <span className="text-text-secondary">{v}</span></div>
                  ))}
                </div>
              </div>
            )}

            {/* Request Body */}
            {entry.postData && (
              <div className="px-3 py-2 border-b border-border-subtle">
                <p className="text-text-tertiary font-semibold mb-1">Request Body</p>
                <pre className="text-text-secondary font-mono whitespace-pre-wrap break-all max-h-32 overflow-y-auto">{entry.postData}</pre>
              </div>
            )}

            {/* Response Headers */}
            {entry.responseHeaders && Object.keys(entry.responseHeaders).length > 0 && (
              <div className="px-3 py-2">
                <p className="text-text-tertiary font-semibold mb-1">Response Headers</p>
                <div className="space-y-0.5 font-mono">
                  {Object.entries(entry.responseHeaders).map(([k, v]) => (
                    <div key={k}><span className="text-accent">{k}:</span> <span className="text-text-secondary">{v}</span></div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
