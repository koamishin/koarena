import { createFileRoute } from '@tanstack/react-router'

import { Badge } from '@/components/reui/badge'
import {
  Frame,
  FrameDescription,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from '@/components/reui/frame'

export const Route = createFileRoute('/leaderboard')({
  component: LeaderboardPage,
})

const boards = [
  {
    id: '1',
    title: 'All-time players',
    note: 'Every player, every mode.',
    soon: false,
  },
  {
    id: '2',
    title: 'Current season',
    note: 'Rolling 90 day window.',
    soon: false,
  },
  {
    id: '3',
    title: 'By language',
    note: 'Which language wins most.',
    soon: true,
  },
  {
    id: '4',
    title: 'By country',
    note: 'Needs verified profiles.',
    soon: true,
  },
] as const

function LeaderboardPage() {
  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-10">
      <Frame spacing="default" variant="default">
        <FrameHeader>
          <FrameTitle>Leaderboards</FrameTitle>
          <FrameDescription>
            Public standings across the platform.
          </FrameDescription>
        </FrameHeader>
        <FramePanel>
          <div className="grid gap-3 sm:grid-cols-2">
            {boards.map((board) => (
              <div
                key={board.id}
                className="flex items-center justify-between gap-3 rounded-md border border-border px-3 py-2.5"
              >
                <div className="flex flex-col gap-0.5">
                  <span className="text-sm font-medium">{board.title}</span>
                  <span className="text-xs text-muted-foreground">
                    {board.note}
                  </span>
                </div>
                {board.soon ? (
                  <Badge variant="outline" size="sm">
                    Soon
                  </Badge>
                ) : (
                  <Badge variant="success-light" size="sm">
                    Live
                  </Badge>
                )}
              </div>
            ))}
          </div>
        </FramePanel>
      </Frame>
    </div>
  )
}
