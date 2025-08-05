import React, { useCallback, useRef } from 'react';
import CodeMirror from '@uiw/react-codemirror';
import { EditorView, keymap } from '@codemirror/view';
import { createTheme } from '@uiw/codemirror-themes';
import { tags as t } from '@lezer/highlight';
import { javascript } from '@codemirror/lang-javascript';
import { python } from '@codemirror/lang-python';
import { json } from '@codemirror/lang-json';
import { css } from '@codemirror/lang-css';
import { html } from '@codemirror/lang-html';
import { markdown } from '@codemirror/lang-markdown';
import { search, highlightSelectionMatches } from '@codemirror/search';
import { autocompletion } from '@codemirror/autocomplete';
import { lintGutter } from '@codemirror/lint';
import { bracketMatching } from '@codemirror/language';
import { cn } from '@/lib/utils';

interface CodeEditorProps {
  value: string;
  onChange: (value: string) => void;
  language: string;
  theme?: 'light' | 'dark';
  readOnly?: boolean;
  placeholder?: string;
  className?: string;
  height?: string;
  onSave?: () => void;
}

const getLanguageExtension = (language: string) => {
  switch (language.toLowerCase()) {
    case 'javascript':
    case 'js':
    case 'jsx':
      return javascript({ jsx: true });
    case 'typescript':
    case 'ts':
    case 'tsx':
      return javascript({ jsx: true, typescript: true });
    case 'python':
    case 'py':
      return python();
    case 'json':
      return json();
    case 'css':
      return css();
    case 'html':
    case 'htm':
      return html();
    case 'markdown':
    case 'md':
      return markdown();
    default:
      return [];
  }
};

// Create shadcn-compatible theme with proper syntax highlighting
const createShadcnTheme = (theme: 'light' | 'dark') => {
  const isDark = theme === 'dark';
  
  return createTheme({
    theme: theme,
    settings: {
      background: 'hsl(var(--background))',
      foreground: 'hsl(var(--foreground))',
      caret: 'hsl(var(--foreground))',
      selection: isDark ? '#264f78' : '#add6ff',
      selectionMatch: isDark ? '#264f7880' : '#add6ff80',
      lineHighlight: isDark ? '#ffffff08' : '#00000008',
      gutterBackground: 'hsl(var(--background))',
      gutterForeground: 'hsl(var(--muted-foreground))',
    },
    styles: [
      { tag: t.comment, color: isDark ? '#8b949e' : '#6a737d', fontStyle: 'italic' },
      { tag: t.string, color: isDark ? '#a5d6ff' : '#032f62' },
      { tag: t.number, color: isDark ? '#79c0ff' : '#005cc5' },
      { tag: t.keyword, color: isDark ? '#ff7b72' : '#d73a49', fontWeight: 'bold' },
      { tag: t.operator, color: isDark ? '#ff7b72' : '#d73a49' },
      { tag: t.punctuation, color: 'hsl(var(--foreground))' },
      { tag: t.function(t.variableName), color: isDark ? '#d2a8ff' : '#6f42c1' },
      { tag: t.variableName, color: isDark ? '#ffa657' : '#e36209' },
      { tag: t.propertyName, color: isDark ? '#79c0ff' : '#005cc5' },
      { tag: t.className, color: isDark ? '#d2a8ff' : '#6f42c1' },
      { tag: t.tagName, color: isDark ? '#7ee787' : '#22863a' },
      { tag: t.attributeName, color: isDark ? '#d2a8ff' : '#6f42c1' },
      { tag: t.bracket, color: 'hsl(var(--foreground))' },
      { tag: t.brace, color: 'hsl(var(--foreground))' },
      { tag: t.bool, color: isDark ? '#79c0ff' : '#005cc5' },
      { tag: t.null, color: isDark ? '#79c0ff' : '#005cc5' },
      { tag: t.escape, color: isDark ? '#a5d6ff' : '#032f62' },
    ],
  });
};

export const CodeEditor: React.FC<CodeEditorProps> = ({
  value,
  onChange,
  language,
  theme = 'dark',
  readOnly = false,
  placeholder,
  className,
  height = '100%',
  onSave,
}) => {
  const editorRef = useRef<EditorView | null>(null);

  const extensions = [
    // Language support
    getLanguageExtension(language),
    // Editor features
    search(),
    highlightSelectionMatches(),
    autocompletion(),
    bracketMatching(),
    lintGutter(),
    // Key bindings
    keymap.of([
      {
        key: 'Cmd-s',
        mac: 'Cmd-s',
        win: 'Ctrl-s',
        run: () => {
          onSave?.();
          return true;
        },
      },
    ]),
    // Editor styling
    EditorView.theme({
      '&': {
        height: height,
        fontSize: '0.875rem', // 14px equivalent at 16px base
        border: 'none !important',
        outline: 'none !important',
      },
      '.cm-editor': {
        height: '100%',
        border: 'none !important',
        outline: 'none !important',
      },
      '.cm-focused': {
        outline: 'none !important',
        border: 'none !important',
        boxShadow: 'none !important',
      },
      '.cm-editor.cm-focused': {
        outline: 'none !important',
        border: 'none !important',
        boxShadow: 'none !important',
      },
      '.cm-scroller': {
        height: '100%',
        border: 'none !important',
        outline: 'none !important',
      },
      '.cm-content': {
        padding: '1rem',
        minHeight: '100%',
        border: 'none !important',
        outline: 'none !important',
      },
      '.cm-line': {
        padding: '0 0.5rem',
      },
    }),
  ];

  const onValueChange = useCallback(
    (val: string) => {
      onChange(val);
    },
    [onChange]
  );

  const onEditorCreate = useCallback((view: EditorView) => {
    editorRef.current = view;
  }, []);

  return (
    <div className={cn('h-full w-full', className)}>
      <CodeMirror
        value={value}
        onChange={onValueChange}
        theme={createShadcnTheme(theme)}
        extensions={extensions}
        readOnly={readOnly}
        placeholder={placeholder}
        basicSetup={{
          lineNumbers: true,
          foldGutter: true,
          dropCursor: false,
          allowMultipleSelections: false,
          indentOnInput: true,
          bracketMatching: true,
          closeBrackets: true,
          autocompletion: true,
          highlightSelectionMatches: true,
          searchKeymap: true,
        }}
        onCreateEditor={onEditorCreate}
      />
    </div>
  );
};
