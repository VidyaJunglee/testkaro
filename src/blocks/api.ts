import { BlockDefinition } from '../schema';
import { registerBlock } from './registry';

// ─── API Blocks ──────────────────────────────────────────────────────────────

const apiGet: BlockDefinition = {
  type: 'api_get',
  category: 'api',
  label: 'GET Request',
  description: 'Make an HTTP GET request',
  color: '#9C27B0',
  inputs: [
    { name: 'url', label: 'URL', type: 'text', required: true, placeholder: 'https://api.example.com/users' },
    { name: 'headers', label: 'Headers (JSON)', type: 'code', default: '{}' },
    { name: 'saveAs', label: 'Save Response As', type: 'text', placeholder: 'response' },
  ],
  async execute(params, ctx) {
    const start = Date.now();
    try {
      const res = await fetch(String(params.url), {
        method: 'GET',
        headers: JSON.parse(String(params.headers || '{}')),
      });
      const body = await res.json().catch(() => res.text());
      const output = { status: res.status, body };
      if (params.saveAs) ctx.variables.set(String(params.saveAs), output);
      return { stepId: '', type: 'api_get', status: 'passed', duration: Date.now() - start, output };
    } catch (e: any) {
      return { stepId: '', type: 'api_get', status: 'failed', duration: Date.now() - start, error: e.message };
    }
  },
};

const apiPost: BlockDefinition = {
  type: 'api_post',
  category: 'api',
  label: 'POST Request',
  description: 'Make an HTTP POST request',
  color: '#9C27B0',
  inputs: [
    { name: 'url', label: 'URL', type: 'text', required: true },
    { name: 'body', label: 'Body (JSON)', type: 'code', required: true, default: '{}' },
    { name: 'headers', label: 'Headers (JSON)', type: 'code', default: '{"Content-Type": "application/json"}' },
    { name: 'saveAs', label: 'Save Response As', type: 'text' },
  ],
  async execute(params, ctx) {
    const start = Date.now();
    try {
      const res = await fetch(String(params.url), {
        method: 'POST',
        headers: JSON.parse(String(params.headers || '{}')),
        body: String(params.body),
      });
      const body = await res.json().catch(() => res.text());
      const output = { status: res.status, body };
      if (params.saveAs) ctx.variables.set(String(params.saveAs), output);
      return { stepId: '', type: 'api_post', status: 'passed', duration: Date.now() - start, output };
    } catch (e: any) {
      return { stepId: '', type: 'api_post', status: 'failed', duration: Date.now() - start, error: e.message };
    }
  },
};

const apiPut: BlockDefinition = {
  type: 'api_put',
  category: 'api',
  label: 'PUT Request',
  description: 'Make an HTTP PUT request',
  color: '#9C27B0',
  inputs: [
    { name: 'url', label: 'URL', type: 'text', required: true },
    { name: 'body', label: 'Body (JSON)', type: 'code', required: true, default: '{}' },
    { name: 'headers', label: 'Headers (JSON)', type: 'code', default: '{"Content-Type": "application/json"}' },
    { name: 'saveAs', label: 'Save Response As', type: 'text' },
  ],
  async execute(params, ctx) {
    const start = Date.now();
    try {
      const res = await fetch(String(params.url), {
        method: 'PUT',
        headers: JSON.parse(String(params.headers || '{}')),
        body: String(params.body),
      });
      const body = await res.json().catch(() => res.text());
      const output = { status: res.status, body };
      if (params.saveAs) ctx.variables.set(String(params.saveAs), output);
      return { stepId: '', type: 'api_put', status: 'passed', duration: Date.now() - start, output };
    } catch (e: any) {
      return { stepId: '', type: 'api_put', status: 'failed', duration: Date.now() - start, error: e.message };
    }
  },
};

const apiDelete: BlockDefinition = {
  type: 'api_delete',
  category: 'api',
  label: 'DELETE Request',
  description: 'Make an HTTP DELETE request',
  color: '#9C27B0',
  inputs: [
    { name: 'url', label: 'URL', type: 'text', required: true },
    { name: 'headers', label: 'Headers (JSON)', type: 'code', default: '{}' },
    { name: 'saveAs', label: 'Save Response As', type: 'text' },
  ],
  async execute(params, ctx) {
    const start = Date.now();
    try {
      const res = await fetch(String(params.url), {
        method: 'DELETE',
        headers: JSON.parse(String(params.headers || '{}')),
      });
      const body = await res.json().catch(() => res.text());
      const output = { status: res.status, body };
      if (params.saveAs) ctx.variables.set(String(params.saveAs), output);
      return { stepId: '', type: 'api_delete', status: 'passed', duration: Date.now() - start, output };
    } catch (e: any) {
      return { stepId: '', type: 'api_delete', status: 'failed', duration: Date.now() - start, error: e.message };
    }
  },
};

const apiAssertStatus: BlockDefinition = {
  type: 'api_assert_status',
  category: 'api',
  label: 'Assert Status Code',
  description: 'Assert the HTTP status code of a saved response',
  color: '#9C27B0',
  inputs: [
    { name: 'variable', label: 'Response Variable', type: 'text', required: true, placeholder: 'response' },
    { name: 'expected', label: 'Expected Status', type: 'number', required: true, default: 200 },
  ],
  async execute(params, ctx) {
    const start = Date.now();
    const res = ctx.variables.get(String(params.variable)) as any;
    if (!res) return { stepId: '', type: 'api_assert_status', status: 'failed', duration: Date.now() - start, error: `Variable "${params.variable}" not found` };
    const pass = res.status === Number(params.expected);
    return { stepId: '', type: 'api_assert_status', status: pass ? 'passed' : 'failed', duration: Date.now() - start, error: pass ? undefined : `Expected status ${params.expected}, got ${res.status}` };
  },
};

// ─── Register ────────────────────────────────────────────────────────────────

export function registerApiBlocks(): void {
  [apiGet, apiPost, apiPut, apiDelete, apiAssertStatus].forEach(registerBlock);
}
