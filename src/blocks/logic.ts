import { BlockDefinition } from '../schema';
import { registerBlock } from './registry';

// ─── Logic Blocks ────────────────────────────────────────────────────────────

const setVariable: BlockDefinition = {
  type: 'set_variable',
  category: 'logic',
  label: 'Set Variable',
  description: 'Set a variable value',
  color: '#607D8B',
  inputs: [
    { name: 'name', label: 'Variable Name', type: 'text', required: true },
    { name: 'value', label: 'Value', type: 'text', required: true },
  ],
  async execute(params, ctx) {
    const start = Date.now();
    ctx.variables.set(String(params.name), params.value);
    return { stepId: '', type: 'set_variable', status: 'passed', duration: Date.now() - start };
  },
};

const log: BlockDefinition = {
  type: 'log',
  category: 'logic',
  label: 'Log Message',
  description: 'Log a message to the console',
  color: '#607D8B',
  inputs: [
    { name: 'message', label: 'Message', type: 'text', required: true },
  ],
  async execute(params, ctx) {
    const start = Date.now();
    ctx.log(String(params.message));
    return { stepId: '', type: 'log', status: 'passed', duration: Date.now() - start };
  },
};

const ifBlock: BlockDefinition = {
  type: 'if',
  category: 'logic',
  label: 'If Condition',
  description: 'Execute child steps only if condition is true',
  color: '#607D8B',
  hasChildren: true,
  inputs: [
    { name: 'variable', label: 'Variable', type: 'text', required: true },
    { name: 'operator', label: 'Operator', type: 'dropdown', required: true, default: 'equals', options: [{ label: 'Equals', value: 'equals' }, { label: 'Not Equals', value: 'notEquals' }, { label: 'Contains', value: 'contains' }, { label: 'Truthy', value: 'truthy' }] },
    { name: 'value', label: 'Value', type: 'text' },
  ],
  async execute(params, ctx) {
    // Container block — executor handles children based on result
    const start = Date.now();
    const varValue = ctx.variables.get(String(params.variable));
    let pass = false;
    switch (params.operator) {
      case 'equals': pass = String(varValue) === String(params.value); break;
      case 'notEquals': pass = String(varValue) !== String(params.value); break;
      case 'contains': pass = String(varValue).includes(String(params.value)); break;
      case 'truthy': pass = !!varValue; break;
    }
    return { stepId: '', type: 'if', status: 'passed', duration: Date.now() - start, output: pass };
  },
};

const repeat: BlockDefinition = {
  type: 'repeat',
  category: 'logic',
  label: 'Repeat',
  description: 'Repeat child steps N times',
  color: '#607D8B',
  hasChildren: true,
  inputs: [
    { name: 'times', label: 'Times', type: 'number', required: true, default: 3 },
  ],
  async execute(params) {
    const start = Date.now();
    return { stepId: '', type: 'repeat', status: 'passed', duration: Date.now() - start, output: Number(params.times) };
  },
};

const forEachBlock: BlockDefinition = {
  type: 'for_each',
  category: 'logic',
  label: 'For Each',
  description: 'Iterate over an array variable, running child steps for each item',
  color: '#607D8B',
  hasChildren: true,
  inputs: [
    { name: 'variable', label: 'Array Variable Name', type: 'text', placeholder: 'myArray' },
    { name: 'items', label: 'Inline Items (JSON)', type: 'text', placeholder: '["a","b","c"]' },
  ],
  async execute(_params) {
    const start = Date.now();
    return { stepId: '', type: 'for_each', status: 'passed', duration: Date.now() - start };
  },
};

const tryCatchBlock: BlockDefinition = {
  type: 'try_catch',
  category: 'logic',
  label: 'Try / Catch',
  description: 'Run child steps; if one fails, capture the error in __error and continue',
  color: '#607D8B',
  hasChildren: true,
  inputs: [],
  async execute(_params) {
    const start = Date.now();
    return { stepId: '', type: 'try_catch', status: 'passed', duration: Date.now() - start };
  },
};

// ─── Register ────────────────────────────────────────────────────────────────

export function registerLogicBlocks(): void {
  [setVariable, log, ifBlock, repeat, forEachBlock, tryCatchBlock].forEach(registerBlock);
}
