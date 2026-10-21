import { Link } from '@tanstack/react-router'

export function KoArenaFooter() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-2 px-4 py-8 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
        <p>KoArena — tournaments for programmers.</p>
        <nav className="flex items-center gap-4">
          <Link
            to="/tournaments"
            className="transition-colors hover:text-foreground"
          >
            Tournaments
          </Link>
          <Link
            to="/leaderboard"
            className="transition-colors hover:text-foreground"
          >
            Leaderboard
          </Link>
        </nav>
      </div>
    </footer>
  )
}
