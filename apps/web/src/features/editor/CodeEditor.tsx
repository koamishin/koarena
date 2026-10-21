import { lazy, Suspense, useEffect, useState } from 'react'

import { cn } from '@/lib/utils'

/**
 * The code editor.
 *
 * Monaco is a browser-only library: it imports its own stylesheets and starts
 * workers, none of which the server can do. The real editor is therefore
 * loaded lazily and only in the browser, and the server renders the
 * placeholder. Without this the server render of any page with an editor
 * fails on the stylesheet import.
 */

const MonacoEditor = lazy(() => import('./MonacoEditor'))

export interface CodeEditorProps {
  value: string
  onChange: (value: string) => void
  /** The editor mode of the chosen language, e.g. `python`. */
  language: string
  readOnly?: boolean
  className?: string
  /** Shown while the editor loads. */
  placeholder?: string
}

function Placeholder({
  className,
  text,
}: {
  className?: string
  text: string
}) {
  return (
    <div
      className={cn(
        'grid place-items-center rounded-md border border-border bg-muted/30 font-mono text-xs text-muted-foreground',
        className,
      )}
      style={{ minHeight: '18rem' }}
    >
      {text}
    </div>
  )
}

export function CodeEditor({
  value,
  onChange,
  language,
  readOnly = false,
  className,
  placeholder = 'Loading the editor…',
}: CodeEditorProps) {
  const [inBrowser, setInBrowser] = useState(false)

  useEffect(() => {
    setInBrowser(true)
  }, [])

  if (!inBrowser) {
    return <Placeholder className={className} text={placeholder} />
  }

  return (
    <Suspense
      fallback={<Placeholder className={className} text={placeholder} />}
    >
      <MonacoEditor
        value={value}
        onChange={onChange}
        language={language}
        readOnly={readOnly}
        className={className}
      />
    </Suspense>
  )
}
