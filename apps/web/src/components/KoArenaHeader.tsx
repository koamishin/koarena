import { Show, UserButton } from '@clerk/tanstack-react-start'
import { Link, useRouterState } from '@tanstack/react-router'
import { ThemeToggle } from '@/components/ThemeToggle'
import { Button } from '@/components/ui/button'

const nav = [
  { to: '/tournaments', label: 'Tournaments' },
  { to: '/leaderboard', label: 'Leaderboard' },
] as const

export function KoArenaHeader() {
  const pathname = useRouterState({ select: (s) => s.location.pathname })

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/85 backdrop-blur">
      <div className="mx-auto flex h-14 w-full max-w-6xl items-center gap-6 px-4">
        <Link
          to="/"
          className="flex items-center gap-2 font-semibold tracking-tight"
        >
          <span
            aria-hidden
            className="grid size-7 place-items-center rounded-md bg-primary font-mono text-xs font-bold text-primary-foreground"
          >
            K
          </span>
          KoArena
        </Link>

        <nav className="flex items-center gap-1">
          {nav.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              className={`rounded-md px-2.5 py-1.5 text-sm transition-colors hover:bg-muted hover:text-foreground ${
                isActivePath(pathname, item.to)
                  ? 'text-foreground'
                  : 'text-muted-foreground'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          <Show when="signed-out">
            <Button
              size="sm"
              variant="outline"
              render={<Link to="/sign-in/$" params={{ _splat: '' }} />}
            >
              Sign in
            </Button>
            <Button
              size="sm"
              render={<Link to="/sign-up/$" params={{ _splat: '' }} />}
            >
              Join KoArena
            </Button>
          </Show>
          <Show when="signed-in">
            <Button
              size="sm"
              variant="outline"
              render={<Link to="/dashboard" />}
            >
              Dashboard
            </Button>
            <UserButton />
          </Show>
        </div>
      </div>
    </header>
  )
}

export function isActivePath(pathname: string, to: string) {
  return pathname === to || pathname.startsWith(`${to}/`)
}
