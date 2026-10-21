# KoArena

Tournament platform for programmers — CTF, hackathons, attack &amp; defense, algorithmic
rounds, and language-driven game modes.

Created in [T3 Code](https://t3.codes).

## Stack

| Layer | Choice |
| --- | --- |
| Framework | [TanStack Start](https://tanstack.com/start) 1.0 (React 19, Vite 8, TanStack Router) |
| Data | PostgreSQL + Prisma 7 (Rust-free, driver adapters) |
| Auth | Clerk (`@clerk/tanstack-react-start`) |
| Design | shadcn/ui (Base UI, `base-nova`) + [ReUI](https://reui.io) on Tailwind CSS v4 |
| Scoring | `@koarena/game` — a pure, dependency-free scoring engine |
| Realtime | Server-Sent Events over Redis pub/sub |
| Tooling | pnpm workspaces + Turborepo, Biome, Vitest, Playwright |

## Layout

```
apps/web         TanStack Start app (SSR, server functions, routes)
apps/judge       BullMQ worker — runs the code, writes the verdicts
packages/db      Prisma schema, generated client, seed
packages/game    Pure scoring engine — all 8 game modes, no I/O
packages/crypto  Flag encryption (AES-256-GCM)
packages/realtime The live bus (Redis pub/sub + the event contract)
packages/runner  The runner contract: Judge0 client, local runner, simulated runner
packages/queue   The judging queue — one job shape, both ends
packages/ledger  The score ledger — append-only, shared by the app and the worker
infra            Docker Compose (Postgres, Redis, MinIO)
docs             Plan, game modes, routes, deployment
```

## Getting started

```bash
pnpm install
cp .env.example packages/db/.env    # point DATABASE_URL at your Postgres
cp .env.example apps/web/.env        # plus FLAG_ENCRYPTION_KEY
cp apps/judge/.env.example apps/judge/.env   # the worker shares the same database
pnpm db:generate
pnpm db:migrate
pnpm db:seed                        # 23 languages + a demo organization
pnpm db:seed:demo                   # a four-challenge CTF and a two-problem ACM round
pnpm dev                            # http://localhost:3100
pnpm dev:judge                      # the judging worker, in a second terminal
```

The demo CTF's flags are listed by the seed script. Set
`FLAG_ENCRYPTION_KEY` to a 32-byte base64 value (`openssl rand -base64 32`)
before seeding — the same key must be in `apps/web/.env`, or the app cannot
decrypt the flags it stores.

`apps/web/.env.local` holds the Clerk development keys. Run
`npx clerk@latest auth login` to claim the application.

> The dev server is pinned to **port 3100** (`--strictPort`). Clerk ties its
> sign-in redirect to the origin, so a changing port breaks the flow.

### Database

Any Postgres works. Two shapes are supported:

```bash
# Managed Postgres, pooled TCP — recommended
DATABASE_URL="postgres://user:pass@host:5432/db?sslmode=verify-full"

# Local Docker Postgres (pnpm infra:up)
DATABASE_URL="postgresql://postgres:postgres@localhost:5432/koarena"
```

Use the **pooled** endpoint, not a direct one: serverless concurrency will
exhaust direct connections. `sslmode=verify-full` verifies the server
certificate's hostname; `require` works too but does not.

## Playing the demo tournaments

```bash
pnpm db:seed:demo          # creates /tournaments/demo-ctf and /tournaments/demo-algorithms
```

**`/tournaments/demo-ctf`** — four challenges with encrypted flags, live point decay and
first blood. Open the challenge board, submit a flag, and watch the scoreboard move in
another tab: the live channel is Server-Sent Events over Redis pub/sub.

**`/tournaments/demo-algorithms`** — the ACM mode. Two problems with hidden test cases,
a Monaco editor, and a real verdict. Submit a program and the worker runs it against the
test cases; the verdict comes back over the live channel and the scoreboard moves.

The demo runs with the **simulated** runner (`RUNNER_MODE=simulated`), so no sandbox is
needed: the verdict comes from a marker in the source — `/* verdict:wrong-answer */`,
`/* verdict:time-limit */`, `/* verdict:compile-error */`, `/* verdict:runtime-error */`.
Without a marker the program is accepted. Set `RUNNER_MODE=judge0` with a Judge0
instance to run real code, or `RUNNER_MODE=local` to execute it on the worker (development
only — it runs the submitted program with the worker's own privileges).

## The judging path

```
browser → apps/web → submission row + a job in Redis
                              ↓
                       apps/judge (the worker)
                              ↓
                   packages/runner → Judge0
                              ↓
              verdict + score event + live event
```

The app never talks to the sandbox. The job carries only the submission id; everything
else is read from the database, so a job can be replayed by hand and the database stays
the source of truth. The worker calls `@koarena/game` for the points and the penalty, so
the rules live in one place.

## The server/client boundary

TanStack Start compiles server functions into RPC stubs for the browser, but only
if server-only code is genuinely server-only. KoArena uses three layers:

```
features/<domain>/
├── <domain>.server.ts      server-only: DB calls, Clerk calls — never imported by the client
├── <domain>.functions.ts   createServerFn wrappers — safe to import anywhere
├── types.ts                DTO types — importable from components
└── components/             client components
```

`*.server.ts` files are **denied in the client environment** by TanStack Start's
import protection, which is configured to fail the production build:

```ts
// apps/web/vite.config.ts
tanstackStart({
  importProtection: { behavior: { dev: 'mock', build: 'error' } },
})
```

Two rules keep this working:

1. A `*.server.ts` module may only be referenced **inside** a server function
   handler. A helper that touches the database outside a handler keeps the import
   alive and the build fails.
2. Server function return types must be **serializable**. A `Date` or an
   `unknown` in a return type collapses the inferred type — return ISO strings
   and use `JsonValue` for config objects.

The same applies to the workspace packages: `@koarena/db`, `@koarena/crypto`,
`@koarena/realtime`, `@koarena/ledger`, `@koarena/queue` and `@koarena/runner` are all
listed as denied specifiers in the client environment, so importing one from a component
fails the build. A **dynamic** `import('@koarena/db')` fails it too: the compiler does
not prune dynamic imports, so the database client would head for the browser bundle.
Put the query behind a server function instead.

## Commands

| Command | What it does |
| --- | --- |
| `pnpm dev` | Run every app in the workspace |
| `pnpm dev:judge` | Run the judging worker in watch mode |
| `pnpm judge` | Run the judging worker once |
| `pnpm build` | Build all packages |
| `pnpm lint` | Biome check |
| `pnpm typecheck` | `tsc --noEmit` across the workspace |
| `pnpm test` | Vitest across the workspace (the DB suites need `DATABASE_URL`) |
| `pnpm db:generate` / `db:migrate` / `db:deploy` / `db:seed` / `db:studio` | Prisma |
| `pnpm infra:up` / `infra:down` | Local Postgres, Redis (and MinIO with `--profile storage`) |

## Plan

* **[PLAN.md](./PLAN.md)** — product scope, tech stack, architecture, roadmap, risks
* **[docs/GAME-MODES.md](./docs/GAME-MODES.md)** — rules + scoring formulas for all 8 modes
* **[packages/db/prisma/schema.prisma](./packages/db/prisma/schema.prisma)** — 48 models / 24 enums
* **[docs/ROUTES.md](./docs/ROUTES.md)** — route & screen map with ReUI component owners
* **[docs/DEPLOYMENT.md](./docs/DEPLOYMENT.md)** — Vercel + managed Postgres topology
* **[docs/plan-overview.html](./docs/plan-overview.html)** — visual plan summary

## Design system

shadcn/ui (Base UI, `base-nova`) + **ReUI** on Tailwind CSS v4.

The ReUI MCP server and the ReUI agent skill are installed:

* MCP: `opencode.json` → `https://mcp.reui.io` (token in `.secrets/reui-token`, gitignored)
* Skill: `.opencode/skills/reui` (project) and `~/.config/opencode/skills/reui` (global)
* ReUI design rules for agents: `AGENTS.md`

Clerk's agent skills are installed too (`~/.agents/skills/clerk-*`).

Free plan — all 27 ReUI components and every `c-*` example install without a license.
Premium blocks need **Pro**, Motion Icons need **Ultimate**.
