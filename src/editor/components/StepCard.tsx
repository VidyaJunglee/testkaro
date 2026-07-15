import React, { useState } from 'react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { TestStep } from '../../schema';
import { EditorBlock } from '../blocks';
import { VariableInput } from './VariableInput';
import { GripVertical, Trash2, Copy, ChevronDown, ChevronRight, CircleDot, EyeOff } from 'lucide-react';
import { SelectorPicker, SelectorSuggestion } from './SelectorPicker';

interface Props {
  step: TestStep;
  index: number;
  block?: EditorBlock;
  onUpdate: (params: Record<string, unknown>) => void;
  onUpdateStep?: (updates: Partial<TestStep>) => void;
  onRemove: () => void;
  onDuplicate: () => void;
  highlighted?: boolean;
  selected?: boolean;
  onSelect?: (e: React.MouseEvent) => void;
  hasBreakpoint?: boolean;
  onToggleBreakpoint?: () => void;
  showValidation?: boolean;
  lastStatus?: 'passed' | 'failed' | 'skipped';
  lastError?: string;
}

const CONTAINER_TYPES = new Set(['if', 'repeat', 'for_each', 'try_catch']);

export function StepCard({ step, index, block, onUpdate, onUpdateStep, onRemove, onDuplicate, highlighted, selected, onSelect, hasBreakpoint, onToggleBreakpoint, showValidation, lastStatus, lastError }: Props) {
  const [expanded, setExpanded] = useState(true);
  const [advancedOpen, setAdvancedOpen] = useState(false);

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
          group bg-bg-card backdrop-blur-sm border rounded-lg transition-all duration-150
          ${isDragging ? 'opacity-40 shadow-lg scale-[1.02]' : 'hover:shadow-sm hover:-translate-y-px'}
          ${highlighted ? 'ring-2 ring-accent/50 bg-accent/5 border-accent/30 animate-step-pulse' : 'border-border-subtle hover:border-border'}
          ${selected ? 'border-accent shadow-sm ring-1 ring-accent/30' : ''}
          ${hasValidationError && !selected && !highlighted ? 'border-danger/40' : ''}
          ${step.skip ? 'opacity-50' : ''}
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

          <div className="flex flex-col min-w-0">
            <span className={`text-sm font-semibold ${step.skip ? 'line-through text-text-tertiary' : 'text-text-primary'}`}>
              {block?.label || step.type}
            </span>
            {step.description && (
              <span className="text-xs text-text-tertiary italic truncate max-w-[220px]">{step.description}</span>
            )}
          </div>

          {/* Selector picker for recorded steps with alternatives */}
          {step.selectorSuggestions && step.selectorSuggestions.length > 1 && (
            <SelectorPicker
              suggestions={step.selectorSuggestions as SelectorSuggestion[]}
              currentSelector={String(step.params.selector || '')}
              onSelect={(newSelector) => onUpdate({ ...step.params, selector: newSelector })}
            />
          )}

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
              className={`p-1.5 rounded transition-all ${step.skip ? 'text-warning opacity-100' : 'text-text-tertiary hover:text-warning hover:bg-warning/5'}`}
              onClick={e => { e.stopPropagation(); onUpdateStep?.({ skip: !step.skip }); }}
              title={step.skip ? 'Enable step' : 'Skip step'}
            >
              <EyeOff size={13} />
            </button>
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

        {/* Failure hint — surfaces selector alternatives when a selector-based step just failed */}
        {lastStatus === 'failed' && (
          <div className="mx-3 mb-2 px-3 py-2 rounded-md bg-danger/5 border border-danger/20 text-xs">
            <p className="text-danger truncate">{lastError || 'Step failed'}</p>
            {step.selectorSuggestions && step.selectorSuggestions.length > 1 && (
              <div className="flex items-center gap-1.5 mt-1.5" onClick={e => e.stopPropagation()}>
                <span className="text-text-tertiary">Selector may have changed —</span>
                <SelectorPicker
                  suggestions={step.selectorSuggestions as SelectorSuggestion[]}
                  currentSelector={String(step.params.selector || '')}
                  onSelect={(newSelector) => onUpdate({ ...step.params, selector: newSelector })}
                  autoOpen
                />
              </div>
            )}
          </div>
        )}

        {/* Description input (always shown when expanded) */}
        {expanded && onUpdateStep && (
          <div className="pl-12 pr-4 pb-2" onPointerDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2">
              <input
                className="flex-1 text-xs bg-transparent border border-transparent hover:border-border-subtle focus:border-border-active rounded px-2 py-1 text-text-tertiary placeholder:text-text-tertiary/50 outline-none transition-all"
                placeholder="Add a note…"
                value={step.description || ''}
                onChange={e => onUpdateStep({ description: e.target.value || undefined })}
              />
              {!CONTAINER_TYPES.has(step.type) && (
                <button
                  className={`shrink-0 text-[10px] px-1.5 py-1 rounded transition-colors ${
                    advancedOpen || step.timeout != null || step.retry
                      ? 'text-accent bg-accent/10'
                      : 'text-text-tertiary hover:text-text-secondary hover:bg-bg-hover'
                  }`}
                  onClick={() => setAdvancedOpen(!advancedOpen)}
                  title="Timeout & retry"
                >
                  Advanced
                </button>
              )}
            </div>

            {advancedOpen && !CONTAINER_TYPES.has(step.type) && (
              <div className="flex items-center gap-4 mt-2 px-2">
                <label className="flex items-center gap-1.5 text-[11px] text-text-tertiary">
                  Timeout (ms)
                  <input
                    type="number"
                    className="w-20 px-1.5 py-0.5 text-xs bg-bg-input border border-border-subtle rounded outline-none focus:border-border-active"
                    placeholder="10000"
                    value={step.timeout ?? ''}
                    onChange={e => onUpdateStep({ timeout: e.target.value === '' ? undefined : Number(e.target.value) })}
                  />
                </label>
                <label className="flex items-center gap-1.5 text-[11px] text-text-tertiary">
                  Retries
                  <input
                    type="number"
                    min={0}
                    className="w-16 px-1.5 py-0.5 text-xs bg-bg-input border border-border-subtle rounded outline-none focus:border-border-active"
                    placeholder="0"
                    value={step.retry ?? ''}
                    onChange={e => onUpdateStep({ retry: e.target.value === '' ? undefined : Number(e.target.value) })}
                  />
                </label>
              </div>
            )}
          </div>
        )}

        {/* Params */}
        {expanded && block && block.inputs.length > 0 && (
          <div className="pl-12 pr-4 pb-3.5 space-y-2.5" onPointerDown={e => e.stopPropagation()} onClick={e => e.stopPropagation()}>
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
