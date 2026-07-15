import React, { useState, useRef, useEffect } from 'react';
import { Play, ChevronDown } from 'lucide-react';
import { useStore } from '../store';
import { RunMode } from '../store/executionSlice';

interface Props {
  onRun: () => void;
  disabled: boolean;
}

const modes: { value: RunMode; label: string; description: string }[] = [
  { value: 'current', label: 'Run Current', description: 'Run active test only' },
  { value: 'module', label: 'Run Module', description: 'Run all tests in active module' },
  { value: 'all', label: 'Run All Tests', description: 'Run all tests sequentially' },
  { value: 'all-modules', label: 'Run All Modules', description: 'Run every module sequentially' },
];

export function RunDropdown({ onRun, disabled }: Props) {
  const [open, setOpen] = useState(false);
  const runMode = useStore(s => s.runMode);
  const setRunMode = useStore(s => s.setRunMode);
  const ref = useRef<HTMLDivElement>(null);

  const activeMode = modes.find(m => m.value === runMode) || modes[0];

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <div className="flex items-stretch">
        {/* Main run button */}
        <button
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-l text-xs font-medium bg-accent hover:bg-accent-hover text-on-accent transition-all disabled:opacity-50"
          onClick={onRun}
          disabled={disabled}
        >
          <Play size={12} />
          {activeMode.label}
        </button>

        {/* Dropdown toggle */}
        <button
          className="flex items-center px-1.5 rounded-r text-white bg-accent hover:bg-accent-hover border-l border-white/20 transition-all disabled:opacity-50"
          onClick={() => setOpen(!open)}
          disabled={disabled}
        >
          <ChevronDown size={12} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>
      </div>

      {/* Dropdown menu */}
      {open && (
        <div className="absolute right-0 top-full mt-1 w-48 rounded-lg border border-border bg-bg-secondary shadow-lg z-50 overflow-hidden animate-fade-in">
          {modes.map(mode => (
            <button
              key={mode.value}
              className={`w-full text-left px-3 py-2 text-xs transition-colors ${
                mode.value === runMode
                  ? 'bg-accent/10 text-accent font-medium'
                  : 'text-text-primary hover:bg-bg-hover'
              }`}
              onClick={() => {
                setRunMode(mode.value);
                setOpen(false);
              }}
            >
              <div className="font-medium">{mode.label}</div>
              <div className="text-[10px] text-text-tertiary mt-0.5">{mode.description}</div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
