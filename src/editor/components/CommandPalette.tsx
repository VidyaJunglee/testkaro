import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Search, Play, Circle, Plus, FileText } from 'lucide-react';
import { EditorBlock } from '../blocks';

interface Command {
  id: string;
  label: string;
  description?: string;
  category: string;
  icon?: React.ReactNode;
  action: () => void;
  keywords?: string[];
}

interface Props {
  open: boolean;
  onClose: () => void;
  blocks: EditorBlock[];
  onAddBlock: (type: string) => void;
  onRunTests: () => void;
  onRecord: () => void;
  onNewFile: () => void;
}

export function CommandPalette({ open, onClose, blocks, onAddBlock, onRunTests, onRecord, onNewFile }: Props) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const commands = useMemo((): Command[] => {
    const cmds: Command[] = [
      { id: 'run', label: 'Run Tests', description: 'Execute all steps', category: 'Actions', icon: <Play size={14} />, action: onRunTests, keywords: ['execute', 'start'] },
      { id: 'record', label: 'Start Recording', description: 'Record browser actions', category: 'Actions', icon: <Circle size={14} className="fill-danger text-danger" />, action: onRecord, keywords: ['capture'] },
      { id: 'new-file', label: 'New Test File', description: 'Create a new test file', category: 'Actions', icon: <FileText size={14} />, action: onNewFile, keywords: ['create'] },
    ];

    // Add blocks as commands
    blocks.forEach(block => {
      cmds.push({
        id: `add-${block.type}`,
        label: `Add: ${block.label}`,
        description: block.description,
        category: block.category,
        icon: <Plus size={14} />,
        action: () => onAddBlock(block.type),
        keywords: [block.type, block.category],
      });
    });

    return cmds;
  }, [blocks, onAddBlock, onRunTests, onRecord, onNewFile]);

  const filtered = useMemo(() => {
    if (!query) return commands;
    const q = query.toLowerCase();
    return commands.filter(c =>
      c.label.toLowerCase().includes(q) ||
      c.description?.toLowerCase().includes(q) ||
      c.keywords?.some(k => k.includes(q)) ||
      c.category.toLowerCase().includes(q)
    );
  }, [commands, query]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Scroll selected into view
  useEffect(() => {
    const el = listRef.current?.children[selectedIndex] as HTMLElement;
    el?.scrollIntoView({ block: 'nearest' });
  }, [selectedIndex]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const cmd = filtered[selectedIndex];
      if (cmd) { cmd.action(); onClose(); }
    } else if (e.key === 'Escape') {
      onClose();
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh]" onClick={onClose}>
      <div className="absolute inset-0 bg-black/20 backdrop-blur-sm" />
      <div
        className="relative w-[560px] max-h-[420px] bg-bg-primary border border-border rounded-xl shadow-2xl flex flex-col overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
          <Search size={16} className="text-text-tertiary shrink-0" />
          <input
            ref={inputRef}
            className="flex-1 text-sm bg-transparent outline-none text-text-primary placeholder:text-text-tertiary"
            placeholder="Search commands, add steps..."
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
          />
          <kbd className="px-1.5 py-0.5 rounded text-[10px] bg-bg-tertiary text-text-tertiary border border-border-subtle">ESC</kbd>
        </div>

        {/* Results */}
        <div ref={listRef} className="flex-1 overflow-y-auto py-1">
          {filtered.length === 0 && (
            <p className="text-sm text-text-tertiary text-center py-8">No matching commands</p>
          )}
          {filtered.map((cmd, i) => (
            <button
              key={cmd.id}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                i === selectedIndex ? 'bg-accent/10 text-accent' : 'text-text-primary hover:bg-bg-hover'
              }`}
              onClick={() => { cmd.action(); onClose(); }}
              onMouseEnter={() => setSelectedIndex(i)}
            >
              <span className={`shrink-0 ${i === selectedIndex ? 'text-accent' : 'text-text-tertiary'}`}>
                {cmd.icon}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{cmd.label}</p>
                {cmd.description && <p className="text-xs text-text-tertiary truncate">{cmd.description}</p>}
              </div>
              <span className="text-[10px] text-text-tertiary uppercase tracking-wider">{cmd.category}</span>
            </button>
          ))}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 px-4 py-2 border-t border-border text-[10px] text-text-tertiary">
          <span><kbd className="px-1 py-0.5 rounded bg-bg-tertiary border border-border-subtle mr-1">↑↓</kbd> navigate</span>
          <span><kbd className="px-1 py-0.5 rounded bg-bg-tertiary border border-border-subtle mr-1">↵</kbd> select</span>
          <span><kbd className="px-1 py-0.5 rounded bg-bg-tertiary border border-border-subtle mr-1">esc</kbd> close</span>
        </div>
      </div>
    </div>
  );
}
