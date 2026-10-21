import Editor, { loader, type OnMount } from '@monaco-editor/react'
import * as monaco from 'monaco-editor'
import editorWorker from 'monaco-editor/editor/editor.worker?worker'
import cssWorker from 'monaco-editor/language/css/css.worker?worker'
import htmlWorker from 'monaco-editor/language/html/html.worker?worker'
import jsonWorker from 'monaco-editor/language/json/json.worker?worker'
import tsWorker from 'monaco-editor/language/typescript/ts.worker?worker'
import { useEffect, useMemo, useRef, useState } from 'react'

import { cn } from '@/lib/utils'

import type { CodeEditorProps } from './CodeEditor'

// Monaco loads its workers through a bundler-aware environment. Without this
// the editor renders but every language service fails to start.
self.MonacoEnvironment = {
  getWorker(_moduleId: string, label: string) {
    if (label === 'json') return new jsonWorker()
    if (label === 'css' || label === 'scss' || label === 'less') {
      return new cssWorker()
    }
    if (label === 'html' || label === 'handlebars' || label === 'razor') {
      return new htmlWorker()
    }
    if (label === 'typescript' || label === 'javascript') return new tsWorker()
    return new editorWorker()
  },
}

loader.config({ monaco })

/**
 * The languages Monaco ships with.
 *
 * The `languages` table stores an editor mode per language; a mode Monaco does
 * not know falls back to plain text, which still submits.
 */
const MONACO_LANGUAGE: Record<string, string> = {
  c: 'c',
  cpp: 'cpp',
  csharp: 'csharp',
  java: 'java',
  javascript: 'javascript',
  typescript: 'typescript',
  python: 'python',
  go: 'go',
  rust: 'rust',
  ruby: 'ruby',
  php: 'php',
  shell: 'shell',
  lua: 'lua',
  scala: 'scala',
  dart: 'dart',
  perl: 'perl',
  r: 'r',
  sql: 'sql',
}

export function monacoLanguage(editorMode: string): string {
  return MONACO_LANGUAGE[editorMode] ?? 'plaintext'
}

export default function MonacoEditor({
  value,
  onChange,
  language,
  readOnly = false,
  className,
}: CodeEditorProps) {
  const [ready, setReady] = useState(false)
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null)

  useEffect(() => {
    // Monaco is a large bundle; the editor is only fetched when it is shown.
    loader.init().then(() => setReady(true))
  }, [])

  const handleMount: OnMount = (editor) => {
    editorRef.current = editor
    editor.focus()
  }

  // Each language gets its own model, so switching languages does not throw
  // away the code.
  const model = useMemo(
    () => `inmemory://koarena/model.${monacoLanguage(language)}`,
    [language],
  )

  if (!ready) {
    return (
      <div
        className={cn(
          'grid place-items-center rounded-md border border-border bg-muted/30 font-mono text-xs text-muted-foreground',
          className,
        )}
        style={{ minHeight: '18rem' }}
      >
        Loading the editor…
      </div>
    )
  }

  return (
    <div
      className={cn(
        'overflow-hidden rounded-md border border-border',
        className,
      )}
    >
      <Editor
        height="22rem"
        language={monacoLanguage(language)}
        path={model}
        value={value}
        onChange={(next) => onChange(next ?? '')}
        onMount={handleMount}
        options={{
          readOnly,
          minimap: { enabled: false },
          fontSize: 13,
          fontFamily:
            'ui-monospace, SFMono-Regular, "JetBrains Mono", Menlo, monospace',
          scrollBeyondLastLine: false,
          automaticLayout: true,
          tabSize: 4,
          insertSpaces: true,
          padding: { top: 12, bottom: 12 },
        }}
      />
    </div>
  )
}
