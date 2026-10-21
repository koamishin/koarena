import { Link } from '@tanstack/react-router'
import {
  type ColumnDef,
  type PaginationState,
  type SortingState,
  useTable,
} from '@tanstack/react-table'
import { useMemo, useState } from 'react'

import { Badge } from '@/components/reui/badge'
import {
  DataGrid,
  DataGridContainer,
  type DataGridFeatures,
  dataGridFeatures,
} from '@/components/reui/data-grid/data-grid'
import { DataGridPagination } from '@/components/reui/data-grid/data-grid-pagination'
import { DataGridScrollArea } from '@/components/reui/data-grid/data-grid-scroll-area'
import { DataGridTable } from '@/components/reui/data-grid/data-grid-table'
import { Button } from '@/components/ui/button'

import type { TournamentSummary } from '../types'

const STATUS_VARIANT = {
  DRAFT: 'outline',
  SCHEDULED: 'info-light',
  REGISTRATION: 'primary-light',
  LIVE: 'success-light',
  PAUSED: 'warning-light',
  FINISHED: 'outline',
  CANCELLED: 'destructive-light',
} as const

const STATUS_LABEL = {
  DRAFT: 'Draft',
  SCHEDULED: 'Scheduled',
  REGISTRATION: 'Open',
  LIVE: 'Live',
  PAUSED: 'Paused',
  FINISHED: 'Finished',
  CANCELLED: 'Cancelled',
} as const

export interface TournamentsGridProps {
  tournaments: TournamentSummary[]
  emptyAction?: { label: string; to: string }
}

export function TournamentsGrid({
  tournaments,
  emptyAction,
}: TournamentsGridProps) {
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 10,
  })
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'startsAt', desc: false },
  ])

  const columns = useMemo<ColumnDef<DataGridFeatures, TournamentSummary>[]>(
    () => [
      {
        accessorKey: 'name',
        header: 'Tournament',
        size: 220,
        cell: ({ row }) => (
          <Link
            to="/tournaments/$slug"
            params={{ slug: row.original.slug }}
            className="font-medium transition-colors hover:text-primary hover:underline"
          >
            {row.original.name}
          </Link>
        ),
        meta: { headerClassName: '', cellClassName: '' },
      },
      {
        accessorKey: 'gameModeLabel',
        header: 'Mode',
        size: 150,
        cell: (info) => (
          <Badge variant="outline" size="sm">
            {info.getValue() as string}
          </Badge>
        ),
        meta: { headerClassName: '', cellClassName: '' },
      },
      {
        accessorKey: 'status',
        header: 'Status',
        size: 120,
        cell: (info) => {
          const status = info.getValue() as TournamentSummary['status']
          return (
            <Badge variant={STATUS_VARIANT[status]} size="sm">
              {STATUS_LABEL[status]}
            </Badge>
          )
        },
        meta: { headerClassName: '', cellClassName: '' },
      },
      {
        accessorKey: 'startsAt',
        header: 'Starts',
        size: 160,
        cell: (info) => (
          <span className="text-muted-foreground">
            {new Date(info.getValue() as string).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        ),
        meta: { headerClassName: '', cellClassName: '' },
      },
      {
        accessorKey: 'teamCount',
        header: 'Teams',
        size: 90,
        cell: (info) => (
          <span className="tabular-nums">{info.getValue() as number}</span>
        ),
        meta: { headerClassName: 'text-right', cellClassName: 'text-right' },
      },
      {
        accessorKey: 'maxTeams',
        header: 'Limit',
        size: 90,
        cell: (info) => {
          const max = info.getValue() as number | null
          return (
            <span className="tabular-nums text-muted-foreground">
              {max ?? '—'}
            </span>
          )
        },
        meta: { headerClassName: 'text-right', cellClassName: 'text-right' },
      },
    ],
    [],
  )

  const table = useTable({
    features: dataGridFeatures,
    columns,
    data: tournaments,
    pageCount: Math.ceil(tournaments.length / pagination.pageSize),
    getRowId: (row: TournamentSummary) => row.id,
    state: { pagination, sorting },
    onPaginationChange: setPagination,
    onSortingChange: setSorting,
  })

  if (tournaments.length === 0) {
    return (
      <div className="flex flex-col items-start gap-3 rounded-md border border-border px-4 py-8">
        <p className="text-sm font-medium">No tournaments yet</p>
        <p className="text-sm text-muted-foreground">
          Once a tournament is published it shows up here.
        </p>
        {emptyAction ? (
          <Button
            size="sm"
            variant="outline"
            nativeButton={false}
            render={<Link to={emptyAction.to} />}
          >
            {emptyAction.label}
          </Button>
        ) : null}
      </div>
    )
  }

  return (
    <DataGrid table={table} recordCount={tournaments.length}>
      <div className="flex w-full flex-col gap-2.5">
        <DataGridContainer>
          <DataGridScrollArea>
            <DataGridTable />
          </DataGridScrollArea>
        </DataGridContainer>
        <DataGridPagination />
      </div>
    </DataGrid>
  )
}
