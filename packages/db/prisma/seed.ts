import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../generated/prisma/client'

const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: process.env.DATABASE_URL }),
})

/**
 * Language registry.
 *
 * `judge0Id` maps a language to the Judge0 language id. The ids below are the
 * widely deployed Judge0 set — ALWAYS verify against your own instance:
 *
 *   GET ${JUDGE0_URL}/languages
 *
 * They are editable from the admin UI, so a mismatch is a one-field fix and
 * never a migration.
 *
 * `difficultyWeight` normalises scoring across languages (Polyglot Battle):
 * a Rust solution is worth more than a Python one because the weight is lower.
 */
const languages = [
  {
    slug: 'c',
    name: 'C',
    category: 'PROGRAMMING',
    judge0Id: 50,
    editorMode: 'c',
    extensions: ['.c', '.h'],
    difficultyWeight: 0.6,
  },
  {
    slug: 'cpp',
    name: 'C++',
    category: 'PROGRAMMING',
    judge0Id: 51,
    editorMode: 'cpp',
    extensions: ['.cpp', '.cc', '.hpp'],
    difficultyWeight: 0.7,
  },
  {
    slug: 'csharp',
    name: 'C#',
    category: 'PROGRAMMING',
    judge0Id: 54,
    editorMode: 'csharp',
    extensions: ['.cs'],
    difficultyWeight: 0.8,
  },
  {
    slug: 'java',
    name: 'Java',
    category: 'PROGRAMMING',
    judge0Id: 58,
    editorMode: 'java',
    extensions: ['.java'],
    difficultyWeight: 0.9,
  },
  {
    slug: 'javascript',
    name: 'JavaScript',
    category: 'PROGRAMMING',
    judge0Id: 60,
    editorMode: 'javascript',
    extensions: ['.js', '.mjs'],
    difficultyWeight: 1.0,
  },
  {
    slug: 'typescript',
    name: 'TypeScript',
    category: 'PROGRAMMING',
    judge0Id: 68,
    editorMode: 'typescript',
    extensions: ['.ts'],
    difficultyWeight: 0.95,
  },
  {
    slug: 'python',
    name: 'Python',
    category: 'PROGRAMMING',
    judge0Id: 63,
    editorMode: 'python',
    extensions: ['.py'],
    difficultyWeight: 1.0,
  },
  {
    slug: 'go',
    name: 'Go',
    category: 'PROGRAMMING',
    judge0Id: 56,
    editorMode: 'go',
    extensions: ['.go'],
    difficultyWeight: 0.8,
  },
  {
    slug: 'rust',
    name: 'Rust',
    category: 'PROGRAMMING',
    judge0Id: 66,
    editorMode: 'rust',
    extensions: ['.rs'],
    difficultyWeight: 0.6,
  },
  {
    slug: 'kotlin',
    name: 'Kotlin',
    category: 'PROGRAMMING',
    judge0Id: 61,
    editorMode: 'kotlin',
    extensions: ['.kt'],
    difficultyWeight: 0.85,
  },
  {
    slug: 'swift',
    name: 'Swift',
    category: 'PROGRAMMING',
    judge0Id: 67,
    editorMode: 'swift',
    extensions: ['.swift'],
    difficultyWeight: 0.85,
  },
  {
    slug: 'ruby',
    name: 'Ruby',
    category: 'PROGRAMMING',
    judge0Id: 65,
    editorMode: 'ruby',
    extensions: ['.rb'],
    difficultyWeight: 1.0,
  },
  {
    slug: 'php',
    name: 'PHP',
    category: 'PROGRAMMING',
    judge0Id: 8,
    editorMode: 'php',
    extensions: ['.php'],
    difficultyWeight: 1.05,
  },
  {
    slug: 'bash',
    name: 'Bash',
    category: 'PROGRAMMING',
    judge0Id: 1,
    editorMode: 'shell',
    extensions: ['.sh'],
    difficultyWeight: 1.2,
  },
  {
    slug: 'lua',
    name: 'Lua',
    category: 'PROGRAMMING',
    judge0Id: 86,
    editorMode: 'lua',
    extensions: ['.lua'],
    difficultyWeight: 1.1,
  },
  {
    slug: 'haskell',
    name: 'Haskell',
    category: 'PROGRAMMING',
    judge0Id: 57,
    editorMode: 'haskell',
    extensions: ['.hs'],
    difficultyWeight: 0.8,
  },
  {
    slug: 'scala',
    name: 'Scala',
    category: 'PROGRAMMING',
    judge0Id: 70,
    editorMode: 'scala',
    extensions: ['.scala'],
    difficultyWeight: 0.8,
  },
  {
    slug: 'elixir',
    name: 'Elixir',
    category: 'PROGRAMMING',
    judge0Id: 72,
    editorMode: 'elixir',
    extensions: ['.ex', '.exs'],
    difficultyWeight: 0.85,
  },
  {
    slug: 'dart',
    name: 'Dart',
    category: 'PROGRAMMING',
    judge0Id: 55,
    editorMode: 'dart',
    extensions: ['.dart'],
    difficultyWeight: 0.9,
  },
  {
    slug: 'perl',
    name: 'Perl',
    category: 'PROGRAMMING',
    judge0Id: 69,
    editorMode: 'perl',
    extensions: ['.pl'],
    difficultyWeight: 1.0,
  },
  {
    slug: 'r',
    name: 'R',
    category: 'PROGRAMMING',
    judge0Id: 64,
    editorMode: 'r',
    extensions: ['.r'],
    difficultyWeight: 1.0,
  },
  {
    slug: 'julia',
    name: 'Julia',
    category: 'PROGRAMMING',
    judge0Id: 75,
    editorMode: 'julia',
    extensions: ['.jl'],
    difficultyWeight: 0.85,
  },
  {
    slug: 'sql',
    name: 'SQL',
    category: 'QUERY',
    judge0Id: 71,
    editorMode: 'sql',
    extensions: ['.sql'],
    difficultyWeight: 1.2,
  },
] as const

async function main() {
  for (const language of languages) {
    await prisma.language.upsert({
      where: { slug: language.slug },
      update: {
        name: language.name,
        category: language.category,
        judge0Id: language.judge0Id,
        editorMode: language.editorMode,
        extensions: [...language.extensions],
        difficultyWeight: language.difficultyWeight,
      },
      create: {
        slug: language.slug,
        name: language.name,
        category: language.category,
        judge0Id: language.judge0Id,
        editorMode: language.editorMode,
        extensions: [...language.extensions],
        difficultyWeight: language.difficultyWeight,
      },
    })
  }
  console.log(`Seeded ${languages.length} languages.`)

  await prisma.organization.upsert({
    where: { slug: 'demo-league' },
    update: {},
    create: {
      slug: 'demo-league',
      name: 'Demo League',
      description: 'Seed organization used while developing KoArena.',
    },
  })
  console.log('Seeded the demo organization.')
}

main()
  .then(async () => {
    await prisma.$disconnect()
  })
  .catch(async (error) => {
    console.error(error)
    await prisma.$disconnect()
    process.exit(1)
  })
