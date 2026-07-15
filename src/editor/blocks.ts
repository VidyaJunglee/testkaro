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
  { type: 'reload', category: 'navigation', label: 'Reload Page', description: 'Reload the current page', color: '#4CAF50', inputs: [] },
  { type: 'go_back', category: 'navigation', label: 'Go Back', description: 'Navigate back in browser history', color: '#4CAF50', inputs: [] },
  { type: 'go_forward', category: 'navigation', label: 'Go Forward', description: 'Navigate forward in browser history', color: '#4CAF50', inputs: [] },
  { type: 'wait_for_url', category: 'navigation', label: 'Wait for URL', description: 'Wait until the URL matches', color: '#4CAF50', inputs: [{ name: 'url', label: 'URL', type: 'text', required: true }] },

  // ─── Interaction ─────────────────────────────────────────────────────────
  { type: 'click', category: 'interaction', label: 'Click', description: 'Click on an element', color: '#2196F3', inputs: [{ name: 'selector', label: 'Selector', type: 'text', required: true, placeholder: 'button.submit' }] },
  { type: 'double_click', category: 'interaction', label: 'Double Click', description: 'Double-click on an element', color: '#2196F3', inputs: [{ name: 'selector', label: 'Selector', type: 'text', required: true }] },
  { type: 'right_click', category: 'interaction', label: 'Right Click', description: 'Right-click on an element (opens context menu)', color: '#2196F3', inputs: [{ name: 'selector', label: 'Selector', type: 'text', required: true }] },
  { type: 'fill', category: 'interaction', label: 'Fill Input', description: 'Clear and type into an input', color: '#2196F3', inputs: [{ name: 'selector', label: 'Selector', type: 'text', required: true, placeholder: 'input[name="email"]' }, { name: 'value', label: 'Value', type: 'text', required: true, placeholder: 'user@example.com' }] },
  { type: 'type', category: 'interaction', label: 'Type Text', description: 'Type character by character', color: '#2196F3', inputs: [{ name: 'selector', label: 'Selector', type: 'text', required: true }, { name: 'text', label: 'Text', type: 'text', required: true }] },
  { type: 'clear', category: 'interaction', label: 'Clear Input', description: 'Clear the value of an input field', color: '#2196F3', inputs: [{ name: 'selector', label: 'Selector', type: 'text', required: true }] },
  { type: 'select', category: 'interaction', label: 'Select Option', description: 'Select dropdown option by value', color: '#2196F3', inputs: [{ name: 'selector', label: 'Selector', type: 'text', required: true }, { name: 'value', label: 'Value', type: 'text', required: true }] },
  { type: 'check', category: 'interaction', label: 'Check/Uncheck', description: 'Toggle a checkbox', color: '#2196F3', inputs: [{ name: 'selector', label: 'Selector', type: 'text', required: true }, { name: 'checked', label: 'Checked', type: 'checkbox', default: true }] },
  { type: 'uncheck', category: 'interaction', label: 'Uncheck', description: 'Uncheck a checkbox', color: '#2196F3', inputs: [{ name: 'selector', label: 'Selector', type: 'text', required: true }] },
  { type: 'hover', category: 'interaction', label: 'Hover', description: 'Hover over an element', color: '#2196F3', inputs: [{ name: 'selector', label: 'Selector', type: 'text', required: true }] },
  { type: 'scroll_to', category: 'interaction', label: 'Scroll to Element', description: 'Scroll an element into view', color: '#2196F3', inputs: [{ name: 'selector', label: 'Selector', type: 'text', required: true }] },
  { type: 'press_key', category: 'interaction', label: 'Press Key', description: 'Press a keyboard key', color: '#2196F3', inputs: [{ name: 'key', label: 'Key', type: 'text', required: true, placeholder: 'Enter' }, { name: 'selector', label: 'Selector (optional)', type: 'text' }] },
  { type: 'upload_file', category: 'interaction', label: 'Upload File', description: 'Set a file input to a file path', color: '#2196F3', inputs: [{ name: 'selector', label: 'File Input Selector', type: 'text', required: true }, { name: 'path', label: 'File Path', type: 'text', required: true, placeholder: '/tmp/file.pdf' }] },

  // ─── Assertion ───────────────────────────────────────────────────────────
  { type: 'assert_visible', category: 'assertion', label: 'Assert Visible', description: 'Assert element is visible', color: '#FF9800', inputs: [{ name: 'selector', label: 'Selector', type: 'text', required: true }] },
  { type: 'assert_hidden', category: 'assertion', label: 'Assert Hidden', description: 'Assert element is hidden', color: '#FF9800', inputs: [{ name: 'selector', label: 'Selector', type: 'text', required: true }] },
  { type: 'assert_text', category: 'assertion', label: 'Assert Text', description: 'Assert element contains text', color: '#FF9800', inputs: [{ name: 'selector', label: 'Selector', type: 'text', required: true }, { name: 'expected', label: 'Expected Text', type: 'text', required: true }, { name: 'exact', label: 'Exact Match', type: 'checkbox', default: false }] },
  { type: 'assert_url', category: 'assertion', label: 'Assert URL', description: 'Assert the current URL', color: '#FF9800', inputs: [{ name: 'expected', label: 'Expected URL', type: 'text', required: true }, { name: 'mode', label: 'Match Mode', type: 'dropdown', default: 'contains', options: [{ label: 'Contains', value: 'contains' }, { label: 'Equals', value: 'equals' }, { label: 'Starts with', value: 'startsWith' }] }] },
  { type: 'assert_title', category: 'assertion', label: 'Assert Title', description: 'Assert the page title', color: '#FF9800', inputs: [{ name: 'expected', label: 'Expected Title', type: 'text', required: true }] },
  { type: 'assert_value', category: 'assertion', label: 'Assert Input Value', description: 'Assert input field value', color: '#FF9800', inputs: [{ name: 'selector', label: 'Selector', type: 'text', required: true }, { name: 'expected', label: 'Expected Value', type: 'text', required: true }] },
  { type: 'assert_count', category: 'assertion', label: 'Assert Element Count', description: 'Assert number of matching elements', color: '#FF9800', inputs: [{ name: 'selector', label: 'Selector', type: 'text', required: true }, { name: 'count', label: 'Expected Count', type: 'number', required: true }] },
  { type: 'assert_attribute', category: 'assertion', label: 'Assert Attribute', description: 'Assert an element attribute value', color: '#FF9800', inputs: [{ name: 'selector', label: 'Selector', type: 'text', required: true }, { name: 'attribute', label: 'Attribute', type: 'text', required: true, placeholder: 'href' }, { name: 'expected', label: 'Expected Value', type: 'text', required: true }, { name: 'mode', label: 'Match Mode', type: 'dropdown', default: 'equals', options: [{ label: 'Equals', value: 'equals' }, { label: 'Contains', value: 'contains' }] }] },
  { type: 'assert_checked', category: 'assertion', label: 'Assert Checked', description: 'Assert a checkbox is checked (or unchecked)', color: '#FF9800', inputs: [{ name: 'selector', label: 'Selector', type: 'text', required: true }, { name: 'checked', label: 'Checked', type: 'checkbox', default: true }] },
  { type: 'assert_enabled', category: 'assertion', label: 'Assert Enabled', description: 'Assert an element is enabled', color: '#FF9800', inputs: [{ name: 'selector', label: 'Selector', type: 'text', required: true }] },
  { type: 'assert_disabled', category: 'assertion', label: 'Assert Disabled', description: 'Assert an element is disabled', color: '#FF9800', inputs: [{ name: 'selector', label: 'Selector', type: 'text', required: true }] },
  { type: 'assert_css', category: 'assertion', label: 'Assert CSS Property', description: 'Assert a computed CSS property value', color: '#FF9800', inputs: [{ name: 'selector', label: 'Selector', type: 'text', required: true }, { name: 'property', label: 'CSS Property', type: 'text', required: true, placeholder: 'color' }, { name: 'expected', label: 'Expected Value', type: 'text', required: true }] },

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
  { type: 'for_each', category: 'logic', label: 'For Each', description: 'Iterate over a JSON array or variable', color: '#607D8B', hasChildren: true, inputs: [{ name: 'items', label: 'Items (JSON array)', type: 'code' }, { name: 'variable', label: 'Or: Variable Name', type: 'text' }] },
  { type: 'try_catch', category: 'logic', label: 'Try/Catch', description: 'Run steps, swallowing any failure', color: '#607D8B', hasChildren: true, inputs: [] },
  { type: 'javascript', category: 'logic', label: 'Run JavaScript', description: 'Evaluate JS in the page context', color: '#607D8B', inputs: [{ name: 'code', label: 'Code', type: 'code', required: true }, { name: 'variable', label: 'Save Result As', type: 'text' }] },

  // ─── Data ────────────────────────────────────────────────────────────────
  { type: 'get_text', category: 'data', label: 'Get Text', description: 'Get element text into variable', color: '#00BCD4', inputs: [{ name: 'selector', label: 'Selector', type: 'text', required: true }, { name: 'saveAs', label: 'Save As Variable', type: 'text', required: true }] },
  { type: 'get_attribute', category: 'data', label: 'Get Attribute', description: 'Get element attribute value', color: '#00BCD4', inputs: [{ name: 'selector', label: 'Selector', type: 'text', required: true }, { name: 'attribute', label: 'Attribute', type: 'text', required: true, placeholder: 'href' }, { name: 'saveAs', label: 'Save As Variable', type: 'text', required: true }] },
  { type: 'get_input_value', category: 'data', label: 'Get Input Value', description: 'Get input field value', color: '#00BCD4', inputs: [{ name: 'selector', label: 'Selector', type: 'text', required: true }, { name: 'saveAs', label: 'Save As Variable', type: 'text', required: true }] },
  { type: 'get_url', category: 'data', label: 'Get Current URL', description: 'Get current page URL', color: '#00BCD4', inputs: [{ name: 'saveAs', label: 'Save As Variable', type: 'text', required: true }] },

  // ─── Mobile (Appium — modules with engine: 'mobile' only) ─────────────────
  { type: 'tap', category: 'mobile', label: 'Tap', description: 'Tap an element', color: '#E91E63', inputs: [{ name: 'selector', label: 'Selector', type: 'text', required: true, placeholder: '~loginButton' }] },
  { type: 'long_press', category: 'mobile', label: 'Long Press', description: 'Press and hold an element', color: '#E91E63', inputs: [{ name: 'selector', label: 'Selector', type: 'text', required: true }, { name: 'duration', label: 'Duration (ms)', type: 'number', default: 1000 }] },
  { type: 'double_tap', category: 'mobile', label: 'Double Tap', description: 'Double-tap an element', color: '#E91E63', inputs: [{ name: 'selector', label: 'Selector', type: 'text', required: true }] },
  { type: 'input_text', category: 'mobile', label: 'Input Text', description: 'Set the value of a text field', color: '#E91E63', inputs: [{ name: 'selector', label: 'Selector', type: 'text', required: true }, { name: 'value', label: 'Text', type: 'text', required: true }] },
  { type: 'clear_text', category: 'mobile', label: 'Clear Text', description: 'Clear a text field', color: '#E91E63', inputs: [{ name: 'selector', label: 'Selector', type: 'text', required: true }] },
  { type: 'swipe', category: 'mobile', label: 'Swipe', description: 'Swipe the screen (or within an element)', color: '#E91E63', inputs: [{ name: 'direction', label: 'Direction', type: 'dropdown', required: true, default: 'up', options: [{ label: 'Up', value: 'up' }, { label: 'Down', value: 'down' }, { label: 'Left', value: 'left' }, { label: 'Right', value: 'right' }] }, { name: 'selector', label: 'Within Selector (optional)', type: 'text' }] },
  { type: 'scroll_until_visible', category: 'mobile', label: 'Scroll Until Visible', description: 'Swipe repeatedly until an element appears', color: '#E91E63', inputs: [{ name: 'selector', label: 'Selector', type: 'text', required: true }, { name: 'direction', label: 'Direction', type: 'dropdown', default: 'down', options: [{ label: 'Down', value: 'down' }, { label: 'Up', value: 'up' }] }, { name: 'maxSwipes', label: 'Max Swipes', type: 'number', default: 5 }] },
  { type: 'assert_visible_mobile', category: 'mobile', label: 'Assert Visible (Mobile)', description: 'Assert an element is visible', color: '#E91E63', inputs: [{ name: 'selector', label: 'Selector', type: 'text', required: true }] },
  { type: 'assert_text_mobile', category: 'mobile', label: 'Assert Text (Mobile)', description: 'Assert an element contains text', color: '#E91E63', inputs: [{ name: 'selector', label: 'Selector', type: 'text', required: true }, { name: 'expected', label: 'Expected Text', type: 'text', required: true }, { name: 'exact', label: 'Exact Match', type: 'checkbox', default: false }] },
  { type: 'wait_for_element_mobile', category: 'mobile', label: 'Wait for Element (Mobile)', description: 'Wait until an element appears', color: '#E91E63', inputs: [{ name: 'selector', label: 'Selector', type: 'text', required: true }, { name: 'timeout', label: 'Timeout (ms)', type: 'number', default: 10000 }] },
  { type: 'press_key_mobile', category: 'mobile', label: 'Press Key (Mobile)', description: 'Press a hardware/keycode key (Android)', color: '#E91E63', inputs: [{ name: 'key', label: 'Key / Keycode', type: 'text', required: true, placeholder: 'BACK' }] },
  { type: 'back', category: 'mobile', label: 'Back', description: 'Navigate back (Android hardware back / iOS nav back)', color: '#E91E63', inputs: [] },
  { type: 'hide_keyboard', category: 'mobile', label: 'Hide Keyboard', description: 'Dismiss the on-screen keyboard', color: '#E91E63', inputs: [] },
  { type: 'launch_app', category: 'mobile', label: 'Launch App', description: 'Launch (or bring to foreground) the app under test', color: '#E91E63', inputs: [] },
  { type: 'stop_app', category: 'mobile', label: 'Stop App', description: 'Terminate the app under test', color: '#E91E63', inputs: [] },
  { type: 'deep_link', category: 'mobile', label: 'Open Deep Link', description: 'Open a deep link URL into the app', color: '#E91E63', inputs: [{ name: 'url', label: 'URL', type: 'text', required: true, placeholder: 'myapp://product/42' }] },
  { type: 'screenshot_mobile', category: 'mobile', label: 'Take Screenshot (Mobile)', description: 'Capture a screenshot of the device screen', color: '#E91E63', inputs: [{ name: 'name', label: 'Label', type: 'text', placeholder: 'step-1' }] },
  { type: 'set_orientation', category: 'mobile', label: 'Set Orientation', description: 'Rotate the device/simulator', color: '#E91E63', inputs: [{ name: 'orientation', label: 'Orientation', type: 'dropdown', required: true, default: 'PORTRAIT', options: [{ label: 'Portrait', value: 'PORTRAIT' }, { label: 'Landscape', value: 'LANDSCAPE' }] }] },
];
