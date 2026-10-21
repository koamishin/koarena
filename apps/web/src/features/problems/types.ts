export interface ProblemTestCaseDto {
  id: string
  order: number
  input: string
  expectedOutput: string
  isSample: boolean
  points: number
}

export interface ProblemDto {
  id: string
  slug: string
  title: string
  statement: string
  difficulty: string
  points: number
  timeLimitMs: number
  memoryLimitKb: number
  solveCount: number
  maxSolves: number | null
  /** The languages this problem may be solved in. */
  languages: Array<{
    id: string
    slug: string
    name: string
    editorMode: string
  }>
  /** Sample cases are visible; the rest are hidden. */
  testCases: ProblemTestCaseDto[]
  hiddenTestCaseCount: number
  /** Whether the viewer already solved it. */
  solved: boolean
  solvedAt: string | null
  pointsAwarded: number | null
}

export interface SubmissionDto {
  id: string
  status: string
  verdict: string | null
  stdout: string | null
  stderr: string | null
  timeMs: number | null
  memoryKb: number | null
  exitCode: number | null
  sourceCode: string
  languageSlug: string
  languageName: string
  submittedAt: string
  judgedAt: string | null
}
