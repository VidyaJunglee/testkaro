import React, { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { TestStep } from '../../schema';
import { EditorBlock } from '../blocks';
import { VariableInput } from './VariableInput';
import { GripVertical, Trash2, Copy, ChevronDown, ChevronRight, CircleDot } from 'lucide-react';

interface Props {
  step: TestStep;
  index: number;
  block?: EditorBlock;
  onUpdate: (params: Record<string, unknown>) => void;
  onRemove: () => void;
  onDuplicate: () => void;
  highlighted?: boolean;
  selected?: boolean;
  onSelect?: (e: React.MouseEvent) => void;
  hasBreakpoint?: boolean;
  onToggleBreakpoint?: () => void;
  showValidation?: boolean;
}

export function StepCard({ step, index, block, onUpdate, onRemove, onDuplicate, highlighted, selected, onSelect, hasBreakpoint, onToggleBreakpoint, showValidation }: Props) {
  const [expanded, setExpanded] = useState(true);

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: step.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const handleParamChange = (name: string, value: unknown) => {
    onUpdate({ ...step.params, [name]: value });
  };

  // Validation: check required fields
  const missingRequired = showValidation && block
    ? block.inputs.filter(i => i.required && !step.params[i.name])
    : [];
  const hasValidationError = missingRequired.length > 0;

  const borderColor = block?.color || '#6b7280';

  return (
    <div className="relative">
      {/* Connector line */}
      {index > 0 && (
        <div className="absolute left-6 -top-2.5 w-px h-2.5 bg-border" />
      )}

      <div
        ref={setNodeRef}
        style={style}
        className={`
          group bg-bg-card border rounded-lg transition-all duration-150
          ${isDragging ? 'opacity-40 shadow-lg scale-[1.02]' : 'hover:shadow-sm'}
          ${highlighted ? 'ring-2 ring-accent/50 bg-accent/5 border-accent/30' : 'border-border-subtle hover:border-border'}
          ${selected ? 'border-accent shadow-sm ring-1 ring-accent/30' : ''}
          ${hasValidationError && !selected && !highlighted ? 'border-danger/40' : ''}
        `}
        onClick={onSelect}
      >
        {/* Color indicator */}
        <div className="absolute left-0 top-2.5 bottom-2.5 w-[3px] rounded-full" style={{ backgroundColor: borderColor }} />

        {/* Breakpoint gutter */}
        <button
          className={`absolute -left-5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 rounded-full flex items-center justify-center transition-all ${
            hasBreakpoint
              ? 'bg-danger text-white'
              : 'opacity-0 group-hover:opacity-100 text-text-tertiary hover:text-danger hover:bg-danger/10'
          }`}
          onClick={(e) => { e.stopPropagation(); onToggleBreakpoint?.(); }}
          title={hasBreakpoint ? 'Remove breakpoint' : 'Add breakpoint'}
        >
          <CircleDot size={hasBreakpoint ? 9 : 8} />
        </button>

        {/* Header */}
        <div className="flex items-center gap-2.5 pl-5 pr-3 py-3">
          <div {...listeners} className="cursor-grab active:cursor-grabbing text-text-tertiary hover:text-text-secondary transition-colors p-0.5" {...attributes}>
            <GripVertical size={14} />
          </div>

          <span className="text-[11px] text-text-tertiary font-mono w-6">{index + 1}</span>

          <button
            className="p-0.5 text-text-tertiary hover:text-text-secondary"
            onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}
          >
            {expanded ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          </button>

          <span className="text-sm font-semibold text-text-primary">{block?.label || step.type}</span>

          {/* Inline param preview when collapsed */}
          {!expanded && block?.inputs[0] && (block.inputs[0].name in step.params) && (
            <span className="text-xs text-text-tertiary truncate max-w-[240px] ml-1">
              {String(step.params[block.inputs[0].name] ?? '')}
            </span>
          )}

          {/* Validation badge */}
          {hasValidationError && !expanded && (
            <span className="text-[10px] px-1.5 py-0.5 bg-danger/10 text-danger rounded font-medium ml-1">
              {missingRequired.length} required
            </span>
          )}

          <div className="ml-auto flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
            <button
              className="p-1.5 rounded text-text-tertiary hover:text-accent hover:bg-accent/5 transition-all"
              onClick={e => { e.stopPropagation(); onDuplicate(); }}
              title="Duplicate"
            >
              <Copy size={13} />
            </button>
            <button
              className="p-1.5 rounded text-text-tertiary hover:text-danger hover:bg-danger/5 transition-all"
              onClick={e => { e.stopPropagation(); onRemove(); }}
              title="Delete"
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>

        {/* Params */}
        {expanded && block && block.inputs.length > 0 && (
          <div className="pl-12 pr-4 pb-3.5 space-y-2.5">
            {block.inputs.map(input => {
              const isMissing = showValidation && input.required && !step.params[input.name];
              return (
                <div key={input.name} className="flex items-center gap-3">
                  <label className="text-xs text-text-tertiary w-20 shrink-0 text-right">
                    {input.label}
                    {input.required && <span className="text-danger ml-0.5">*</span>}
                  </label>
                  {input.type === 'dropdown' ? (
                    <select
                      className={`flex-1 px-3 py-1.5 text-sm bg-bg-input border rounded-md outline-none focus:border-border-active transition-all ${
                        isMissing ? 'border-danger/50 bg-danger/5' : 'border-border-subtle'
                      }`}
                      value={String(step.params[input.name] || '')}
                      onChange={e => handleParamChange(input.name, e.target.value)}
                      onClick={e => e.stopPropagation()}
                    >
                      <option value="">Select...</option>
                      {input.options?.map(opt => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
                    </select>
                  ) : input.type === 'checkbox' ? (
                    <input
                      type="checkbox"
                      className="w-4 h-4 rounded border-border-subtle accent-accent"
                      checked={!!step.params[input.name]}
                      onChange={e => handleParamChange(input.name, e.target.checked)}
                      onClick={e => e.stopPropagation()}
                    />
                  ) : input.type === 'code' ? (
                    <VariableInput
                      type="textarea"
                      className={`flex-1 px-3 py-2 text-sm bg-bg-input border rounded-md outline-none focus:border-border-active font-mono resize-none h-20 transition-all ${
                        isMissing ? 'border-danger/50 bg-danger/5' : 'border-border-subtle'
                      }`}
                      value={String(step.params[input.name] || '')}
                      onChange={v => handleParamChange(input.name, v)}
                      onClick={e => e.stopPropagation()}
                      placeholder={input.placeholder}
                    />
                  ) : (
                    <VariableInput
                      className={`flex-1 px-3 py-1.5 text-sm bg-bg-input border rounded-md outline-none focus:border-border-active transition-all ${
                        isMissing ? 'border-danger/50 bg-danger/5' : 'border-border-subtle'
                      }`}
                      value={String(step.params[input.name] || '')}
                      onChange={v => handleParamChange(input.name, input.type === 'number' ? (v === '' ? 0 : Number(v)) : v)}
                      onClick={e => e.stopPropagation()}
                      placeholder={input.placeholder}
                    />
                  )}
                  {isMissing && (
                    <span className="text-[10px] text-danger shrink-0">Required</span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
