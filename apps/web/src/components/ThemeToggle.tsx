import { Moon, Sun } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'

type Theme = 'light' | 'dark' | 'auto'

function applyTheme(theme: Theme) {
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
  const resolved = theme === 'auto' ? (prefersDark ? 'dark' : 'light') : theme
  const root = document.documentElement
  root.classList.remove('light', 'dark')
  root.classList.add(resolved)
  root.style.colorScheme = resolved
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('auto')

  useEffect(() => {
    const stored = window.localStorage.getItem('theme') as Theme | null
    if (stored === 'light' || stored === 'dark' || stored === 'auto') {
      setTheme(stored)
    }
  }, [])

  function toggle() {
    const next: Theme = theme === 'dark' ? 'light' : 'dark'
    setTheme(next)
    window.localStorage.setItem('theme', next)
    applyTheme(next)
  }

  return (
    <Button
      variant="ghost"
      size="icon-sm"
      aria-label={
        theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'
      }
      onClick={toggle}
    >
      <Sun className="hidden dark:block" />
      <Moon className="block dark:hidden" />
    </Button>
  )
}
