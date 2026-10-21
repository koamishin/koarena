import { createCipheriv, randomBytes } from 'node:crypto'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../generated/prisma/client.js'

/**
 * A demo CTF to click through.
 *
 * Creates one tournament with two categories, three published challenges and
 * encrypted flags, so the challenge board, the flag form and the live
 * scoreboard all have something real to show.
 *
 *   pnpm --filter @koarena/db seed:demo
 */

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
})

function encrypt(plaintext: string) {
  const key = Buffer.from(process.env.FLAG_ENCRYPTION_KEY ?? '', 'base64')
  if (key.length !== 32) {
    throw new Error(
      'FLAG_ENCRYPTION_KEY must decode to 32 bytes. Generate one with `openssl rand -base64 32`.',
    )
  }
  const iv = randomBytes(12)
  const cipher = createCipheriv('aes-256-gcm', key, iv)
  const value = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ])
  return {
    value: value.toString('base64'),
    iv: iv.toString('base64'),
    authTag: cipher.getAuthTag().toString('base64'),
  }
}

const CHALLENGES = [
  {
    title: 'Warmup: read the source',
    slug: 'warmup-read-the-source',
    category: 'misc',
    description:
      'The flag is in the page source. Sometimes the easiest win is the one you walk past.',
    difficulty: 'easy',
    initialPoints: 100,
    minPoints: 50,
    decayPerSolve: 10,
    flag: 'koarena{read_the_html}',
  },
  {
    title: 'Base64 is not encryption',
    slug: 'base64-is-not-encryption',
    category: 'crypto',
    description:
      'The flag was "encrypted" with base64. Decode it and submit the plaintext.',
    difficulty: 'easy',
    initialPoints: 250,
    minPoints: 100,
    decayPerSolve: 25,
    flag: 'koarena{b4s364_1s_n0t_3ncrypt10n}',
  },
  {
    title: 'Counting the characters',
    slug: 'counting-the-characters',
    category: 'misc',
    description:
      'The flag is the word "koarena" repeated ten times. Divide before you submit.',
    difficulty: 'easy',
    initialPoints: 200,
    minPoints: 50,
    decayPerSolve: 20,
    flag: 'koarena{koarena{koarena{koarena{koarena{koarena{koarena{koarena{koarena{koarena{koarena{}}}}}}}}}',
  },
  {
    title: 'Injection in the search box',
    slug: 'injection-in-the-search-box',
    category: 'web',
    description:
      'The search box goes straight into a query. Quote it properly and the flag comes back.',
    difficulty: 'medium',
    initialPoints: 500,
    minPoints: 200,
    decayPerSolve: 50,
    flag: "koarena{'; SELECT flag FROM flags--}",
  },
] as const

/**
 * The demo's organizer.
 *
 * KoArena mirrors Clerk users, so the organizer is whichever account signed in
 * with DEMO_OWNER_EMAIL. Until that account has signed in at least once there
 * is no row to point at, so a placeholder stands in and the organizer's own
 * screens stay empty for them.
 */
async function main() {
  const ownerEmail =
    process.env.DEMO_OWNER_EMAIL ?? 'organizer+clerk_test@example.com'

  const existing = await prisma.user.findUnique({
    where: { email: ownerEmail },
    select: { id: true },
  })

  const owner = existing
    ? await prisma.user.update({
        where: { id: existing.id },
        data: { role: 'ORGANIZER' },
      })
    : await prisma.user.upsert({
        where: { id: 'user_demo_organizer' },
        update: { role: 'ORGANIZER' },
        create: {
          id: 'user_demo_organizer',
          email: ownerEmail,
          firstName: 'Demo',
          lastName: 'Organizer',
          role: 'ORGANIZER',
        },
      })

  const slug = 'demo-ctf'

  await prisma.tournament.deleteMany({ where: { slug } })

  const tournament = await prisma.tournament.create({
    data: {
      slug,
      name: 'KoArena Demo CTF',
      tagline: 'Three challenges, one scoreboard, live.',
      description:
        'A small tournament that exists so you can click through the board, solve something and watch the scoreboard move.',
      rules:
        'Solve challenges, submit flags. Points decay as more teams solve them.',
      gameMode: 'CTF',
      status: 'REGISTRATION',
      visibility: 'PUBLIC',
      startsAt: new Date(Date.now() - 3_600_000),
      endsAt: new Date(Date.now() + 7 * 86_400_000),
      teamSizeMin: 1,
      teamSizeMax: 5,
      createdById: owner.id,
      config: {
        basePoints: 500,
        minPoints: 100,
        decayPerSolve: 50,
        firstBloodBonus: 25,
        hintsEnabled: true,
        hintPointCost: 50,
        flagFormat: 'static',
        allowTeamSize: [1, 5],
      },
    },
  })

  const categories = await Promise.all(
    (
      [
        { name: 'Misc', slug: 'misc', color: '#7c3aed' },
        { name: 'Crypto', slug: 'crypto', color: '#0891b2' },
        { name: 'Web', slug: 'web', color: '#ea580c' },
      ] as const
    ).map((category) =>
      prisma.challengeCategory.create({
        data: { tournamentId: tournament.id, ...category },
      }),
    ),
  )

  for (const [index, challenge] of CHALLENGES.entries()) {
    const category = categories.find(
      (entry) => entry.slug === challenge.category,
    )

    const created = await prisma.challenge.create({
      data: {
        tournamentId: tournament.id,
        authorId: owner.id,
        title: challenge.title,
        slug: challenge.slug,
        description: challenge.description,
        difficulty: challenge.difficulty,
        initialPoints: challenge.initialPoints,
        minPoints: challenge.minPoints,
        decayPerSolve: challenge.decayPerSolve,
        state: 'PUBLISHED',
        publishedAt: new Date(),
        categoryId: category?.id ?? null,
      },
    })

    await prisma.flag.create({
      data: {
        tournamentId: tournament.id,
        challengeId: created.id,
        ...encrypt(challenge.flag),
        format: 'STATIC',
      },
    })

    if (index === 0) {
      await prisma.challengeHint.create({
        data: {
          challengeId: created.id,
          authorId: owner.id,
          content: 'View source. That is the whole hint.',
          cost: 10,
        },
      })
    }
  }

  await seedAlgorithms(owner.id)

  console.log(`Demo tournament ready: /tournaments/${slug}`)
  console.log('Flags:')
  for (const challenge of CHALLENGES) {
    console.log(`  ${challenge.title} -> ${challenge.flag}`)
  }
}

/**
 * A second demo tournament in the ACM style: problems with hidden test cases,
 * judged by the worker.
 */
async function seedAlgorithms(ownerId: string) {
  const slug = 'demo-algorithms'

  await prisma.tournament.deleteMany({ where: { slug } })

  const tournament = await prisma.tournament.create({
    data: {
      slug,
      name: 'KoArena Demo Algorithms',
      tagline: 'Two problems, hidden test cases, a real verdict.',
      description:
        'The algorithmic mode: submit a program, the worker runs it against the hidden test cases and scores it.',
      rules:
        'A problem counts as solved when every hidden test case passes. Wrong attempts before the first acceptance cost penalty time.',
      gameMode: 'ACM',
      status: 'LIVE',
      visibility: 'PUBLIC',
      startsAt: new Date(Date.now() - 3_600_000),
      endsAt: new Date(Date.now() + 7 * 86_400_000),
      teamSizeMin: 1,
      teamSizeMax: 5,
      createdById: ownerId,
      config: {
        problemPoints: 1,
        penaltyMinutes: 20,
        wrongSubmissionCap: 3,
        testFeedback: 'none',
        freezeScoreboard: false,
      },
    },
  })

  const languages = await prisma.language.findMany({
    where: {
      slug: { in: ['python', 'javascript', 'cpp', 'c', 'go', 'rust', 'java'] },
    },
    select: { id: true, slug: true },
  })

  const problems = [
    {
      title: 'Sum of two integers',
      slug: 'sum-of-two-integers',
      statement:
        'Read two integers from standard input and print their sum.\n\nInput: two integers separated by whitespace.\nOutput: one integer, the sum.',
      difficulty: 'easy',
      points: 1,
      cases: [
        { input: '3 4\n', expectedOutput: '7\n', isSample: true },
        { input: '10 -2\n', expectedOutput: '8\n', isSample: false },
        { input: '0 0\n', expectedOutput: '0\n', isSample: false },
      ],
    },
    {
      title: 'Reverse the string',
      slug: 'reverse-the-string',
      statement:
        'Read one line from standard input and print it reversed.\n\nInput: one line of text.\nOutput: the line reversed.',
      difficulty: 'medium',
      points: 2,
      cases: [
        { input: 'hello\n', expectedOutput: 'olleh\n', isSample: true },
        {
          input: 'koarena\n',
          expectedOutput: 'aren aok\n'.replace(' ', ''),
          isSample: false,
        },
      ],
    },
  ]

  for (const problem of problems) {
    const created = await prisma.problem.create({
      data: {
        tournamentId: tournament.id,
        authorId: ownerId,
        title: problem.title,
        slug: problem.slug,
        statement: problem.statement,
        difficulty: problem.difficulty,
        points: problem.points,
        timeLimitMs: 2000,
        memoryLimitKb: 262_144,
      },
    })

    await prisma.problemLanguage.createMany({
      data: languages.map((language) => ({
        problemId: created.id,
        languageId: language.id,
      })),
    })

    await prisma.problemTestCase.createMany({
      data: problem.cases.map((testCase, index) => ({
        problemId: created.id,
        order: index + 1,
        input: testCase.input,
        expectedOutput: testCase.expectedOutput,
        isSample: testCase.isSample,
        points: 1,
      })),
    })
  }

  console.log(`Algorithms tournament ready: /tournaments/${slug}`)
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (error) => {
    console.error(error)
    await prisma.$disconnect()
    process.exit(1)
  })
