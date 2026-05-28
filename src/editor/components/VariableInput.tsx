import React, { useState, useRef, useEffect, useCallback } from 'react';
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
 * An input (or textarea) that shows a variable autocomplete dropdown
 * when the user types `{{`. Suggests variables from the active environment.
 */
export function VariableInput({ value, onChange, className, placeholder, onClick, type = 'text' }: Props) {
  const [showDropdown, setShowDropdown] = useState(false);
  const [filter, setFilter] = useState('');
  const [caretPos, setCaretPos] = useState(0);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0 });
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const getActiveVariables = useStore(s => s.getActiveVariables);
  const variables = getActiveVariables();
  const varEntries = Object.entries(variables);

  const filtered = filter
    ? varEntries.filter(([key]) => key.toLowerCase().includes(filter.toLowerCase()))
    : varEntries;

  const handleInput = useCallback((newValue: string, selStart: number) => {
    onChange(newValue);

    // Check if we just typed `{{` or are inside `{{...`
    const before = newValue.slice(0, selStart);
    const match = before.match(/\{\{(\w*)$/);
    if (match) {
      setFilter(match[1]);
      setCaretPos(selStart);
      setShowDropdown(true);
      setSelectedIdx(0);

      // Position dropdown near caret
      if (inputRef.current) {
        const rect = inputRef.current.getBoundingClientRect();
        // Approximate: use input top + height for dropdown
        setDropdownPos({ top: rect.height + 2, left: Math.min(selStart * 7, rect.width - 100) });
      }
    } else {
      setShowDropdown(false);
    }
  }, [onChange]);

  const insertVariable = useCallback((varName: string) => {
    const before = value.slice(0, caretPos);
    const match = before.match(/\{\{(\w*)$/);
    if (!match) return;

    const start = caretPos - match[0].length;
    const after = value.slice(caretPos);
    // Check if there's already a closing `}}`
    const closingMatch = after.match(/^\w*\}\}/);
    const end = closingMatch ? caretPos + closingMatch[0].length : caretPos;

    const newValue = value.slice(0, start) + `{{${varName}}}` + value.slice(end);
    onChange(newValue);
    setShowDropdown(false);

    // Refocus input
    setTimeout(() => {
      const newCaret = start + varName.length + 4; // {{varName}}
      inputRef.current?.setSelectionRange(newCaret, newCaret);
      inputRef.current?.focus();
    }, 0);
  }, [value, caretPos, onChange]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showDropdown || filtered.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIdx(i => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIdx(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      if (showDropdown && filtered.length > 0) {
        e.preventDefault();
        insertVariable(filtered[selectedIdx][0]);
      }
    } else if (e.key === 'Escape') {
      setShowDropdown(false);
    }
  };

  // Close dropdown on blur (with delay for click)
  const handleBlur = () => {
    setTimeout(() => setShowDropdown(false), 150);
  };

  const commonProps = {
    ref: inputRef as any,
    className,
    value,
    placeholder,
    onClick,
    onBlur: handleBlur,
    onKeyDown: handleKeyDown,
    onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      handleInput(e.target.value, e.target.selectionStart || 0);
    },
    onSelect: (e: React.SyntheticEvent<HTMLInputElement | HTMLTextAreaElement>) => {
      // Update caret position on selection change (for repositioning dropdown)
      const target = e.target as HTMLInputElement;
      const pos = target.selectionStart || 0;
      const before = value.slice(0, pos);
      const match = before.match(/\{\{(\w*)$/);
      if (match && showDropdown) {
        setFilter(match[1]);
        setCaretPos(pos);
      }
    },
  };

  return (
    <div className="relative flex-1">
      {type === 'textarea' ? (
        <textarea {...commonProps} />
      ) : (
        <input type="text" {...commonProps} />
      )}

      {showDropdown && filtered.length > 0 && (
        <div
          ref={dropdownRef}
          className="absolute z-50 mt-0.5 w-52 max-h-32 overflow-y-auto bg-bg-secondary border border-border rounded-lg shadow-lg"
          style={{ top: dropdownPos.top, left: Math.max(0, dropdownPos.left) }}
        >
          {filtered.map(([key, val], idx) => (
            <button
              key={key}
              className={`w-full flex items-center gap-2 px-2.5 py-1.5 text-xs text-left transition-all ${
                idx === selectedIdx ? 'bg-accent/10 text-accent' : 'text-text-secondary hover:bg-bg-hover'
              }`}
              onMouseDown={(e) => { e.preventDefault(); insertVariable(key); }}
            >
              <Variable size={10} className="text-text-tertiary shrink-0" />
              <span className="font-mono font-medium truncate">{key}</span>
              <span className="ml-auto text-[10px] text-text-tertiary truncate max-w-20">{val}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
