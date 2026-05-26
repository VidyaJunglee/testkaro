import React, { useState, useMemo } from 'react';
import { EditorBlock } from '../blocks';
import {
  Search, Navigation, MousePointer, CheckCircle, Globe, GitBranch, Database,
  ChevronRight, ChevronDown, GripVertical,
} from 'lucide-react';

interface Props {
  blocks: EditorBlock[];
  onAdd: (type: string) => void;
}

const CATEGORY_META: Record<string, { icon: React.ReactNode; color: string }> = {
  navigation: { icon: <Navigation size={12} />, color: '#4CAF50' },
  interaction: { icon: <MousePointer size={12} />, color: '#2196F3' },
  assertion: { icon: <CheckCircle size={12} />, color: '#FF9800' },
  api: { icon: <Globe size={12} />, color: '#9C27B0' },
  logic: { icon: <GitBranch size={12} />, color: '#607D8B' },
  data: { icon: <Database size={12} />, color: '#00BCD4' },
};

export function ActionPalette({ blocks, onAdd }: Props) {
  const [search, setSearch] = useState('');
  const [expandedCategory, setExpandedCategory] = useState<string>('navigation');

  const categories = useMemo(() => {
    const cats = new Map<string, EditorBlock[]>();
    blocks.forEach(b => {
      if (!cats.has(b.category)) cats.set(b.category, []);
      cats.get(b.category)!.push(b);
    });
    return cats;
  }, [blocks]);

  const filtered = useMemo(() => {
    if (!search) return null;
    const q = search.toLowerCase();
    return blocks.filter(b =>
      b.label.toLowerCase().includes(q) ||
      b.type.toLowerCase().includes(q) ||
      b.description?.toLowerCase().includes(q)
    );
  }, [blocks, search]);

  return (
    <div className="w-56 bg-bg-secondary border-r border-border flex flex-col h-full shrink-0">
      {/* Search */}
      <div className="p-2.5 border-b border-border">
        <div className="flex items-center gap-2 px-2.5 py-1.5 bg-bg-input border border-border-subtle rounded text-xs">
          <Search size={12} className="text-text-tertiary shrink-0" />
          <input
            className="flex-1 bg-transparent outline-none text-text-primary placeholder:text-text-tertiary"
            placeholder="Search actions..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
      </div>

      {/* Block list */}
      <div className="flex-1 overflow-y-auto py-1">
        {filtered ? (
          /* Search results */
          <div className="px-1.5 space-y-0.5">
            {filtered.length === 0 && (
              <p className="text-xs text-text-tertiary text-center py-4">No matching actions</p>
            )}
            {filtered.map(block => (
              <BlockButton key={block.type} block={block} onAdd={onAdd} />
            ))}
          </div>
        ) : (
          /* Categorized */
          Array.from(categories.entries()).map(([category, categoryBlocks]) => {
            const meta = CATEGORY_META[category] || { icon: null, color: '#666' };
            const isExpanded = expandedCategory === category;

            return (
              <div key={category}>
                <button
                  className="w-full flex items-center gap-2 px-3 py-2 text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-bg-hover transition-all"
                  onClick={() => setExpandedCategory(isExpanded ? '' : category)}
                >
                  <span style={{ color: meta.color }}>{meta.icon}</span>
                  <span className="capitalize flex-1 text-left">{category}</span>
                  <span className="text-[10px] text-text-tertiary bg-bg-tertiary px-1.5 py-0.5 rounded">{categoryBlocks.length}</span>
                  {isExpanded ? <ChevronDown size={10} /> : <ChevronRight size={10} />}
                </button>
                {isExpanded && (
                  <div className="px-1.5 pb-1 space-y-0.5">
                    {categoryBlocks.map(block => (
                      <BlockButton key={block.type} block={block} onAdd={onAdd} />
                    ))}
                  </div>
                )}
              </div>
            );
          })
        )}
      </div>

      {/* Footer hint */}
      <div className="px-3 py-2 border-t border-border text-[10px] text-text-tertiary">
        <kbd className="px-1 py-0.5 bg-bg-tertiary rounded border border-border-subtle">Cmd+K</kbd> command palette
      </div>
    </div>
  );
}

function BlockButton({ block, onAdd }: { block: EditorBlock; onAdd: (type: string) => void }) {
  return (
    <button
      className="w-full flex items-center gap-2 px-2.5 py-2 rounded text-left hover:bg-bg-hover group transition-all"
      onClick={() => onAdd(block.type)}
      title={block.description}
    >
      <div
        className="w-1 h-6 rounded-full shrink-0"
        style={{ backgroundColor: block.color }}
      />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-text-primary truncate">{block.label}</p>
        {block.description && (
          <p className="text-[10px] text-text-tertiary truncate">{block.description}</p>
        )}
      </div>
      <span className="text-text-tertiary opacity-0 group-hover:opacity-100 transition-opacity">
        <GripVertical size={10} />
      </span>
    </button>
  );
}
