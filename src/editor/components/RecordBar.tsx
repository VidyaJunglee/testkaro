import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Circle, Square, MousePointer, ShieldCheck, Globe, Monitor, X, Zap, Eye, Layers } from 'lucide-react';
import { TestStep } from '../../schema';
import { useFocusTrap } from '../hooks/useFocusTrap';
import { toast } from '../store/toast';

interface Props {
  onStepRecorded: (step: TestStep) => void;
  onRecordingStateChange: (recording: boolean) => void;
  open: boolean;
  onClose: () => void;
}

export interface SelectorSuggestion {
  type: string;
  value: string;
  confidence: number;
}

type RecordMode = 'action' | 'assert';

export function RecordBar({ onStepRecorded, onRecordingStateChange, open, onClose }: Props) {
  const [recording, setRecording] = useState(false);
  const [url, setUrl] = useState('');
  const [currentPageUrl, setCurrentPageUrl] = useState('');
  const [stepCount, setStepCount] = useState(0);
  const [connected, setConnected] = useState(false);
  const [mode, setMode] = useState<RecordMode>('action');
  const [overlayOn, setOverlayOn] = useState(false);
  const [recentUrls, setRecentUrls] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('testkaro-recent-urls') || '[]');
    } catch { return []; }
  });
  const wsRef = useRef<WebSocket | null>(null);
  const urlInputRef = useRef<HTMLInputElement>(null);
  const trapRef = useFocusTrap<HTMLDivElement>(open && !recording);

  // Focus URL input when modal opens
  useEffect(() => {
    if (open && !recording) {
      setTimeout(() => urlInputRef.current?.focus(), 100);
    }
  }, [open, recording]);

  const saveRecentUrl = (url: string) => {
    try {
      const existing: string[] = JSON.parse(localStorage.getItem('testkaro-recent-urls') || '[]');
      const updated = [url, ...existing.filter(u => u !== url)].slice(0, 5);
      localStorage.setItem('testkaro-recent-urls', JSON.stringify(updated));
      setRecentUrls(updated);
    } catch {}
  };

  const clearRecentUrls = () => {
    localStorage.removeItem('testkaro-recent-urls');
    setRecentUrls([]);
  };

  const startRecording = useCallback(() => {
    if (!url || !url.startsWith('http')) return;

    saveRecentUrl(url);

    const ws = new WebSocket('ws://localhost:3001/ws');
    wsRef.current = ws;

    ws.onopen = () => {
      setConnected(true);
      ws.send(JSON.stringify({ type: 'record-start', url, headed: true }));
    };

    ws.onmessage = (event) => {
      const msg = JSON.parse(event.data);

      if (msg.type === 'record-started') {
        setRecording(true);
        onRecordingStateChange(true);
        setCurrentPageUrl(msg.data.url || url);
      } else if (msg.type === 'record-step') {
        const step = msg.data.step as TestStep;
        onStepRecorded(step);
        setStepCount(c => c + 1);
        if (step.type === 'navigate' && typeof step.params.url === 'string') {
          setCurrentPageUrl(step.params.url);
        }
      } else if (msg.type === 'record-focus-changed') {
        // The page redirected to a new tab/window — recording followed it.
        setCurrentPageUrl(msg.data.url || '');
        toast.info('Recording followed the page to a new tab');
      } else if (msg.type === 'record-done') {
        setRecording(false);
        onRecordingStateChange(false);
        setConnected(false);
        setStepCount(0);
        setMode('action');
        setOverlayOn(false);
      } else if (msg.type === 'record-mode-changed') {
        setMode(msg.data.mode);
      } else if (msg.type === 'error') {
        console.error('[RecordBar]', msg.data.message);
        setRecording(false);
        onRecordingStateChange(false);
        setConnected(false);
      }
    };

    ws.onerror = () => {
      setConnected(false);
      setRecording(false);
      onRecordingStateChange(false);
    };

    ws.onclose = () => {
      setConnected(false);
      wsRef.current = null;
    };
  }, [url, onStepRecorded, onRecordingStateChange]);

  const stopRecording = useCallback(() => {
    wsRef.current?.send(JSON.stringify({ type: 'record-stop' }));
    setRecording(false);
    onRecordingStateChange(false);
    setStepCount(0);
    setMode('action');
  }, [onRecordingStateChange]);

  const toggleMode = useCallback(() => {
    const newMode: RecordMode = mode === 'action' ? 'assert' : 'action';
    setMode(newMode);
    wsRef.current?.send(JSON.stringify({ type: 'record-mode', mode: newMode }));
  }, [mode]);

  const toggleOverlay = useCallback(() => {
    wsRef.current?.send(JSON.stringify({ type: 'overlay-toggle' }));
    setOverlayOn(v => !v);
  }, []);

  // Cleanup WebSocket on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, []);

  // Close on Escape (only the setup modal, not during recording)
  useEffect(() => {
    if (!open || recording) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [open, recording, onClose]);

  // ─── RECORDING ACTIVE: Floating status bar ─────────────────────────────────
  if (recording) {
    return (
      <div className="flex items-center gap-3 px-4 py-2.5 bg-bg-secondary border-b border-danger/20">
        {/* Recording pulse */}
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-danger opacity-75" />
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-danger" />
          </span>
          <span className="text-sm font-semibold text-danger">REC</span>
        </div>

        {/* Step count */}
        <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-bg-tertiary border border-border">
          <Zap size={11} className="text-accent" />
          <span className="text-xs font-medium text-text-primary tabular-nums">{stepCount}</span>
          <span className="text-xs text-text-tertiary">steps</span>
        </div>

        {/* Mode toggle */}
        <button
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-all ${
            mode === 'assert'
              ? 'bg-amber-500/10 border-amber-500/40 text-amber-400 hover:bg-amber-500/20'
              : 'bg-indigo-500/10 border-indigo-500/40 text-indigo-400 hover:bg-indigo-500/20'
          }`}
          onClick={toggleMode}
          title={mode === 'action' ? 'Switch to Assert mode — clicks will record assertions' : 'Switch to Action mode — clicks will record interactions'}
        >
          {mode === 'action' ? <MousePointer size={11} /> : <ShieldCheck size={11} />}
          {mode === 'action' ? 'Actions' : 'Asserts'}
        </button>

        {/* DOM Overlay toggle */}
        <button
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border transition-all ${
            overlayOn
              ? 'bg-emerald-500/10 border-emerald-500/40 text-emerald-400 hover:bg-emerald-500/20'
              : 'bg-bg-tertiary border-border text-text-tertiary hover:bg-bg-hover hover:text-text-secondary'
          }`}
          onClick={toggleOverlay}
          title={overlayOn ? 'Hide element overlay' : 'Show all interactive elements with colored labels'}
        >
          <Layers size={11} />
          Overlay
        </button>

        {/* URL of the page currently being recorded (follows redirects/new tabs) */}
        <span className="text-[11px] text-text-tertiary truncate flex-1 font-mono" title={currentPageUrl || url}>
          {currentPageUrl || url}
        </span>

        {/* Stop button */}
        <button
          className="flex items-center gap-2 px-4 py-1.5 rounded-md text-sm font-medium bg-danger/10 text-danger border border-danger/30 hover:bg-danger/20 transition-all"
          onClick={stopRecording}
        >
          <Square size={11} className="fill-current" />
          Stop Recording
        </button>
      </div>
    );
  }

  // ─── SETUP MODAL ───────────────────────────────────────────────────────────
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div ref={trapRef} className="relative bg-bg-elevated border border-border rounded-xl w-full max-w-md mx-4 overflow-hidden shadow-2xl animate-slide-up">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-danger/10 flex items-center justify-center">
              <Circle size={16} className="text-danger fill-danger" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-text-primary">Record Test</h2>
              <p className="text-xs text-text-tertiary">Interact with your app to capture test steps</p>
            </div>
          </div>
          <button
            className="p-1.5 rounded-md text-text-tertiary hover:text-text-primary hover:bg-bg-hover transition-all"
            onClick={onClose}
          >
            <X size={16} />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-5">
          {/* URL Input */}
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-2">
              <Globe size={11} className="inline mr-1.5 -mt-0.5" />
              Starting URL
            </label>
            <input
              ref={urlInputRef}
              className="w-full px-4 py-3 text-sm bg-bg-input border border-border-subtle rounded-lg outline-none focus:border-accent focus:ring-1 focus:ring-accent/30 transition-all placeholder:text-text-tertiary"
              placeholder="https://your-app.com/login"
              value={url}
              onChange={e => setUrl(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && startRecording()}
            />
          </div>

          {/* Recent URLs */}
          {recentUrls.length > 0 && !url && (
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-[11px] font-medium text-text-tertiary uppercase tracking-wide">Recent</label>
                <button
                  className="text-[11px] text-text-tertiary hover:text-danger transition-colors"
                  onClick={clearRecentUrls}
                >
                  Clear
                </button>
              </div>
              <div className="space-y-1">
                {recentUrls.map((recentUrl, i) => (
                  <button
                    key={i}
                    className="w-full text-left px-3 py-2 text-xs font-mono text-text-secondary bg-bg-secondary rounded-md hover:bg-bg-hover hover:text-text-primary transition-all truncate"
                    onClick={() => setUrl(recentUrl)}
                  >
                    {recentUrl}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Info */}
          <div className="flex gap-3 p-3.5 rounded-lg bg-accent/5 border border-accent/15">
            <Eye size={14} className="text-accent shrink-0 mt-0.5" />
            <div className="text-xs text-text-secondary leading-relaxed">
              <p className="font-medium text-text-primary mb-1">How it works</p>
              A browser window will open. Click, type, and navigate — every action is captured as a test step in real time. Toggle to <strong>Assert mode</strong> to record assertions instead of actions.
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2.5 px-6 py-4 border-t border-border bg-bg-secondary/50">
          <button
            className="px-4 py-2.5 rounded-lg text-sm font-medium bg-bg-tertiary text-text-primary hover:bg-border transition-all"
            onClick={onClose}
          >
            Cancel
          </button>
          <button
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium bg-danger text-white hover:bg-danger/90 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            onClick={startRecording}
            disabled={!url || !url.startsWith('http')}
          >
            <Circle size={12} className="fill-current" />
            Start Recording
          </button>
        </div>
      </div>
    </div>
  );
}
