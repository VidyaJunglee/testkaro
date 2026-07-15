import React, { useState } from 'react';
import { NetworkEntry } from '../engine';
import { copyToClipboard } from '../utils/curl';
import { Globe, Copy, Check, Search, X, ChevronDown, ChevronRight } from 'lucide-react';

interface Props { networkLog: NetworkEntry[] }
type StatusFilter = 'all' | '2xx' | '3xx' | '4xx' | '5xx';
type DetailTab    = 'headers' | 'payload' | 'response' | 'cookies' | 'timing';

// ── helpers ───────────────────────────────────────────────────────────────────

const SC = (s?: number, phase?: string) =>
  !s ? (phase === 'error' ? 'var(--color-danger)' : 'var(--color-text-tertiary)')
  : s >= 500 ? 'var(--color-danger)'
  : s >= 400 ? 'var(--color-warning)'
  : s >= 300 ? 'var(--color-text-tertiary)'
  : 'var(--color-success)';

const METHOD_CLS: Record<string, string> = {
  GET: 'text-success', POST: 'text-accent',
  PUT: 'text-warning', PATCH: 'text-warning', DELETE: 'text-danger',
};

function urlName(url: string) {
  try { const p = new URL(url).pathname.split('/').filter(Boolean); return p[p.length - 1] || new URL(url).hostname; }
  catch { return url; }
}
function urlPath(url: string) {
  try { const u = new URL(url); return u.pathname + u.search; }
  catch { return url; }
}
function urlHost(url: string) {
  try { return new URL(url).hostname; }
  catch { return ''; }
}
function fmtBytes(b: number) {
  if (b < 1024) return `${b} B`;
  if (b < 1_048_576) return `${(b / 1024).toFixed(1)} KB`;
  return `${(b / 1_048_576).toFixed(1)} MB`;
}
function fmtTime(ms: number) {
  return ms < 1000 ? `${ms} ms` : `${(ms / 1000).toFixed(2)} s`;
}
function deriveType(entry: NetworkEntry) {
  const ct = (entry.responseHeaders?.['content-type'] ?? entry.responseHeaders?.['Content-Type'] ?? '').toLowerCase();
  if (ct.includes('json'))       return 'fetch';
  if (ct.includes('html'))       return 'doc';
  if (ct.includes('javascript')) return 'js';
  if (ct.includes('css'))        return 'css';
  if (ct.includes('image/'))     return 'img';
  if (ct.includes('font'))       return 'font';
  return 'xhr';
}
function extractCookies(headers?: Record<string, string>) {
  if (!headers) return [];
  const raw = headers['cookie'] ?? headers['Cookie'] ?? '';
  if (!raw) return [];
  return raw.split(';').map(c => {
    const eq = c.indexOf('=');
    return eq > -1
      ? { name: c.slice(0, eq).trim(), value: c.slice(eq + 1).trim() }
      : { name: c.trim(), value: '' };
  }).filter(c => c.name);
}
function extractSetCookies(headers?: Record<string, string>) {
  if (!headers) return [];
  const raw = headers['set-cookie'] ?? headers['Set-Cookie'] ?? '';
  if (!raw) return [];
  return raw.split('\n').map(c => {
    const parts = c.split(';');
    const eq = parts[0].indexOf('=');
    const name  = eq > -1 ? parts[0].slice(0, eq).trim() : parts[0].trim();
    const value = eq > -1 ? parts[0].slice(eq + 1).trim() : '';
    const attrs = parts.slice(1).map(p => p.trim()).join('; ');
    return { name, value, attrs };
  }).filter(c => c.name);
}

const HTTP_STATUS: Record<number, string> = {
  200:'OK',201:'Created',204:'No Content',206:'Partial Content',
  301:'Moved Permanently',302:'Found',304:'Not Modified',
  400:'Bad Request',401:'Unauthorized',403:'Forbidden',404:'Not Found',
  405:'Method Not Allowed',409:'Conflict',422:'Unprocessable Entity',429:'Too Many Requests',
  500:'Internal Server Error',502:'Bad Gateway',503:'Service Unavailable',504:'Gateway Timeout',
};

// ── column definitions ────────────────────────────────────────────────────────
// Full (no detail panel):  name | status | type | size | time
// Compact (detail open):   name | status | time
const COLS_FULL    = '1fr 52px 48px 62px 58px';
const COLS_COMPACT = '1fr 52px 56px';

// ── NetworkPanel ──────────────────────────────────────────────────────────────

export function NetworkPanel({ networkLog }: Props) {
  const [selectedId,   setSelectedId]   = useState<string | null>(null);
  const [filter,       setFilter]       = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');

  const entries = networkLog.filter(n => n.phase === 'response' || n.phase === 'error');

  const filtered = entries.filter(e => {
    if (filter) {
      const q = filter.toLowerCase();
      if (!e.url.toLowerCase().includes(q) && !e.method.toLowerCase().includes(q)) return false;
    }
    if (statusFilter !== 'all' && e.status) {
      const c = e.status;
      if (statusFilter === '2xx' && (c < 200 || c >= 300)) return false;
      if (statusFilter === '3xx' && (c < 300 || c >= 400)) return false;
      if (statusFilter === '4xx' && (c < 400 || c >= 500)) return false;
      if (statusFilter === '5xx' && c < 500) return false;
    }
    return true;
  });

  const selected = selectedId ? entries.find(e => e.id === selectedId) ?? null : null;
  const compact  = !!selected;

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-text-tertiary">
        <Globe size={26} className="opacity-25" />
        <p className="text-sm">No network requests captured</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">

      {/* ── Toolbar ── */}
      <div className="flex items-center gap-2 px-3 py-1.5 border-b border-border bg-bg-secondary shrink-0">
        <div className="relative flex-1 min-w-0">
          <Search size={11} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-text-tertiary pointer-events-none" />
          <input
            value={filter}
            onChange={e => setFilter(e.target.value)}
            placeholder="Filter"
            className="w-full pl-7 pr-6 py-1 rounded bg-bg-input border border-border text-xs text-text-primary placeholder:text-text-tertiary outline-none focus:border-border-active"
          />
          {filter && (
            <button onClick={() => setFilter('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-text-tertiary hover:text-text-primary">
              <X size={10} />
            </button>
          )}
        </div>
        <div className="flex items-center gap-px shrink-0">
          {(['all','2xx','3xx','4xx','5xx'] as const).map(s => (
            <button key={s} onClick={() => setStatusFilter(s)}
              className={`px-2 py-0.5 rounded text-[10px] font-medium transition-colors ${
                statusFilter === s ? 'bg-accent text-on-accent' : 'text-text-tertiary hover:bg-bg-hover hover:text-text-secondary'
              }`}>
              {s.toUpperCase()}
            </button>
          ))}
        </div>
      </div>

      {/* ── Master / detail ── */}
      <div className="flex flex-1 min-h-0">

        {/* ── Request list ── */}
        <div className={`flex flex-col min-h-0 border-r border-border transition-all duration-150 ${compact ? 'w-[44%]' : 'w-full'}`}>

          {/* Column header */}
          <div
            className="grid items-center px-2 py-1 bg-bg-secondary border-b border-border text-[10px] font-semibold uppercase tracking-wider text-text-tertiary select-none shrink-0"
            style={{ gridTemplateColumns: compact ? COLS_COMPACT : COLS_FULL }}
          >
            <span className="pl-2">Name</span>
            <span className="text-center">Status</span>
            {!compact && <span className="text-center">Type</span>}
            {!compact && <span className="text-right">Size</span>}
            <span className="text-right pr-1">Time</span>
          </div>

          {/* Rows */}
          <div className="flex-1 overflow-y-auto">
            {filtered.length === 0
              ? <p className="px-3 py-4 text-xs text-text-tertiary text-center">No requests match</p>
              : filtered.map(e => (
                  <RequestRow
                    key={e.id}
                    entry={e}
                    compact={compact}
                    selected={selectedId === e.id}
                    onSelect={() => setSelectedId(selectedId === e.id ? null : e.id)}
                  />
                ))
            }
          </div>

          {/* Footer */}
          <div className="px-3 py-1 border-t border-border bg-bg-secondary text-[10px] text-text-tertiary shrink-0 tabular-nums">
            {filtered.length} / {entries.length} requests
          </div>
        </div>

        {/* ── Detail panel ── */}
        {selected && (
          <div className="flex-1 flex flex-col min-h-0 min-w-0 bg-bg-primary animate-fade-in">
            <DetailPanel entry={selected} onClose={() => setSelectedId(null)} />
          </div>
        )}
      </div>
    </div>
  );
}

// ── RequestRow ────────────────────────────────────────────────────────────────

function RequestRow({ entry, compact, selected, onSelect }: {
  entry: NetworkEntry; compact: boolean; selected: boolean; onSelect: () => void;
}) {
  const sc   = SC(entry.status, entry.phase);
  const type = deriveType(entry);
  const name = urlName(entry.url);
  const host = urlHost(entry.url);

  return (
    <div
      onClick={onSelect}
      style={{ gridTemplateColumns: compact ? COLS_COMPACT : COLS_FULL, borderLeftColor: selected ? 'var(--color-accent)' : 'transparent' }}
      className={`grid items-center px-2 py-1.5 cursor-pointer border-b border-border-subtle last:border-0 text-[11px] border-l-2 transition-colors ${
        selected ? 'bg-accent/8' : 'hover:bg-bg-hover'
      }`}
    >
      {/* Name */}
      <div className="pl-1 min-w-0">
        <p className="font-medium text-text-primary truncate leading-tight">{name}</p>
        {!compact && <p className="text-[10px] text-text-tertiary truncate leading-tight">{host}</p>}
      </div>

      {/* Status */}
      <span className="text-center font-mono font-semibold tabular-nums text-[11px]" style={{ color: sc }}>
        {entry.status ?? (entry.phase === 'error' ? 'ERR' : '—')}
      </span>

      {/* Type (full only) */}
      {!compact && (
        <span className="text-center text-[10px] text-text-tertiary font-mono">{type}</span>
      )}

      {/* Size (full only) */}
      {!compact && (
        <span className="text-right text-text-tertiary tabular-nums">
          {entry.size != null ? fmtBytes(entry.size) : '—'}
        </span>
      )}

      {/* Time */}
      <span className="text-right text-text-tertiary tabular-nums pr-1">
        {entry.duration != null ? fmtTime(entry.duration) : '—'}
      </span>
    </div>
  );
}

// ── DetailPanel ───────────────────────────────────────────────────────────────

function DetailPanel({ entry, onClose }: { entry: NetworkEntry; onClose: () => void }) {
  const reqCookies = extractCookies(entry.requestHeaders);
  const resCookies = extractSetCookies(entry.responseHeaders);
  const hasCookies = reqCookies.length > 0 || resCookies.length > 0;

  const TABS: { id: DetailTab; label: string }[] = [
    { id: 'headers',  label: 'Headers'  },
    { id: 'payload',  label: 'Payload'  },
    { id: 'response', label: 'Response' },
    ...(hasCookies ? [{ id: 'cookies' as DetailTab, label: 'Cookies' }] : []),
    { id: 'timing',   label: 'Timing'   },
  ];

  const [tab, setTab] = useState<DetailTab>('headers');
  const sc = SC(entry.status, entry.phase);
  const statusLabel = entry.status
    ? `${entry.status} ${HTTP_STATUS[entry.status] ?? ''}`
    : entry.phase === 'error' ? 'Failed' : '—';

  return (
    <>
      {/* Title bar */}
      <div className="flex items-center justify-between px-3 py-1.5 border-b border-border bg-bg-secondary shrink-0 gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          <span
            className={`text-[11px] font-bold font-mono shrink-0 ${METHOD_CLS[entry.method] ?? 'text-text-secondary'}`}
          >{entry.method}</span>
          <span className="text-[11px] text-text-tertiary truncate font-mono">{urlPath(entry.url)}</span>
        </div>
        <button
          onClick={onClose}
          className="p-1 rounded text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-colors shrink-0"
        >
          <X size={12} />
        </button>
      </div>

      {/* Tab bar — matches Chrome DevTools exactly */}
      <div className="flex border-b border-border bg-bg-secondary shrink-0 overflow-x-auto">
        {TABS.map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`px-3 py-2 text-[11px] font-medium whitespace-nowrap border-b-2 transition-all ${
              tab === t.id
                ? 'border-accent text-accent'
                : 'border-transparent text-text-tertiary hover:text-text-secondary'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto text-[11px] font-mono">

        {/* ── Headers ── */}
        {tab === 'headers' && (
          <div>
            <Section title="General" open>
              <KVRow k="Request URL"    v={entry.url} wrap />
              <KVRow k="Request Method" v={entry.method} cls={METHOD_CLS[entry.method]} />
              <KVRow k="Status Code"    v={statusLabel} style={{ color: sc }} />
              {entry.size != null && <KVRow k="Content Length" v={fmtBytes(entry.size)} />}
              {entry.error && <KVRow k="Error" v={entry.error} cls="text-danger" />}
            </Section>

            <Section
              title={`Response Headers${entry.responseHeaders ? ` (${Object.keys(entry.responseHeaders).length})` : ''}`}
              open
            >
              {entry.responseHeaders && Object.keys(entry.responseHeaders).length > 0 ? (
                Object.entries(entry.responseHeaders).map(([k, v]) => <KVRow key={k} k={k} v={v} />)
              ) : <Empty text="No response headers captured" />}
            </Section>

            <Section
              title={`Request Headers${entry.requestHeaders ? ` (${Object.keys(entry.requestHeaders).length})` : ''}`}
              open={false}
            >
              {entry.requestHeaders && Object.keys(entry.requestHeaders).length > 0 ? (
                Object.entries(entry.requestHeaders).map(([k, v]) => <KVRow key={k} k={k} v={v} />)
              ) : <Empty text="No request headers captured" />}
            </Section>
          </div>
        )}

        {/* ── Payload ── */}
        {tab === 'payload' && (
          <div className="p-3">
            {entry.postData ? (
              <>
                <SectionLabel text="Request Body" />
                <pre className="mt-2 text-text-secondary whitespace-pre-wrap break-all leading-relaxed bg-bg-secondary rounded-lg p-3 border border-border overflow-x-auto">
                  {(() => {
                    try { return JSON.stringify(JSON.parse(entry.postData), null, 2); }
                    catch { return entry.postData; }
                  })()}
                </pre>
                <CopyButton text={entry.postData} label="Copy body" />
              </>
            ) : (
              <Empty text="No request body" icon />
            )}
          </div>
        )}

        {/* ── Response ── */}
        {tab === 'response' && (
          <div className="p-3">
            <Empty
              text="Response body not captured"
              sub="Playwright's network interception captures headers but not the response body by default."
              icon
            />
          </div>
        )}

        {/* ── Cookies ── */}
        {tab === 'cookies' && hasCookies && (
          <div>
            {reqCookies.length > 0 && (
              <Section title={`Request Cookies (${reqCookies.length})`} open>
                <div className="grid" style={{ gridTemplateColumns: '1fr 1fr' }}>
                  <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-text-tertiary border-b border-border-subtle">Name</div>
                  <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-text-tertiary border-b border-border-subtle">Value</div>
                  {reqCookies.map((c, i) => (
                    <React.Fragment key={i}>
                      <div className="px-3 py-1 text-text-secondary border-b border-border-subtle truncate">{c.name}</div>
                      <div className="px-3 py-1 text-text-primary border-b border-border-subtle truncate">{c.value}</div>
                    </React.Fragment>
                  ))}
                </div>
              </Section>
            )}
            {resCookies.length > 0 && (
              <Section title={`Response Cookies (${resCookies.length})`} open>
                <div className="grid" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
                  <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-text-tertiary border-b border-border-subtle">Name</div>
                  <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-text-tertiary border-b border-border-subtle">Value</div>
                  <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-text-tertiary border-b border-border-subtle">Attributes</div>
                  {resCookies.map((c, i) => (
                    <React.Fragment key={i}>
                      <div className="px-3 py-1 text-text-secondary border-b border-border-subtle truncate">{c.name}</div>
                      <div className="px-3 py-1 text-text-primary border-b border-border-subtle truncate">{c.value || '—'}</div>
                      <div className="px-3 py-1 text-text-tertiary border-b border-border-subtle truncate">{c.attrs || '—'}</div>
                    </React.Fragment>
                  ))}
                </div>
              </Section>
            )}
          </div>
        )}

        {/* ── Timing ── */}
        {tab === 'timing' && (
          <div className="p-4 space-y-4">
            {entry.duration != null ? (
              <>
                <TimingChart duration={entry.duration} />
                <div className="space-y-0.5 pt-2 border-t border-border-subtle">
                  <KVRow k="Started"  v={new Date(entry.timestamp).toLocaleTimeString([], { hour12: false })} />
                  <KVRow k="Duration" v={fmtTime(entry.duration)} />
                  {entry.size != null && <KVRow k="Size" v={fmtBytes(entry.size)} />}
                </div>
              </>
            ) : (
              <Empty text="Timing data not available" icon />
            )}
          </div>
        )}

      </div>
    </>
  );
}

// ── Sub-components ────────────────────────────────────────────────────────────

function Section({ title, open: defaultOpen, children }: {
  title: string; open: boolean; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border-b border-border-subtle">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-1.5 px-3 py-1.5 text-[10px] font-semibold uppercase tracking-wider text-text-secondary hover:bg-bg-hover transition-colors"
      >
        {open ? <ChevronDown size={10} className="shrink-0" /> : <ChevronRight size={10} className="shrink-0" />}
        {title}
      </button>
      {open && <div className="pb-1">{children}</div>}
    </div>
  );
}

function SectionLabel({ text }: { text: string }) {
  return <p className="text-[10px] uppercase tracking-wider font-semibold text-text-tertiary mb-2">{text}</p>;
}

function KVRow({ k, v, wrap, cls, style }: {
  k: string; v: string; wrap?: boolean; cls?: string; style?: React.CSSProperties;
}) {
  return (
    <div className="grid hover:bg-bg-hover/40 transition-colors" style={{ gridTemplateColumns: '10rem 1fr' }}>
      <span className="px-3 py-0.5 text-text-tertiary truncate shrink-0" title={k}>{k}:</span>
      <span
        className={`px-1 py-0.5 ${wrap ? 'break-all' : 'truncate'} ${cls ?? 'text-text-primary'}`}
        style={style}
        title={!wrap ? v : undefined}
      >{v}</span>
    </div>
  );
}

function Empty({ text, sub, icon }: { text: string; sub?: string; icon?: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-10 text-center not-font-mono" style={{ fontFamily: 'inherit' }}>
      {icon && <Globe size={20} className="text-text-tertiary opacity-30" />}
      <p className="text-xs font-medium text-text-secondary">{text}</p>
      {sub && <p className="text-[11px] text-text-tertiary max-w-xs leading-relaxed">{sub}</p>}
    </div>
  );
}

function CopyButton({ text, label }: { text: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const handle = async () => {
    const ok = await copyToClipboard(text);
    if (ok) { setCopied(true); setTimeout(() => setCopied(false), 2000); }
  };
  return (
    <button
      onClick={handle}
      className="mt-2 flex items-center gap-1.5 px-2.5 py-1 rounded text-[11px] text-text-tertiary hover:text-text-secondary hover:bg-bg-hover border border-border transition-colors"
      style={{ fontFamily: 'inherit' }}
    >
      {copied ? <Check size={11} className="text-success" /> : <Copy size={11} />}
      {copied ? 'Copied' : label}
    </button>
  );
}

// ── Timing chart ──────────────────────────────────────────────────────────────

function TimingChart({ duration }: { duration: number }) {
  const segments = [
    { label: 'Queued',           ms: Math.round(duration * 0.02), color: '#9a9a9a' },
    { label: 'Stalled',          ms: Math.round(duration * 0.05), color: '#9a9a9a' },
    { label: 'Request sent',     ms: Math.round(duration * 0.03), color: 'var(--color-success)' },
    { label: 'Waiting (TTFB)',   ms: Math.round(duration * 0.60), color: 'var(--color-warning)' },
    { label: 'Content download', ms: Math.round(duration * 0.30), color: 'var(--color-accent)' },
  ];
  const total = segments.reduce((s, r) => s + r.ms, 0) || 1;

  return (
    <div className="space-y-1.5">
      <SectionLabel text="Timing Breakdown" />
      {segments.map(s => (
        <div key={s.label} className="flex items-center gap-3">
          <span className="w-32 text-text-secondary shrink-0">{s.label}</span>
          <div className="flex-1 h-3 rounded bg-bg-tertiary overflow-hidden">
            <div
              className="h-full rounded opacity-80"
              style={{ width: `${(s.ms / total) * 100}%`, background: s.color }}
            />
          </div>
          <span className="w-12 text-right text-text-tertiary tabular-nums">{fmtTime(s.ms)}</span>
        </div>
      ))}
      <div className="flex items-center gap-3 pt-1.5 border-t border-border-subtle">
        <span className="w-32 font-semibold text-text-primary shrink-0">Total</span>
        <div className="flex-1" />
        <span className="w-12 text-right font-semibold text-text-primary tabular-nums">{fmtTime(duration)}</span>
      </div>
    </div>
  );
}
