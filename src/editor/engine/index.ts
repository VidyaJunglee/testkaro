export interface NetworkEntry {
  id: string;
  method: string;
  url: string;
  status?: number;
  duration?: number;
  size?: number;
  error?: string;
  timestamp: number;
  phase: 'request' | 'response' | 'error';
  requestHeaders?: Record<string, string>;
  postData?: string | null;
  responseHeaders?: Record<string, string>;
}

export interface ConsoleEntry {
  level: 'log' | 'warn' | 'error' | 'info' | 'debug';
  message: string;
  timestamp: number;
}

export { IframeExecutor, StepExecutionResult, ExecutionEvent } from './iframe-executor';
export { getConsoleInjectorScript } from './console-injector';
