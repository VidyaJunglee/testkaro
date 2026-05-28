import React from 'react';
import { Braces, Copy, Check } from 'lucide-react';
import { copyToClipboard } from '../utils/curl';

interface Props {
  variables: Record<string, string>;
}

export function VariablesPanel({ variables }: Props) {
  const entries = Object.entries(variables);

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-text-tertiary">
        <Braces size={28} className="mb-3 opacity-30" />
        <p className="text-sm">No variables extracted</p>
        <p className="text-xs mt-1 text-text-tertiary">Use "extract" steps to capture variables</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Table header */}
      <div className="flex items-center gap-2 px-3 py-1.5 bg-bg-tertiary border-b border-border-subtle text-[10px] uppercase tracking-wider text-text-tertiary font-semibold shrink-0">
        <span className="w-1/3">Variable</span>
        <span className="flex-1">Value</span>
        <span className="w-8" />
      </div>

      {/* Rows */}
      <div className="flex-1 overflow-y-auto">
        {entries.map(([name, value]) => (
          <VariableRow key={name} name={name} value={value} />
        ))}
      </div>

      {/* Footer */}
      <div className="px-3 py-1.5 border-t border-border-subtle bg-bg-secondary text-[10px] text-text-tertiary shrink-0">
        {entries.length} variable{entries.length !== 1 ? 's' : ''}
      </div>
    </div>
  );
}

function VariableRow({ name, value }: { name: string; value: string }) {
  const [copied, setCopied] = React.useState(false);

  const handleCopy = async () => {
    const ok = await copyToClipboard(value);
    if (ok) { setCopied(true); setTimeout(() => setCopied(false), 2000); }
  };

  return (
    <div className="flex items-center gap-2 px-3 py-2 border-b border-border-subtle last:border-0 hover:bg-bg-hover group text-xs">
      <span className="w-1/3 font-mono font-medium text-accent truncate" title={name}>{name}</span>
      <span className="flex-1 font-mono text-text-secondary truncate" title={value}>{value}</span>
      <button
        className="w-8 shrink-0 flex justify-center p-0.5 rounded text-text-tertiary hover:text-accent opacity-0 group-hover:opacity-100 transition-opacity"
        onClick={handleCopy}
        title="Copy value"
      >
        {copied ? <Check size={12} className="text-success" /> : <Copy size={12} />}
      </button>
    </div>
  );
}
