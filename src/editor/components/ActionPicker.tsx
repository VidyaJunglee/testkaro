import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
  Search, X, ChevronDown, ChevronRight,
  Globe, MousePointer2, ShieldCheck, Wifi, GitBranch, Database, Smartphone,
} from 'lucide-react';
import { BLOCKS, EditorBlock } from '../blocks';
import { BlockCategory } from '../../schema';
import { useStore, useActionPickerOpen } from '../store';

interface CategoryMeta {
  key: BlockCategory;
  label: string;
  icon: React.ReactNode;
  color: string;
}

const CATEGORIES: CategoryMeta[] = [
  { key: 'navigation', label: 'Navigation', icon: <Globe size={14} />, color: '#4CAF50' },
  { key: 'interaction', label: 'Interaction', icon: <MousePointer2 size={14} />, color: '#2196F3' },
  { key: 'assertion', label: 'Assertion', icon: <ShieldCheck size={14} />, color: '#FF9800' },
  { key: 'api', label: 'API', icon: <Wifi size={14} />, color: '#9C27B0' },
  { key: 'logic', label: 'Logic', icon: <GitBranch size={14} />, color: '#607D8B' },
  { key: 'data', label: 'Data', icon: <Database size={14} />, color: '#00BCD4' },
  { key: 'mobile', label: 'Mobile', icon: <Smartphone size={14} />, color: '#E91E63' },
];

interface Props {
  onAddBlock: (blockType: string) => void;
}

export function ActionPicker({ onAddBlock }: Props) {
  const open = useActionPickerOpen();
  const [query, setQuery] = useState('');
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(CATEGORIES.map(c => c.key)));
  const [hoveredBlock, setHoveredBlock] = useState<EditorBlock | null>(null);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  // Filter blocks by search
  const filteredBlocks = useMemo(() => {
    if (!query.trim()) return BLOCKS;
    const q = query.toLowerCase();
    return BLOCKS.filter(b =>
      b.label.toLowerCase().includes(q) ||
      b.type.toLowerCase().includes(q) ||
      b.description?.toLowerCase().includes(q) ||
      b.category.toLowerCase().includes(q)
    );
  }, [query]);

  // Group by category
  const grouped = useMemo(() => {
    const map = new Map<BlockCategory, EditorBlock[]>();
    for (const block of filteredBlocks) {
      const list = map.get(block.category) || [];
      list.push(block);
      map.set(block.category, list);
    }
    return map;
  }, [filteredBlocks]);

  // Flat list for keyboard nav
  const flatList = useMemo(() => {
    const items: EditorBlock[] = [];
    for (const cat of CATEGORIES) {
      if (!expandedCategories.has(cat.key)) continue;
      const blocks = grouped.get(cat.key);
      if (blocks) items.push(...blocks);
    }
    return items;
  }, [grouped, expandedCategories]);

  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIndex(0);
      setHoveredBlock(null);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  // Update hovered block based on selectedIndex
  useEffect(() => {
    if (flatList[selectedIndex]) {
      setHoveredBlock(flatList[selectedIndex]);
    }
  }, [selectedIndex, flatList]);

  const close = () => {
    const s = useStore.getState();
    s.setActionPickerOpen(false);
    s.setAddBlockTargetContainerId(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { close(); return; }
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(i => Math.min(i + 1, flatList.length - 1));
    }
    if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(i => Math.max(i - 1, 0));
    }
    if (e.key === 'Enter' && flatList[selectedIndex]) {
      e.preventDefault();
      onAddBlock(flatList[selectedIndex].type);
      close();
    }
  };

  const toggleCategory = (key: string) => {
    setExpandedCategories(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[10vh]" onClick={close}>
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" />
      <div
        className="relative w-[720px] max-h-[70vh] bg-bg-secondary border border-border rounded-xl shadow-2xl flex overflow-hidden"
        onClick={e => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Left: Search + Categories */}
        <div className="flex-1 flex flex-col min-w-0 border-r border-border">
          {/* Search */}
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border">
            <Search size={14} className="text-text-tertiary shrink-0" />
            <input
              ref={inputRef}
              className="flex-1 bg-transparent text-sm text-text-primary placeholder:text-text-tertiary outline-none"
              placeholder="Search actions..."
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
            <button onClick={close} className="p-1 rounded hover:bg-bg-hover text-text-tertiary">
              <X size={14} />
            </button>
          </div>

          {/* Accordion list */}
          <div className="flex-1 overflow-y-auto py-2">
            {CATEGORIES.map(cat => {
              const blocks = grouped.get(cat.key);
              if (!blocks || blocks.length === 0) return null;
              const isExpanded = expandedCategories.has(cat.key);

              return (
                <div key={cat.key}>
                  <button
                    className="w-full flex items-center gap-2 px-4 py-1.5 text-xs font-semibold text-text-secondary hover:bg-bg-hover transition-colors"
                    onClick={() => toggleCategory(cat.key)}
                  >
                    {isExpanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                    <span style={{ color: cat.color }}>{cat.icon}</span>
                    {cat.label}
                    <span className="ml-auto text-[10px] text-text-tertiary font-normal">{blocks.length}</span>
                  </button>

                  {isExpanded && (
                    <div className="pb-1">
                      {blocks.map(block => {
                        const globalIdx = flatList.indexOf(block);
                        const isSelected = globalIdx === selectedIndex;
                        return (
                          <button
                            key={block.type}
                            className={`w-full flex items-center gap-2 px-6 py-1.5 text-xs text-left transition-all ${
                              isSelected
                                ? 'bg-accent/10 text-accent'
                                : 'text-text-secondary hover:bg-bg-hover hover:text-text-primary'
                            }`}
                            onMouseEnter={() => { setHoveredBlock(block); setSelectedIndex(globalIdx); }}
                            onClick={() => { onAddBlock(block.type); close(); }}
                          >
                            <div className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: block.color }} />
                            {block.label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}

            {filteredBlocks.length === 0 && (
              <div className="px-4 py-8 text-center text-xs text-text-tertiary">
                No actions match "{query}"
              </div>
            )}
          </div>

          {/* Footer hint */}
          <div className="px-4 py-2 border-t border-border text-[10px] text-text-tertiary flex items-center gap-3">
            <span><kbd className="px-1 py-0.5 bg-bg-tertiary rounded border border-border-subtle">↑↓</kbd> Navigate</span>
            <span><kbd className="px-1 py-0.5 bg-bg-tertiary rounded border border-border-subtle">Enter</kbd> Add</span>
            <span><kbd className="px-1 py-0.5 bg-bg-tertiary rounded border border-border-subtle">Esc</kbd> Close</span>
          </div>
        </div>

        {/* Right: Preview panel */}
        <div className="w-56 p-4 flex flex-col">
          {hoveredBlock ? (
            <>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: hoveredBlock.color }} />
                <span className="text-sm font-medium text-text-primary">{hoveredBlock.label}</span>
              </div>
              <p className="text-xs text-text-secondary mb-4">{hoveredBlock.description || 'No description'}</p>
              <div className="text-[10px] text-text-tertiary uppercase font-semibold mb-2">Parameters</div>
              <div className="flex flex-col gap-1.5">
                {hoveredBlock.inputs.map(input => (
                  <div key={input.name} className="flex items-center gap-1.5 text-xs">
                    <span className="text-text-secondary">{input.label}</span>
                    {input.required && <span className="text-danger text-[9px]">*</span>}
                  </div>
                ))}
                {hoveredBlock.inputs.length === 0 && (
                  <span className="text-xs text-text-tertiary italic">No parameters</span>
                )}
              </div>
            </>
          ) : (
            <div className="flex-1 flex items-center justify-center text-xs text-text-tertiary">
              Hover an action to preview
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
