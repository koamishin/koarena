# KoArena — Deployment Topology (Vercel + managed Postgres)

Decisions this document encodes:

* The web app runs on **Vercel** (Fluid Compute required).
* The database is **managed Postgres** (Neon or Supabase) reached over a **pooled TCP
  connection string**.
* **Redis** (classic TCP) holds the live leaderboard, the pub/sub fan-out and the
  BullMQ queues.
* **Judge0 and the BullMQ worker cannot run on Vercel** — they live on a separate
  always-on host.

```
┌─────────────────────────────── Vercel ────────────────────────────────┐
│  apps/web  (TanStack Start + Nitro Vite plugin)                       │
│    ├─ SSR routes + server functions                                   │
│    ├─ /api/live/:slug   →  Server-Sent Events (SSE)                   │
│    ├─ /api/auth/*       →  Clerk (hosted)                             │
│    └─ /api/*            →  ordinary HTTP routes                       │
└────┬─────────────────────────┬──────────────────────────┬─────────────┘
     │ Prisma 7 (pg adapter)   │ Redis (classic TCP)      │
     ▼                         ▼                          │
┌────────────────┐   ┌───────────────────────┐          │
│ Managed        │   │ ZSET  board           │          │
│ Postgres       │   │ Pub/Sub  fan-out      │          │
│ (Neon/Supabase)│   │ BullMQ  queues        │          │
└────────────────┘   └───────────────────────┘          │
     ▲                                                 │
     │ verdict + score event                           │
┌────┴──────────── Worker host (Fly.io / Railway / small VPS, Docker) ────┐
│  apps/judge            BullMQ worker → Judge0 → verdict + score event   │
│  judge0                isolated container runners (60+ languages)       │
│  adjudicator (P6)     A/D bots + service supervisor                    │
└────────────────────────────────────────────────────────────────────────┘
```

---

## 1. Why the worker host is separate

Vercel Functions are short-lived and stateless. They cannot:

* run a long-lived BullMQ worker (the function would need to stay resident forever),
* run Judge0's containerised runners (no Docker-in-Docker),
* hold the A/D service containers that teams attack.

So `apps/judge` is a **normal long-running Node process** on a small always-on machine.
It connects to the *same* Redis and the *same* Postgres as Vercel, so the two tiers
share one source of truth.

### Sizing the worker host

| Component | Need |
| --- | --- |
| Judge0 API + N runners | 2 vCPU / 4 GB for ~10 concurrent runs |
| `apps/judge` worker | 512 MB, 0.5 vCPU |
| Postgres/Redis | Not hosted here (managed) |
| **Start with** | Hetzner CX22 / Fly.io `shared-cpu-2x` — ~€5/mo |

Judge0 itself ships a `RUNNERS` count in its compose file; scale that, not the host,
before scaling the host.

---

## 2. Database (managed Postgres)

Prisma 7 **requires a driver adapter**. Two supported shapes:

| Provider | Adapter | Connection string |
| --- | --- | --- |
| Neon | `@prisma/adapter-neon` `7.10.1` | Neon pooled URI (`-pooler` region) |
| Supabase | `@prisma/adapter-pg` `7.10.1` | Supavisor **session** pooler port `5432` (not the transaction pooler `6543` — Prisma needs prepared statements) |
| Any classic Postgres | `@prisma/adapter-pg` `7.10.1` | pooled TCP URI |

```ts
// packages/db/src/client.ts
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaClient } from '../generated/prisma/client'

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! })
export const prisma = new PrismaClient({ adapter })
```

> **Do not use Prisma Accelerate.** Standalone Accelerate and hosted
> `prisma+postgres://` connections are **retired 2026-12-01**. Use a pooled TCP URL.

Migrations run from CI against the same pooler:

```bash
prisma migrate deploy   # uses prisma.config.ts -> datasource.url
```

`prisma.config.ts` (Prisma 7 no longer auto-loads `.env`):

```ts
import 'dotenv/config'
import { defineConfig, env } from 'prisma/config'

export default defineConfig({
  schema: 'prisma/schema.prisma',
  migrations: { path: 'prisma/migrations', seed: 'tsx prisma/seed.ts' },
  datasource: { url: env('DATABASE_URL') },
})
```

### Connection budget

Serverless creates many short-lived DB connections. The pooler is what keeps Postgres
alive. Check the provider's connection limit against: Vercel function concurrency +
the worker + your psql sessions. Neon, Supabase and Prisma Postgres all scale the
pooler automatically on paid plans.

### Which URL to use

```bash
# Prisma Postgres (pooled TCP) — the shape KoArena is developed against
DATABASE_URL="postgres://<id>:<key>@pooled.db.prisma.io:5432/postgres?sslmode=verify-full"

# Neon
DATABASE_URL="postgresql://...@ep-xxx-pooler.region.aws.neon.tech/postgres?sslmode=require"

# Supabase
DATABASE_URL="postgresql://...@db.xxx.supabase.co:5432/postgres?sslmode=require"
```

Always the **pooled** endpoint, never a direct one — serverless concurrency will
exhaust direct connections. `sslmode=verify-full` verifies the server
certificate's hostname; `require` encrypts but does not verify it, and
node-postgres warns about the weaker mode.

> **Do not use Prisma Accelerate.** Standalone Accelerate and hosted
> `prisma+postgres://` connections are **retired 2026-12-01**. Use a pooled TCP URL.

---

## 3. Redis

Requirements: **classic TCP** + **blocking commands** (BullMQ needs `BRPOPLPUSH`).

* Vercel Marketplace → **Redis** (an Aiven-class offering). Marketplace injects
  `REDIS_URL`.
* **Do not use Upstash** for BullMQ — Upstash has no blocking commands. It is fine as a
  second cache for read-heavy leaderboard reads if you want one.

What lives in Redis:

| Key | Type | Purpose |
| --- | --- | --- |
| `board:{tournamentId}` | ZSET | Live leaderboard: member = team id, score = points |
| `events:{tournamentId}` | Stream (or ZSET) | Recent game events, used for SSE resume via `Last-Event-ID` |
| `notify:{tournamentId}` | Pub/Sub | Fan-out channel between app instances and the SSE endpoint |
| `bull:koarena-judge` | BullMQ | Judging jobs — one job per submission |
| `bull:notify` | BullMQ | Notification emails, score recompute |

> BullMQ **queue names cannot contain a colon** — the queue is `koarena-judge`, and
> BullMQ adds the `bull:` prefix itself.

---

## 4. Realtime: SSE on Vercel

### Why SSE and not WebSocket

Vercel Functions do support WebSockets (public beta since 2026-06-22, all plans,
Fluid Compute). Three properties of that model drive the decision:

| Property | Effect |
| --- | --- |
| **Pinning** | A connection stays on the instance that accepted it. A player on instance A cannot see an event published on instance B. |
| **Placement** | A reconnect can land on any instance, so the client must resubscribe and resync state. |
| **Duration** | The connection closes when the function hits `maxDuration`: 300 s (Hobby), 800 s (Pro), 1800 s extended beta. |

KoArena's live traffic is one-way (scores, announcements, solve feed, judge progress),
so SSE is the right transport: it is plain HTTP, it needs no upgrade handshake, and the
browser's `EventSource` reconnects on its own and sends `Last-Event-ID` so the server
can resume exactly where the stream stopped.

Chat is not an exception: sending a chat message is an ordinary `POST` (a server
function). Only presence and typing indicators would need a WebSocket — deferred past
the first milestone.

### Implementation shape

```
GET /api/live/:slug          (SSE)
  ├─ auth: Clerk session token in the request, or ?token= for EventSource
  ├─ resume: read Last-Event-ID → XREVRANGE events:{tournamentId} → replay missed events
  ├─ live:   SUBSCRIBE notify:{tournamentId} → write `data:` frames
  ├─ keepalive: `: ping` comment every 15 s (prevents proxy idle timeouts)
  └─ filter: server-side, per-connection — never leak another team's private events
```

`vercel/resumable-stream` implements the resume-from-`Last-Event-ID` part on top of
Redis and is the recommended library for this shape.

### `maxDuration` and cost

* Set `maxDuration` on the SSE route: `800` on Pro (or `1800` with the extended beta).
* A close at `maxDuration` is **expected** — the client reconnects and resyncs. Never
  surface it as an error in the UI.
* Fluid Compute bills **Active CPU** (only while your code works) and **Provisioned
  Memory** (for the instance's whole life). Idle SSE streams cost memory, not CPU — so
  keep the per-connection footprint small and the instance memory modest.
* One instance holds many connections. Do not assume 1 connection = 1 instance.

### Multi-instance fan-out

All instances subscribe to `notify:{tournamentId}`. A score event published on any
instance reaches every subscriber, then goes out over each instance's own SSE
connections. **No in-memory module state** is used for rooms, presence or counters —
that is exactly the bug Vercel's docs warn about, and it only shows up in production.

---

## 5. Clerk

| Item | Value |
| --- | --- |
| SDK | `@clerk/tanstack-react-start` `1.7.4` |
| UI | `@clerk/ui` `1.41.0` — use the shadcn theme so it matches KoArena's UI |
| Setup | `npx -y clerk@latest init` — detects TanStack Start, installs the SDK, wires the provider, middleware, auth routes and env, and installs Clerk's agent skills |
| Verify | `npx -y clerk@latest doctor` |
| Role source of truth | Clerk `publicMetadata.role` → mirrored to `User.role` by a webhook |

Clerk's `@clerk/ui` shadcn theme is applied in two places:

```tsx
import { ClerkProvider } from '@clerk/tanstack-react-start'
import { shadcn } from '@clerk/ui/themes'

<ClerkProvider appearance={{ theme: shadcn }}>{children}</ClerkProvider>
```

```css
@import '@clerk/ui/themes/shadcn.css';
```

**Bot protection**: Clerk's bot-protection defaults stay on. When testing sign-up in an
automated browser, create the test user through the Clerk CLI instead of the UI, and
use `424242` for any verification code.

---

## 6. Environment variables

| Variable | Where | Notes |
| --- | --- | --- |
| `DATABASE_URL` | Vercel + worker host | Pooled TCP URI — **the same one** on both |
| `DIRECT_DATABASE_URL` | CI only | Unpooled URI for `prisma migrate` |
| `REDIS_URL` | Vercel + worker host | Classic TCP Redis |
| `CLERK_SECRET_KEY` | Vercel | Server only — never exposed to the client |
| `CLERK_PUBLISHABLE_KEY` | Vercel | Public |
| `CLERK_WEBHOOK_SECRET` | Vercel | Signs `user.created` / `user.updated` / `user.deleted` |
| `JUDGE0_URL` | worker host | Base URL of the Judge0 API, internal network only |
| `JUDGE0_API_KEY` | worker host | Judge0 API key |
| `RUNNER_MODE` | worker host | `judge0` in production, `simulated` for a sandbox-free clone |
| `RUNNER_ALLOW_LOCAL_EXECUTION` | worker host | Only for `RUNNER_MODE=local`; never in production |
| `JUDGE_CONCURRENCY` | worker host | Submissions judged at once — keep it below Judge0's `RUNNERS` |
| `FLAG_ENCRYPTION_KEY` | Vercel + worker host | 32-byte base64 key for AES-256-GCM flag encryption |
| `S3_*` / `R2_*` | Vercel | Object storage for attachments and project archives |
| `RESEND_API_KEY` | Vercel | Transactional email |
| `SENTRY_DSN` | Vercel + worker host | Error reporting |

`.env.local` is gitignored; production values are set in the Vercel project settings and
on the worker host.

### The worker's environment

The worker reads its own `.env` (via `dotenv/config`) from `apps/judge/`. It needs the
**same** `DATABASE_URL` and `REDIS_URL` as the app — a worker pointed at a different
database will fail every job with "submission does not exist", which looks exactly like
a broken app.

```bash
# apps/judge/.env
DATABASE_URL="postgres://...?sslmode=verify-full"
REDIS_URL="redis://localhost:6379"
RUNNER_MODE="judge0"
JUDGE0_URL="http://judge0:2357"
JUDGE0_API_KEY=""
JUDGE_CONCURRENCY="4"
```

### The three runners

| `RUNNER_MODE` | What it does | Use it for |
| --- | --- | --- |
| `judge0` | Submits to Judge0 and polls for the verdict | Production |
| `local` | Really executes Python/Node/Bash on the worker with a timeout | Development only — it runs untrusted code with the worker's privileges, so it refuses to start unless `RUNNER_ALLOW_LOCAL_EXECUTION=true` |
| `simulated` | Decides the verdict from a marker in the source (`/* verdict:wrong-answer */`) | A clone with no sandbox: the whole queue → worker → verdict → penalty → board path still runs |

---

## 7. Deploy sequence

```bash
# 1. database
pnpm --filter @koarena/db prisma migrate deploy

# 2. web app (Vercel)
vercel deploy --prod          # or let the Vercel Git integration handle it

# 3. worker host
docker compose -f infra/docker-compose.worker.yml up -d --build

# 4. the worker itself (it is a plain Node process)
cd apps/judge && pnpm start
```

CI runs on every push: `biome check` → `tsc --noEmit` → `vitest run` → `playwright test`
→ `prisma migrate deploy` (staging) → `vercel deploy --prebuilt`.

### Recovering a broken board

The score snapshot is derived state; the ledger is the source of truth. If the board
drifts — a duplicated event, a dropped write, a hand-edited row — rebuild it:

```ts
import { rebuildSnapshots, rerankStandings } from '@koarena/ledger'

await rebuildSnapshots(tournamentId)   // drops the snapshots, recomputes from the events
await rerankStandings(tournamentId, gameMode)
```

`rebuildSnapshots` also removes the standing of a participant whose events are gone: the
events decide who is on the board, not the snapshot.

### Recovering a stuck submission

The worker marks a submission as failed when its job runs out of attempts, and the
reaper sweeps anything that has been waiting more than five minutes. A submission that
says `QUEUED` for minutes has been swept and will say `ERROR` instead.

---

## 8. Scaling checklist

| Symptom | Fix |
| --- | --- |
| SSE connections drop constantly | Raise `maxDuration` (up to 800 s, 1800 s beta) |
| SSE memory cost too high | Reduce instance memory; poll instead for low-frequency screens |
| Judge queue backs up | Scale `apps/judge` replicas; raise Judge0 `RUNNERS` |
| Postgres connection errors | Check the pooler's connection limit vs. function concurrency |
| Fan-out misses events | A subscriber is not on `notify:{tournamentId}` — verify every instance subscribes |
| The board drifts from the DB | Run the reconciliation job that rebuilds `ScoreSnapshot` from `ScoreEvent` |

---

## 9. Fallback if Vercel's realtime limits bite

The event contract (`score:update`, `scoreboard:full`, `announce`, `judge:progress`) is
transport-agnostic. If SSE on Vercel becomes a bottleneck, the migration is:

1. Move `/api/live/:slug` to a dedicated always-on host (Fly.io) — same route path, same
   event names, same Redis channel. Nothing else in the app changes.
2. Or swap the transport for Ably / Pusher / Liveblocks, which handle reconnection,
   ordering and missed-message recovery as a platform feature.
