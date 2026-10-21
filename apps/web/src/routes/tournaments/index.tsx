import { createFileRoute } from '@tanstack/react-router'
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
import {
  Frame,
  FrameDescription,
  FrameHeader,
  FramePanel,
  FrameTitle,
} from '@/components/reui/frame'

export const Route = createFileRoute('/tournaments/')({
  component: TournamentsPage,
})

type Row = {
  id: string
  rank: number
  team: string
  mode: string
  solves: number
  score: number
  penalty: number
  status: 'live' | 'scheduled' | 'finished'
}

const rows: Row[] = [
  {
    id: '1',
    rank: 1,
    team: 'Segfault Society',
    mode: 'CTF',
    solves: 14,
    score: 4825,
    penalty: 0,
    status: 'live',
  },
  {
    id: '2',
    rank: 2,
    team: 'Null Pointers',
    mode: 'CTF',
    solves: 12,
    score: 4310,
    penalty: 0,
    status: 'live',
  },
  {
    id: '3',
    rank: 3,
    team: 'Bit Busters',
    mode: 'ACM',
    solves: 9,
    score: 3180,
    penalty: 40,
    status: 'live',
  },
  {
    id: '4',
    rank: 4,
    team: 'The Recursion',
    mode: 'HACKATHON',
    solves: 0,
    score: 2740,
    penalty: 0,
    status: 'finished',
  },
  {
    id: '5',
    rank: 5,
    team: 'Heap Overflow',
    mode: 'ACM',
    solves: 7,
    score: 2210,
    penalty: 80,
    status: 'live',
  },
  {
    id: '6',
    rank: 6,
    team: 'Garbage Collectors',
    mode: 'CTF',
    solves: 5,
    score: 1845,
    penalty: 0,
    status: 'scheduled',
  },
  {
    id: '7',
    rank: 7,
    team: 'Off By One',
    mode: 'ACM',
    solves: 4,
    score: 1420,
    penalty: 120,
    status: 'live',
  },
  {
    id: '8',
    rank: 8,
    team: 'Undefined Behavior',
    mode: 'CTF',
    solves: 3,
    score: 990,
    penalty: 0,
    status: 'finished',
  },
]

const statusVariant = {
  live: 'success-light',
  scheduled: 'info-light',
  finished: 'outline',
} as const

const statusLabel = {
  live: 'Live',
  scheduled: 'Scheduled',
  finished: 'Finished',
} as const

function TournamentsPage() {
  const [pagination, setPagination] = useState<PaginationState>({
    pageIndex: 0,
    pageSize: 5,
  })
  const [sorting, setSorting] = useState<SortingState>([
    { id: 'score', desc: true },
  ])

  const columns = useMemo<ColumnDef<DataGridFeatures, Row>[]>(
    () => [
      {
        accessorKey: 'rank',
        header: '#',
        size: 60,
        cell: (info) => (
          <span className="tabular-nums text-muted-foreground">
            {info.getValue() as number}
          </span>
        ),
        meta: { headerClassName: 'text-right', cellClassName: 'text-right' },
      },
      {
        accessorKey: 'team',
        header: 'Team',
        size: 200,
        cell: (info) => (
          <span className="font-medium">{info.getValue() as string}</span>
        ),
        meta: { headerClassName: '', cellClassName: '' },
      },
      {
        accessorKey: 'mode',
        header: 'Mode',
        size: 140,
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
          const status = info.getValue() as Row['status']
          return (
            <Badge variant={statusVariant[status]} size="sm">
              {statusLabel[status]}
            </Badge>
          )
        },
        meta: { headerClassName: '', cellClassName: '' },
      },
      {
        accessorKey: 'solves',
        header: 'Solved',
        size: 90,
        cell: (info) => (
          <span className="tabular-nums">{info.getValue() as number}</span>
        ),
        meta: { headerClassName: 'text-right', cellClassName: 'text-right' },
      },
      {
        accessorKey: 'penalty',
        header: 'Penalty',
        size: 90,
        cell: (info) => (
          <span className="tabular-nums text-muted-foreground">
            {info.getValue() as number}
          </span>
        ),
        meta: { headerClassName: 'text-right', cellClassName: 'text-right' },
      },
      {
        accessorKey: 'score',
        header: 'Score',
        size: 100,
        cell: (info) => (
          <span className="tabular-nums font-medium">
            {(info.getValue() as number).toLocaleString()}
          </span>
        ),
        meta: { headerClassName: 'text-right', cellClassName: 'text-right' },
      },
    ],
    [],
  )

  const table = useTable({
    features: dataGridFeatures,
    columns,
    data: rows,
    pageCount: Math.ceil(rows.length / pagination.pageSize),
    getRowId: (row: Row) => row.id,
    state: { pagination, sorting },
    onPaginationChange: setPagination,
    onSortingChange: setSorting,
  })

  return (
    <div className="mx-auto flex w-full max-w-6xl flex-col gap-4 px-4 py-10">
      <Frame spacing="default" variant="default">
        <FrameHeader>
          <FrameTitle>Tournaments</FrameTitle>
          <FrameDescription>
            Live and upcoming competitions across every game mode.
          </FrameDescription>
        </FrameHeader>
        <FramePanel>
          <DataGrid table={table} recordCount={rows.length}>
            <div className="flex w-full flex-col gap-2.5">
              <DataGridContainer>
                <DataGridScrollArea>
                  <DataGridTable />
                </DataGridScrollArea>
              </DataGridContainer>
              <DataGridPagination />
            </div>
          </DataGrid>
        </FramePanel>
      </Frame>
    </div>
  )
}
