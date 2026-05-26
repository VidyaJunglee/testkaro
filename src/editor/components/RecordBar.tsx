import React, { useState, useRef, useCallback, useEffect } from 'react';
import { Circle, Square, Pause, Play } from 'lucide-react';
import { TestStep } from '../../schema';

interface Props {
  onStepRecorded: (step: TestStep) => void;
  onRecordingStateChange: (recording: boolean) => void;
}

interface SelectorSuggestion {
  type: string;
  value: string;
  confidence: number;
}

export function RecordBar({ onStepRecorded, onRecordingStateChange }: Props) {
  const [recording, setRecording] = useState(false);
  const [url, setUrl] = useState('https://');
  const [stepCount, setStepCount] = useState(0);
  const [connected, setConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);

  const startRecording = useCallback(() => {
    if (!url || url === 'https://') return;

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
      } else if (msg.type === 'record-step') {
        const step = msg.data.step as TestStep;
        onStepRecorded(step);
        setStepCount(c => c + 1);
      } else if (msg.type === 'record-done') {
        setRecording(false);
        onRecordingStateChange(false);
        setConnected(false);
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
  }, [onRecordingStateChange]);

  // Cleanup WebSocket on unmount
  useEffect(() => {
    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
    };
  }, []);

  return (
    <div className="flex items-center gap-2 px-3 py-2 bg-bg-secondary border-b border-border">
      {!recording ? (
        <>
          <input
            className="flex-1 px-3 py-1.5 text-sm bg-bg-input border border-border-subtle rounded outline-none focus:border-border-active transition-all"
            placeholder="Enter URL to record (e.g., https://example.com)"
            value={url}
            onChange={e => setUrl(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && startRecording()}
          />
          <button
            className="flex items-center gap-2 px-4 py-2 rounded text-sm font-medium bg-danger text-white hover:bg-danger/80 transition-all disabled:opacity-50"
            onClick={startRecording}
            disabled={!url || url === 'https://'}
          >
            <Circle size={12} className="fill-current" />
            Record
          </button>
        </>
      ) : (
        <>
          <div className="flex items-center gap-2 flex-1">
            <span className="w-2.5 h-2.5 bg-danger rounded-full animate-pulse" />
            <span className="text-sm font-medium text-danger">Recording</span>
            <span className="text-xs text-text-tertiary">({stepCount} steps captured)</span>
          </div>
          <button
            className="flex items-center gap-2 px-4 py-2 rounded text-sm font-medium bg-bg-tertiary text-text-primary hover:bg-border transition-all"
            onClick={stopRecording}
          >
            <Square size={12} />
            Stop
          </button>
        </>
      )}
    </div>
  );
}
