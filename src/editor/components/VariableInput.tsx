import React, { useState, useRef, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '../store';
import { Variable } from 'lucide-react';

interface Props {
  value: string;
  onChange: (value: string) => void;
  className?: string;
  placeholder?: string;
  onClick?: (e: React.MouseEvent) => void;
  type?: 'text' | 'textarea';
}

/**
 * Input/textarea that shows a variable autocomplete when user types `@`.
 * Variables come from merged global + local active environments.
 * Uses a portal for the dropdown to avoid z-index / overflow clipping issues.
 */
export function VariableInput({ value, onChange, className, placeholder, onClick, type = 'text' }: Props) {
  const [localValue, setLocalValue] = useState(value);
  const [showDropdown, setShowDropdown] = useState(false);
  const [filter, setFilter] = useState('');
  const [caretPos, setCaretPos] = useState(0);
  const [dropdownRect, setDropdownRect] = useState<{ top: number; left: number; width: number } | null>(null);
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  useEffect(() => {
    if (document.activeElement !== inputRef.current) {
      setLocalValue(value);
    }
  }, [value]);

  const getActiveVariables = useStore(s => s.getActiveVariables);
  const variables = getActiveVariables();
  const varEntries = Object.entries(variables);

  const filtered = filter
    ? varEntries.filter(([key]) => key.toLowerCase().includes(filter.toLowerCase()))
    : varEntries;

  const flushValue = useCallback((val: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = null;
    onChangeRef.current(val);
  }, []);

  const positionDropdown = useCallback(() => {
    if (!inputRef.current) return;
    const rect = inputRef.current.getBoundingClientRect();
    setDropdownRect({
      top: rect.bottom + 4,
      left: rect.left,
      width: Math.max(220, rect.width),
    });
  }, []);

  const handleInput = useCallback((newValue: string, selStart: number) => {
    setLocalValue(newValue);

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      onChangeRef.current(newValue);
      debounceRef.current = null;
    }, 300);

    const before = newValue.slice(0, selStart);
    const matchAt = before.match(/@(\w*)$/);

    if (matchAt) {
      setFilter(matchAt[1]);
      setCaretPos(selStart);
      setShowDropdown(true);
      setSelectedIdx(0);
      positionDropdown();
    } else {
      setShowDropdown(false);
    }
  }, [positionDropdown]);

  const handleBlur = useCallback(() => {
    if (debounceRef.current) flushValue(localValue);
    setTimeout(() => setShowDropdown(false), 150);
  }, [localValue, flushValue]);

  useEffect(() => {
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, []);

  // Reposition on scroll/resize
  useEffect(() => {
    if (!showDropdown) return;
    const update = () => positionDropdown();
    window.addEventListener('scroll', update, true);
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update, true);
      window.removeEventListener('resize', update);
    };
  }, [showDropdown, positionDropdown]);

  const insertVariable = useCallback((varName: string) => {
    const before = localValue.slice(0, caretPos);
    const match = before.match(/@(\w*)$/);
    if (!match) return;
    const start = caretPos - match[0].length;
    const end = caretPos;

    const newValue = localValue.slice(0, start) + `{{${varName}}}` + localValue.slice(end);
    setLocalValue(newValue);
    flushValue(newValue);
    setShowDropdown(false);

    setTimeout(() => {
      const newCaret = start + varName.length + 4;
      inputRef.current?.setSelectionRange(newCaret, newCaret);
      inputRef.current?.focus();
    }, 0);
  }, [localValue, caretPos, flushValue]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown || filtered.length === 0) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); setSelectedIdx(i => Math.min(i + 1, filtered.length - 1)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setSelectedIdx(i => Math.max(i - 1, 0)); }
    else if (e.key === 'Enter' || e.key === 'Tab') {
      if (showDropdown && filtered.length > 0) { e.preventDefault(); insertVariable(filtered[selectedIdx][0]); }
    } else if (e.key === 'Escape') { setShowDropdown(false); }
  };

  const commonProps = {
    ref: inputRef as any,
    className,
    value: localValue,
    placeholder,
    onClick,
    onBlur: handleBlur,
    onKeyDown: handleKeyDown,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      handleInput(e.target.value, e.target.selectionStart || 0);
    },
    onSelect: (e: React.SyntheticEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      const target = e.target as HTMLInputElement;
      const pos = target.selectionStart || 0;
      const before = localValue.slice(0, pos);
      const matchAt = before.match(/@(\w*)$/);
      if (matchAt && showDropdown) {
        setFilter(matchAt[1]);
        setCaretPos(pos);
      }
    },
  };

  const dropdown = showDropdown && (
    <div
      className="fixed z-[9999] w-56 max-h-48 overflow-y-auto bg-bg-elevated border border-border rounded-xl shadow-xl animate-glass-reveal"
      style={dropdownRect ? { top: dropdownRect.top, left: dropdownRect.left, minWidth: dropdownRect.width } : {}}
      onMouseDown={e => e.preventDefault()}
    >
      {filtered.length > 0 ? (
        <>
          <div className="px-3 py-1.5 border-b border-border-subtle flex items-center gap-1.5">
            <Variable size={10} className="text-accent" />
            <span className="text-[10px] text-text-tertiary font-medium uppercase tracking-wide">
              Insert variable
            </span>
            {filter && (
              <span className="ml-auto text-[10px] text-text-tertiary">{filtered.length} match{filtered.length !== 1 ? 'es' : ''}</span>
            )}
          </div>
          {filtered.map(([key, val], idx) => (
            <button
              key={key}
              className={`w-full flex items-center gap-2 px-3 py-1.5 text-xs text-left transition-all ${
                idx === selectedIdx ? 'bg-accent/10 text-accent' : 'text-text-secondary hover:bg-bg-hover'
              }`}
              onMouseDown={(e) => { e.preventDefault(); insertVariable(key); }}
            >
              <code className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                idx === selectedIdx ? 'bg-accent/20 text-accent' : 'bg-bg-tertiary text-text-tertiary'
              }`}>
                {key}
              </code>
              <span className="ml-auto text-[10px] text-text-tertiary truncate max-w-[80px]">{String(val)}</span>
            </button>
          ))}
        </>
      ) : (
        <div className="px-3 py-2.5 text-[11px] text-text-tertiary">
          No variables match "{filter}"
        </div>
      )}
    </div>
  );

  return (
    <div className="relative flex-1">
      {type === 'textarea' ? (
        <textarea {...commonProps} />
      ) : (
        <input type="text" {...commonProps} />
      )}
      {showDropdown && dropdownRect && createPortal(dropdown, document.body)}
    </div>
  );
}
