import React, { useState, useRef, useEffect } from 'react';
import { ChevronDown, Check, Target } from 'lucide-react';

export interface SelectorSuggestion {
  type: string;
  value: string;
  confidence: number;
}

interface Props {
  suggestions: SelectorSuggestion[];
  currentSelector: string;
  onSelect: (selector: string) => void;
  autoOpen?: boolean;
}

const TYPE_LABELS: Record<string, string> = {
  testid: 'Test ID',
  id: 'ID',
  aria: 'Aria Label',
  placeholder: 'Placeholder',
  name: 'Name',
  role: 'Role',
  text: 'Text',
  css: 'CSS Path',
};

const TYPE_COLORS: Record<string, string> = {
  testid: 'text-emerald-400',
  id: 'text-blue-400',
  aria: 'text-purple-400',
  placeholder: 'text-amber-400',
  name: 'text-cyan-400',
  role: 'text-indigo-400',
  text: 'text-pink-400',
  css: 'text-text-tertiary',
};

export function SelectorPicker({ suggestions, currentSelector, onSelect, autoOpen }: Props) {
  const [open, setOpen] = useState(!!autoOpen);
  const ref = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  if (!suggestions || suggestions.length <= 1) return null;

  const sorted = [...suggestions].sort((a, b) => b.confidence - a.confidence);
  const currentType = sorted.find(s => s.value === currentSelector)?.type || 'css';

  return (
    <div ref={ref} className="relative inline-flex">
      <button
        className="flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-accent/10 text-accent hover:bg-accent/20 transition-all"
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        title="Choose alternative selector"
      >
        <Target size={10} />
        {sorted.length} selectors
        <ChevronDown size={9} />
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-1 w-72 bg-bg-elevated border border-border rounded-lg shadow-xl z-50 overflow-hidden">
          <div className="px-3 py-2 border-b border-border text-[11px] font-medium text-text-tertiary uppercase tracking-wide">
            Selector Suggestions
          </div>
          <div className="max-h-48 overflow-y-auto">
            {sorted.map((suggestion, i) => (
              <button
                key={i}
                className={`w-full flex items-center gap-2 px-3 py-2 text-left hover:bg-bg-hover transition-colors ${
                  suggestion.value === currentSelector ? 'bg-accent/5' : ''
                }`}
                onClick={(e) => {
                  e.stopPropagation();
                  onSelect(suggestion.value);
                  setOpen(false);
                }}
              >
                <span className={`text-[10px] font-mono w-16 shrink-0 ${TYPE_COLORS[suggestion.type] || 'text-text-tertiary'}`}>
                  {TYPE_LABELS[suggestion.type] || suggestion.type}
                </span>
                <span className="text-xs text-text-primary font-mono truncate flex-1">
                  {suggestion.value}
                </span>
                <span className="text-[10px] text-text-tertiary shrink-0">
                  {Math.round(suggestion.confidence * 100)}%
                </span>
                {suggestion.value === currentSelector && (
                  <Check size={11} className="text-accent shrink-0" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
