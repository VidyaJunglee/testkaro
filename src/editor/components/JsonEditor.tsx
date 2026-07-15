import React, { useRef, useEffect, useCallback } from 'react';
import Editor, { OnMount, BeforeMount } from '@monaco-editor/react';
import { TestFile } from '../../schema';
import { getTkSchema } from '../schema/tkSchema';
import { useStore } from '../store';

interface Props {
  file: TestFile;
  onChange: (file: TestFile) => void;
}

function applyIds(file: TestFile): TestFile {
  if (file.tests) {
    for (const test of file.tests) {
      if (!test.id) test.id = crypto.randomUUID();
      if (test.steps) {
        for (const step of test.steps) {
          if (!step.id) step.id = crypto.randomUUID();
        }
      } else {
        test.steps = [];
      }
    }
  }
  return file;
}

export function JsonEditor({ file, onChange }: Props) {
  const editorRef = useRef<any>(null);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastPushedJson = useRef<string>(JSON.stringify(file, null, 2));
  const pendingValueRef = useRef<string | null>(null);
  // Module/app the pending edit belongs to — a flush into a different module
  // would overwrite it with the old module's JSON.
  const editContextRef = useRef<{ mod: number | null; app: string | null }>({ mod: null, app: null });
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const tab = useStore(s => s.tab);

  // Apply or discard the pending edit. Discards (and re-syncs Monaco from the
  // store) when the module/app changed since the edit was made.
  const flushPending = useCallback(() => {
    if (debounceTimer.current) {
      clearTimeout(debounceTimer.current);
      debounceTimer.current = null;
    }
    const pending = pendingValueRef.current;
    pendingValueRef.current = null;
    if (!pending) return;

    const s = useStore.getState() as any;
    const contextChanged =
      editContextRef.current.mod !== (s.activeModuleIndex ?? null) ||
      editContextRef.current.app !== (s.currentAppId ?? null);

    if (contextChanged) {
      const currentJson = JSON.stringify(s.file, null, 2);
      lastPushedJson.current = currentJson;
      const model = editorRef.current?.getModel();
      if (model && model.getValue() !== currentJson) model.setValue(currentJson);
      useStore.getState().setJsonInvalid(false);
      return;
    }

    try {
      const parsed = applyIds(JSON.parse(pending));
      lastPushedJson.current = JSON.stringify(parsed, null, 2);
      onChangeRef.current(parsed);
      useStore.getState().setJsonInvalid(false);
    } catch {
      // Invalid JSON — Monaco shows inline error; block Run until fixed.
      useStore.getState().setJsonInvalid(true);
    }
  }, []);

  // Serialize file to JSON for comparison
  const fileJson = JSON.stringify(file, null, 2);

  // Sync store → editor when file changes externally (visual edits, module switch, etc.)
  useEffect(() => {
    if (!editorRef.current) return;
    // Don't push external changes while user is actively editing (debounce pending)
    if (pendingValueRef.current !== null) return;
    // Only push if the new JSON differs from what we last pushed to the store
    if (fileJson === lastPushedJson.current) return;

    const model = editorRef.current.getModel();
    if (!model) return;

    const currentValue = model.getValue();
    if (fileJson === currentValue) return;

    // Push the external change into Monaco
    lastPushedJson.current = fileJson;
    const fullRange = model.getFullModelRange();
    editorRef.current.executeEdits('external-sync', [{
      range: fullRange,
      text: fileJson,
      forceMoveMarkers: true,
    }]);
  }, [fileJson]);

  // Flush pending debounce when switching away from JSON tab
  // This ensures edits are applied before the visual tab renders
  useEffect(() => {
    if (tab !== 'json') flushPending();
  }, [tab, flushPending]);

  const handleBeforeMount: BeforeMount = (monaco) => {
    const schema = getTkSchema();
    monaco.languages.json.jsonDefaults.setDiagnosticsOptions({
      validate: true,
      schemas: [
        {
          uri: 'https://testkaro.dev/schema.json',
          fileMatch: ['*'],
          schema,
        },
      ],
      enableSchemaRequest: false,
    });
  };

  const handleMount: OnMount = (editor, monaco) => {
    editorRef.current = editor;

    editor.updateOptions({
      fontSize: 14,
      lineHeight: 24,
      fontFamily: "'SF Mono', 'Cascadia Code', 'Fira Code', 'JetBrains Mono', monospace",
      fontLigatures: true,
      minimap: { enabled: false },
      scrollBeyondLastLine: false,
      padding: { top: 12, bottom: 12 },
      renderLineHighlight: 'line',
      cursorBlinking: 'smooth',
      cursorSmoothCaretAnimation: 'on',
      smoothScrolling: true,
      bracketPairColorization: { enabled: true },
      guides: { bracketPairs: true, indentation: true },
      suggest: {
        showKeywords: true,
        showSnippets: false,
        preview: true,
        snippetsPreventQuickSuggestions: true,
        filterGraceful: true,
      },
      quickSuggestions: { strings: true, other: true, comments: false },
      acceptSuggestionOnCommitCharacter: false,
      acceptSuggestionOnEnter: 'off',
      tabSize: 2,
      formatOnPaste: false,
      autoClosingBrackets: 'always',
      autoClosingQuotes: 'always',
    });

    editor.addAction({
      id: 'format-document',
      label: 'Format Document',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.KeyF],
      run: () => {
        editor.getAction('editor.action.formatDocument')?.run();
      },
    });
  };

  const handleChange = useCallback((value: string | undefined) => {
    if (!value) return;

    pendingValueRef.current = value;
    const s = useStore.getState() as any;
    editContextRef.current = { mod: s.activeModuleIndex ?? null, app: s.currentAppId ?? null };

    // Immediate feedback for the invalid-JSON banner — don't wait for the debounce.
    try {
      JSON.parse(value);
      s.setJsonInvalid(false);
    } catch {
      s.setJsonInvalid(true);
    }

    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      debounceTimer.current = null;
      flushPending();
    }, 300);
  }, [flushPending]);

  // Flush (not discard) any pending edit on unmount
  useEffect(() => {
    return () => flushPending();
  }, [flushPending]);

  const jsonInvalid = useStore(s => s.jsonInvalid);

  return (
    <div className="flex flex-col flex-1 h-full bg-bg-primary">
      <div className="flex items-center gap-3 px-4 h-10 bg-bg-secondary border-b border-border">
        <span className="text-sm text-text-tertiary font-mono font-medium tracking-wide">
          testkaro.json
        </span>
        <span className="text-xs text-text-tertiary ml-auto">
          Ctrl+Space for suggestions &middot; Tab to accept
        </span>
      </div>
      {jsonInvalid && (
        <div className="px-4 py-1.5 bg-danger/10 border-b border-danger/30 text-xs text-danger font-medium">
          Invalid JSON — fix syntax errors before running
        </div>
      )}
      <div className="flex-1">
        <Editor
          defaultLanguage="json"
          defaultValue={fileJson}
          theme={useStore(s => s.darkMode) ? 'vs-dark' : 'light'}
          beforeMount={handleBeforeMount}
          onMount={handleMount}
          onChange={handleChange}
          options={{
            wordWrap: 'on',
          }}
        />
      </div>
    </div>
  );
}
