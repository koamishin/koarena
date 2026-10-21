export interface ChallengeCategoryDto {
  id: string
  name: string
  slug: string
  color: string | null
  description: string | null
  order: number
  challengeCount: number
}

export interface ChallengeDto {
  id: string
  slug: string
  title: string
  description: string
  difficulty: string
  state: string
  categoryId: string | null
  categoryName: string | null
  categorySlug: string | null
  categoryColor: string | null
  /** What a solve is worth right now, after decay. */
  currentPoints: number
  initialPoints: number
  minPoints: number
  decayPerSolve: number
  solveCount: number
  maxSolves: number | null
  firstBloodClaimed: boolean
  /** Whether the viewer already solved it. */
  solved: boolean
  solvedAt: string | null
  pointsAwarded: number | null
  hints: Array<{
    id: string
    content: string
    cost: number
    unlocksAt: string | null
    /** Hints are hidden until the viewer pays the cost or they unlock. */
    revealed: boolean
  }>
  files: Array<{ id: string; name: string; url: string; sizeBytes: number }>
  flagCount: number
  hasFlag: boolean
  createdAt: string
}

export interface ChallengeBoard {
  categories: ChallengeCategoryDto[]
  challenges: ChallengeDto[]
  /** Challenges that are hidden until a prerequisite is solved. */
  lockedCount: number
}
