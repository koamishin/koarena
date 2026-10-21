import { createFileRoute, Link, Outlet } from '@tanstack/react-router'

import { Button } from '@/components/ui/button'

/**
 * Layout route for /organizer.
 *
 * TanStack's file-based router treats `organizer.tsx` as the parent of
 * `organizer.index.tsx`, `organizer.new.tsx` and `organizer.$tournamentId.tsx`.
 */
export const Route = createFileRoute('/organizer')({
  component: OrganizerLayout,
})

function OrganizerLayout() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-10">
      <nav className="flex items-center gap-2">
        <Button
          size="sm"
          variant="ghost"
          nativeButton={false}
          render={<Link to="/organizer" />}
        >
          Your tournaments
        </Button>
        <Button
          size="sm"
          variant="ghost"
          nativeButton={false}
          render={<Link to="/organizer/new" />}
        >
          New tournament
        </Button>
      </nav>
      <Outlet />
    </div>
  )
}
