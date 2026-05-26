// Block metadata for the editor (no execute functions — those are engine-only)
import { BlockCategory } from '../schema';

export interface EditorBlock {
  type: string;
  category: BlockCategory;
  label: string;
  description?: string;
  color: string;
  inputs: {
    name: string;
    label: string;
    type: 'text' | 'number' | 'dropdown' | 'checkbox' | 'code';
    required?: boolean;
    default?: unknown;
    placeholder?: string;
    options?: Array<{ label: string; value: string }>;
  }[];
  hasChildren?: boolean;
}

export const BLOCKS: EditorBlock[] = [
  // ─── Navigation ──────────────────────────────────────────────────────────
  { type: 'navigate', category: 'navigation', label: 'Navigate to URL', description: 'Open a URL in the browser', color: '#4CAF50', inputs: [{ name: 'url', label: 'URL', type: 'text', required: true, placeholder: 'https://example.com' }] },
  { type: 'wait_for_element', category: 'navigation', label: 'Wait for Element', description: 'Wait until an element appears', color: '#4CAF50', inputs: [{ name: 'selector', label: 'Selector', type: 'text', required: true, placeholder: '#login-btn' }, { name: 'timeout', label: 'Timeout (ms)', type: 'number', default: 5000 }] },
  { type: 'wait', category: 'navigation', label: 'Wait (delay)', description: 'Pause execution', color: '#4CAF50', inputs: [{ name: 'ms', label: 'Milliseconds', type: 'number', required: true, default: 1000 }] },
  { type: 'screenshot', category: 'navigation', label: 'Take Screenshot', description: 'Capture page screenshot', color: '#4CAF50', inputs: [{ name: 'name', label: 'File Name', type: 'text', placeholder: 'step-1' }] },

  // ─── Interaction ─────────────────────────────────────────────────────────
  { type: 'click', category: 'interaction', label: 'Click', description: 'Click on an element', color: '#2196F3', inputs: [{ name: 'selector', label: 'Selector', type: 'text', required: true, placeholder: 'button.submit' }] },
  { type: 'fill', category: 'interaction', label: 'Fill Input', description: 'Clear and type into an input', color: '#2196F3', inputs: [{ name: 'selector', label: 'Selector', type: 'text', required: true, placeholder: 'input[name="email"]' }, { name: 'value', label: 'Value', type: 'text', required: true, placeholder: 'user@example.com' }] },
  { type: 'type', category: 'interaction', label: 'Type Text', description: 'Type character by character', color: '#2196F3', inputs: [{ name: 'selector', label: 'Selector', type: 'text', required: true }, { name: 'text', label: 'Text', type: 'text', required: true }] },
  { type: 'select', category: 'interaction', label: 'Select Option', description: 'Select dropdown option by value', color: '#2196F3', inputs: [{ name: 'selector', label: 'Selector', type: 'text', required: true }, { name: 'value', label: 'Value', type: 'text', required: true }] },
  { type: 'check', category: 'interaction', label: 'Check/Uncheck', description: 'Toggle a checkbox', color: '#2196F3', inputs: [{ name: 'selector', label: 'Selector', type: 'text', required: true }, { name: 'checked', label: 'Checked', type: 'checkbox', default: true }] },
  { type: 'hover', category: 'interaction', label: 'Hover', description: 'Hover over an element', color: '#2196F3', inputs: [{ name: 'selector', label: 'Selector', type: 'text', required: true }] },
  { type: 'press_key', category: 'interaction', label: 'Press Key', description: 'Press a keyboard key', color: '#2196F3', inputs: [{ name: 'key', label: 'Key', type: 'text', required: true, placeholder: 'Enter' }, { name: 'selector', label: 'Selector (optional)', type: 'text' }] },

  // ─── Assertion ───────────────────────────────────────────────────────────
  { type: 'assert_visible', category: 'assertion', label: 'Assert Visible', description: 'Assert element is visible', color: '#FF9800', inputs: [{ name: 'selector', label: 'Selector', type: 'text', required: true }] },
  { type: 'assert_text', category: 'assertion', label: 'Assert Text', description: 'Assert element contains text', color: '#FF9800', inputs: [{ name: 'selector', label: 'Selector', type: 'text', required: true }, { name: 'expected', label: 'Expected Text', type: 'text', required: true }, { name: 'exact', label: 'Exact Match', type: 'checkbox', default: false }] },
  { type: 'assert_url', category: 'assertion', label: 'Assert URL', description: 'Assert the current URL', color: '#FF9800', inputs: [{ name: 'expected', label: 'Expected URL', type: 'text', required: true }, { name: 'mode', label: 'Match Mode', type: 'dropdown', default: 'contains', options: [{ label: 'Contains', value: 'contains' }, { label: 'Equals', value: 'equals' }, { label: 'Starts with', value: 'startsWith' }] }] },
  { type: 'assert_title', category: 'assertion', label: 'Assert Title', description: 'Assert the page title', color: '#FF9800', inputs: [{ name: 'expected', label: 'Expected Title', type: 'text', required: true }] },
  { type: 'assert_value', category: 'assertion', label: 'Assert Input Value', description: 'Assert input field value', color: '#FF9800', inputs: [{ name: 'selector', label: 'Selector', type: 'text', required: true }, { name: 'expected', label: 'Expected Value', type: 'text', required: true }] },
  { type: 'assert_count', category: 'assertion', label: 'Assert Element Count', description: 'Assert number of matching elements', color: '#FF9800', inputs: [{ name: 'selector', label: 'Selector', type: 'text', required: true }, { name: 'count', label: 'Expected Count', type: 'number', required: true }] },

  // ─── API ─────────────────────────────────────────────────────────────────
  { type: 'api_get', category: 'api', label: 'GET Request', description: 'Make HTTP GET request', color: '#9C27B0', inputs: [{ name: 'url', label: 'URL', type: 'text', required: true, placeholder: 'https://api.example.com/users' }, { name: 'headers', label: 'Headers (JSON)', type: 'code', default: '{}' }, { name: 'saveAs', label: 'Save Response As', type: 'text', placeholder: 'response' }] },
  { type: 'api_post', category: 'api', label: 'POST Request', description: 'Make HTTP POST request', color: '#9C27B0', inputs: [{ name: 'url', label: 'URL', type: 'text', required: true }, { name: 'body', label: 'Body (JSON)', type: 'code', required: true, default: '{}' }, { name: 'headers', label: 'Headers (JSON)', type: 'code', default: '{"Content-Type": "application/json"}' }, { name: 'saveAs', label: 'Save Response As', type: 'text' }] },
  { type: 'api_put', category: 'api', label: 'PUT Request', description: 'Make HTTP PUT request', color: '#9C27B0', inputs: [{ name: 'url', label: 'URL', type: 'text', required: true }, { name: 'body', label: 'Body (JSON)', type: 'code', required: true, default: '{}' }, { name: 'headers', label: 'Headers (JSON)', type: 'code', default: '{"Content-Type": "application/json"}' }, { name: 'saveAs', label: 'Save Response As', type: 'text' }] },
  { type: 'api_delete', category: 'api', label: 'DELETE Request', description: 'Make HTTP DELETE request', color: '#9C27B0', inputs: [{ name: 'url', label: 'URL', type: 'text', required: true }, { name: 'headers', label: 'Headers (JSON)', type: 'code', default: '{}' }, { name: 'saveAs', label: 'Save Response As', type: 'text' }] },
  { type: 'api_assert_status', category: 'api', label: 'Assert Status Code', description: 'Assert HTTP response status', color: '#9C27B0', inputs: [{ name: 'variable', label: 'Response Variable', type: 'text', required: true, placeholder: 'response' }, { name: 'expected', label: 'Expected Status', type: 'number', required: true, default: 200 }] },

  // ─── Logic ───────────────────────────────────────────────────────────────
  { type: 'set_variable', category: 'logic', label: 'Set Variable', description: 'Set a variable value', color: '#607D8B', inputs: [{ name: 'name', label: 'Variable Name', type: 'text', required: true }, { name: 'value', label: 'Value', type: 'text', required: true }] },
  { type: 'log', category: 'logic', label: 'Log Message', description: 'Log a message', color: '#607D8B', inputs: [{ name: 'message', label: 'Message', type: 'text', required: true }] },
  { type: 'if', category: 'logic', label: 'If Condition', description: 'Conditional execution', color: '#607D8B', hasChildren: true, inputs: [{ name: 'variable', label: 'Variable', type: 'text', required: true }, { name: 'operator', label: 'Operator', type: 'dropdown', required: true, default: 'equals', options: [{ label: 'Equals', value: 'equals' }, { label: 'Not Equals', value: 'notEquals' }, { label: 'Contains', value: 'contains' }, { label: 'Truthy', value: 'truthy' }] }, { name: 'value', label: 'Value', type: 'text' }] },
  { type: 'repeat', category: 'logic', label: 'Repeat', description: 'Repeat steps N times', color: '#607D8B', hasChildren: true, inputs: [{ name: 'times', label: 'Times', type: 'number', required: true, default: 3 }] },

  // ─── Data ────────────────────────────────────────────────────────────────
  { type: 'get_text', category: 'data', label: 'Get Text', description: 'Get element text into variable', color: '#00BCD4', inputs: [{ name: 'selector', label: 'Selector', type: 'text', required: true }, { name: 'saveAs', label: 'Save As Variable', type: 'text', required: true }] },
  { type: 'get_attribute', category: 'data', label: 'Get Attribute', description: 'Get element attribute value', color: '#00BCD4', inputs: [{ name: 'selector', label: 'Selector', type: 'text', required: true }, { name: 'attribute', label: 'Attribute', type: 'text', required: true, placeholder: 'href' }, { name: 'saveAs', label: 'Save As Variable', type: 'text', required: true }] },
  { type: 'get_input_value', category: 'data', label: 'Get Input Value', description: 'Get input field value', color: '#00BCD4', inputs: [{ name: 'selector', label: 'Selector', type: 'text', required: true }, { name: 'saveAs', label: 'Save As Variable', type: 'text', required: true }] },
  { type: 'get_url', category: 'data', label: 'Get Current URL', description: 'Get current page URL', color: '#00BCD4', inputs: [{ name: 'saveAs', label: 'Save As Variable', type: 'text', required: true }] },
];
