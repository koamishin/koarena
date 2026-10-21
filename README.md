<img src="assets/icon.svg" width="64" height="64" alt="">

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
| Tooling | pnpm workspaces + Turborepo, Biome, Vitest, Playwright |

## Layout

```
apps/web        TanStack Start app (SSR, server functions, routes)
packages/db     Prisma schema, generated client, seed
packages/game   Pure scoring engine — all 8 game modes, no I/O
infra           Docker Compose (Postgres, Redis, MinIO)
docs            Plan, game modes, routes, deployment
```

## Getting started

```bash
pnpm install
pnpm infra:up                    # Postgres + Redis
cp .env.example packages/db/.env # then set DATABASE_URL
pnpm db:generate
pnpm db:migrate
pnpm db:seed                     # 23 languages + a demo organization
pnpm dev                         # http://localhost:3000
```

Clerk signs you in. `apps/web/.env.local` already holds development keys; run
`npx clerk@latest auth login` to claim the application.

## Commands

| Command | What it does |
| --- | --- |
| `pnpm dev` | Run every app in the workspace |
| `pnpm build` | Build all packages |
| `pnpm lint` | Biome check |
| `pnpm typecheck` | `tsc --noEmit` across the workspace |
| `pnpm test` | Vitest across the workspace |
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
