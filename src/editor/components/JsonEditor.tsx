import React, { useRef, useEffect, useCallback } from 'react';
import Editor, { OnMount, BeforeMount } from '@monaco-editor/react';
import { TestFile } from '../../schema';
import { getTkSchema } from '../schema/tkSchema';
import { useStore } from '../store';

interface Props {
  file: TestFile;
  onChange: (file: TestFile) => void;
}

export function JsonEditor({ file, onChange }: Props) {
  const editorRef = useRef<any>(null);
  const valueRef = useRef(JSON.stringify(file, null, 2));
  const isLocalEdit = useRef(false);
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Update editor when file changes from external source (visual tab edits)
  useEffect(() => {
    if (isLocalEdit.current) {
      isLocalEdit.current = false;
      return;
    }
    const newValue = JSON.stringify(file, null, 2);
    if (editorRef.current && newValue !== valueRef.current) {
      valueRef.current = newValue;
      const editor = editorRef.current;
      const model = editor.getModel();
      if (!model) return;

      // Use pushEditOperations to preserve cursor and undo stack
      const fullRange = model.getFullModelRange();
      editor.executeEdits('external-sync', [{
        range: fullRange,
        text: newValue,
        forceMoveMarkers: true,
      }]);
    }
  }, [file]);

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
    valueRef.current = value;

    // Debounce parse + propagation to avoid thrashing visual tab
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      try {
        const parsed = JSON.parse(value);
        isLocalEdit.current = true;
        onChange(parsed);
      } catch {
        // Invalid JSON — Monaco shows error inline
      }
    }, 300);
  }, [onChange]);

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      if (debounceTimer.current) clearTimeout(debounceTimer.current);
    };
  }, []);

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
      <div className="flex-1">
        <Editor
          defaultLanguage="json"
          defaultValue={JSON.stringify(file, null, 2)}
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
