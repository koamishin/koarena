# KoArena — Tournament Platform for Programmers

> Plan v1 · 21 Oct 2026 · Status: awaiting approval to scaffold

KoArena is a self-hostable web platform for running programming competitions: CTFs,
hackathons, attack & defense, ACM-style algorithmic rounds, and language-driven
game modes. Organizers configure a tournament in a wizard; the platform adapts the
player experience, scoring, judging pipeline and UI to the chosen game mode and
the set of languages enabled for that tournament.

---

## 1. Product scope

### 1.1 Roles

| Role | What they do |
| --- | --- |
| **Participant** | Joins a tournament (solo or with a team), solves challenges, submits code, sees the live scoreboard |
| **Team captain** | Manages the roster, registers the team, sees the private team view |
| **Judge** | Reviews hackathon projects against a rubric, scores criteria |
| **Organizer** | Creates tournaments, configures mode/rules/languages, runs the live control room, moderates |
| **Admin** | Platform-wide: users, reports, audit log, feature flags |

### 1.2 Game modes (summary)

The mode is chosen at tournament creation and drives the wizard, the schema
sub-tables used, the scoring engine, the player screens and the organizer tools.
Full rules and scoring formulas: [`docs/GAME-MODES.md`](docs/GAME-MODES.md).

| Mode | Short | Core mechanic | Needs a code runner? | Needs a service host? |
| --- | --- | --- | --- | --- |
| `CTF` | Jeopardy | Solve challenges, submit flags, dynamic point decay, first blood | no | no |
| `ATTACK_DEFENSE` | A/D | Run a vulnerable service, attack rivals, patch your own | no | **yes** |
| `HACKATHON` | Buildathon | Ship a project, judges score it against a weighted rubric | no | no |
| `ACM` | Algorithmic | Solve problems against hidden test cases, penalty time | **yes** | no |
| `POLYGLOT_BATTLE` | Language Arena | Same problem, pick your language, head-to-head with a language handicap | **yes** | no |
| `CODE_GOLF` | Golf Royale | Shortest correct program wins | **yes** | no |
| `BUG_HUNT` | Patch Race | Fix the seeded bug, fastest passing tests win | **yes** | no |
| `KNOCKOUT` | KOTH | Bracket rounds, head-to-head duels, elimination | yes | optional |

### 1.3 The language axis (why languages drive the design)

`Language` is a first-class entity, not a dropdown. It carries the Judge0 language id,
the editor mode, the runtime image and a **difficulty weight** used by scoring.

```
Language ──┬──< TournamentLanguage >── Tournament   (which languages are enabled)
           ├──< ProblemLanguage    >── Problem       (per-problem allow-list)
           ├──< ChallengeLanguage  >── Challenge     (per-challenge allow-list)
           ├──< Submission          (what a player wrote it in)
           └──< Service             (A/D: which language a team's service runs)
```

Consequences that fall out of this:

* The **editor** only offers the tournament's enabled languages, and only the ones
  allowed for the specific challenge/problem.
* The **judge pipeline** resolves `Language → judge0LanguageId` and passes it to the runner.
* **Polyglot Battle** scores across languages fairly by dividing base points by
  `language.difficultyWeight`.
* **Language Roulette** (a `POLYGLOT_BATTLE` variant) bans a random subset of languages
  each round, so scoring must be computed *at submission time*, not statically.
* A/D service images are tagged with the language they are written in, and the
  organizer picks the language when deploying each team's service.

---

## 2. Tech stack

Everything below is pinned to what is current as of 2026-10-21, verified against npm.

### 2.1 Application

| Layer | Choice | Version | Why |
| --- | --- | --- | --- |
| Framework | **TanStack Start** (React) | `1.169.3` | 1.0 stable since 2026-10-13. SSR, streaming, typed server functions, file-based routing, no adapter lock-in |
| Router | TanStack Router | `1.170.45` | 100% type-safe routes + search params, loaders, middleware |
| Server state | TanStack Query | `5.104.5` | v5 current; cache invalidation on score events |
| Forms | TanStack Form | `1.33.5` | v1 stable, framework-agnostic, Zod adapter |
| Tables | TanStack Table | `9.3.1` | v9 is now `latest` — and ReUI's `data-grid` is built on Table v9 |
| Language | TypeScript | `5.9.x` | Prisma 7 recommended TS floor |
| Runtime | Node.js | `22.x` | Prisma 7 recommended runtime |
| Package mgr | pnpm | `10.x` | workspaces — install via `corepack` in Phase 0 |
| Monorepo | Turborepo | `2.x` | task graph + caching |

### 2.2 Data & infra

| Layer | Choice | Version | Notes |
| --- | --- | --- | --- |
| ORM | **Prisma** | `7.10.1` | Rust-free client, 90% smaller bundles. **Do not use 8.0.0-rc** |
| Driver adapter | `@prisma/adapter-pg` | `7.10.1` | Required in Prisma 7 for every database (Neon: `@prisma/adapter-neon`) |
| Database | **PostgreSQL (managed)** | `17.x` | Neon or Supabase, pooled TCP URL. Prisma Accelerate retires 2026-12-01 → not used |
| Config | `prisma.config.ts` | — | Prisma 7 does **not** auto-load `.env`; needs `import "dotenv/config"` |
| Cache / pub-sub | **Redis (classic TCP)** | — | Vercel Marketplace Redis. Leaderboard ZSET, pub/sub fan-out, BullMQ backend. Must support blocking commands (Aiven-class, **not** Upstash) |
| Queue | BullMQ | `6.3.19` | Judging jobs, notifications, score recompute. Runs on the worker host, not on Vercel |
| Auth | **Clerk** | `@clerk/tanstack-react-start` `1.7.4` | Official TanStack Start SDK (Clerk is a TanStack partner). Managed sign-in, OAuth, MFA, bot protection, `<UserButton>` UI |
| Clerk UI | `@clerk/ui` | `1.41.0` | Ships a **shadcn theme** — Clerk prebuilt UI matches the KoArena design system |
| Validation | Zod | `4.6.7` | Single source of truth shared by forms + server functions |
| Email | Resend | — | Invites, tournament start, prize notifications |
| Storage | S3-compatible (MinIO local / R2 prod) | — | Challenge attachments, project zips, team logos |
| Observability | Sentry + OpenTelemetry | — | Server functions, judge worker, client errors |
| Hosting | **Vercel** (`apps/web`) | — | Fluid Compute required. Deployment details: [`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md) |

### 2.3 Design system

| Layer | Choice | Notes |
| --- | --- | --- |
| CSS | **Tailwind CSS** `4.3.3` | CSS-first config, no `tailwind.config.js` needed |
| Components | **shadcn/ui** | Base UI is the default primitive library since 2026-07; style `base-nova` |
| Design system | **ReUI** | 27 free components + free `c-*` examples via `npx shadcn@latest add @reui/<name>` |
| Icons | lucide-react | One icon library, matching `components.json` `iconLibrary` |
| Auth UI | `@clerk/ui` `1.41.0` | Ships a **shadcn theme** — `appearance={{ theme: shadcn }}` + `@clerk/ui/themes/shadcn.css`. Clerk's prebuilt UI then matches KoArena's |
| Editor (write) | **Monaco** `0.57.0` via `@monaco-editor/react` `4.7.0` | What CF/ICPC players expect; lazy-loaded |
| Code display | **ReUI `code-block`** | Shiki-based, read-only: writeups, test output, diffs, terminal logs |
| Charts | Recharts `3.10.1` | Score-over-time, solve distribution |
| Toasts | sonner `2.0.8` | |
| Theming | next-themes `0.4.6` | Light/dark, class strategy (Tailwind v4 friendly) |

> **ReUI plan = Free.** That covers all 27 components and every `c-*` example.
> Premium *blocks* need **Pro**; *Motion Icons* need **Ultimate**. The free plan has a
> daily MCP request allowance. Everything in this plan is buildable on Free — the
> plan only lists premium blocks as *optional upgrades* for marketing pages.

### 2.4 Tooling & quality

| Purpose | Choice | Version |
| --- | --- | --- |
| Lint + format | **Biome** | `2.5.15` |
| Unit / integration tests | Vitest | `5.0.5` |
| E2E | Playwright | `1.64.1` |
| Mock data | @faker-js/faker | `10.6.0` |
| CI | GitHub Actions | — |
| Local infra | Docker Compose | Postgres, Redis, Judge0, MinIO |

### 2.5 Explicitly rejected (and why)

| Rejected | Reason |
| --- | --- |
| **PartyKit** | Platform shut down — deploys stopped 2026-10-16 |
| **Next.js** | User asked for TanStack; Start 1.0 is now production-stable |
| **Prisma 8** | Still `8.0.0-rc.23`. Use 7.10.1, revisit at GA |
| **TanStack DB** | `0.5.11`, pre-1.0. Query + optimistic updates covered by TanStack Query |
| **Better Auth** | Viable, but Clerk was chosen: official TanStack Start SDK, managed bot protection, MFA, and a shadcn-themed UI |
| **tRPC** | Server functions already give end-to-end types in Start; tRPC adds a transport layer for no gain |
| **Drizzle** | User asked for Prisma |
| **Socket.IO in v1** | Vercel Functions pin each connection to one instance and close it at `maxDuration`; SSE is simpler and self-reconnecting. WS stays available for presence/typing later |
| **Liveblocks / Ably / Pusher** | Paid per message; SSE + Redis is enough at launch. Documented as the scale-out path |
| **Prisma Accelerate** | Standalone Accelerate and hosted `prisma+postgres://` retire 2026-12-01 |

---

## 3. Repository layout

pnpm workspaces + Turborepo.

```
koarena/
├─ apps/
│  ├─ web/                    # TanStack Start app (the only deployable app)  ✅ Phase 0
│  │  ├─ src/routes/          # file-based routes
│  │  ├─ src/lib/             # auth helpers, shared utilities
│  │  ├─ src/components/      # ui/ (shadcn) + reui/ + app components
│  │  └─ src/features/        # one folder per domain slice        (Phase 1+)
│  ├─ judge/                  # BullMQ worker: polls Judge0, writes verdicts   (Phase 3)
│  └─ adjudicator/            # A/D bot + service supervisor                  (Phase 6)
├─ packages/
│  ├─ db/                     # prisma/schema.prisma, generated client, seed  ✅ Phase 0
│  ├─ game/                   # PURE scoring engine + mode rules (no I/O)      ✅ Phase 0
│  ├─ runner/                 # Judge0 client + language registry + limits     (Phase 3)
│  ├─ realtime/               # SSE endpoint, event contract, Redis fan-out    (Phase 2)
│  └─ config/                 # shared tsconfig / biome presets
├─ infra/
│  ├─ docker-compose.yml      # postgres, redis, minio (optional profile)      ✅ Phase 0
│  └─ judge0/                 # runner image build + language set              (Phase 3)
├─ docs/                      # this plan + game modes + routes + deployment
└─ .opencode/skills/reui/     # ReUI agent skill (installed)                   ✅ Phase 0
```

**Hard rule:** `packages/game` contains zero imports from `apps/` or `prisma`. It takes
plain objects and returns plain objects. That is what makes 8 game modes and their
scoring formulas testable and non-fragile.

---

## 4. Architecture

```
┌──────────────────────────── Vercel (apps/web) ─────────────────────────────┐
│  TanStack Start  ·  SSR  ·  server functions  ·  /api/live/:slug (SSE)     │
└───────┬──────────────────────────┬──────────────────────────────┬──────────┘
        │ Prisma 7 (pg adapter)    │ Redis (classic TCP)          │
        ▼                          ▼                              │
┌───────────────────┐   ┌────────────────────┐                    │
│ Managed Postgres  │   │  ZSET board        │                    │
│ Neon / Supabase   │   │  pub/sub fan-out   │                    │
└───────────────────┘   └────────────────────┘                    │
        ▲                                                          │
        │ verdict + score event                                   │
┌───────┴──────────────── Worker host (Fly.io / Railway / VPS) ───┴──────────┐
│  apps/judge (BullMQ worker)   ·   Judge0 (isolated runners)                │
│  P5: adjudicator (A/D bots + service supervisor)                          │
└────────────────────────────────────────────────────────────────────────────┘
```

Full deployment topology, env vars and the Vercel-specific realtime rules:
[`docs/DEPLOYMENT.md`](docs/DEPLOYMENT.md).

### 4.1 Write path (scoring correctness)

Everything that changes a score is an **append-only `ScoreEvent`**. Nothing else writes
a score. This is the single most important invariant in the system.

```
player action
  → server function validates (Zod) + authorizes (Clerk session + RBAC)
  → transaction: insert ScoreEvent (idempotency key)
  → recompute team totals → upsert ScoreSnapshot (ranked)
  → update Redis ZSET (leaderboard)
  → publish to Redis Pub/Sub → SSE endpoint fans out to the tournament room
  → clients invalidate the scoreboard query
```

Because scores are derived, any leaderboard can be **rebuilt from the event log** —
which is what makes anti-cheat adjudication, appeals and "what if the Redis cache died"
non-events. Rank computation runs on a `ScoreSnapshot` table updated in the same
transaction, with a periodic reconciliation job that recomputes from events.

Concurrency: score mutations for one team are serialized with a Postgres advisory lock
(`pg_advisory_xact_lock(team_id)`) so two simultaneous solves cannot interleave.

### 4.2 Realtime — SSE on Vercel

Vercel Functions serve WebSockets natively (public beta since 2026-06-22), but each
connection is **pinned** to one instance and is **closed at `maxDuration`** (300 s Hobby,
800 s Pro, 1800 s extended beta). KoArena's live traffic is overwhelmingly
server → client, so **Server-Sent Events** is the primary transport:

| Property | Consequence for KoArena |
| --- | --- |
| SSE is plain HTTP | No upgrade handshake, survives proxies/CDNs, standard `EventSource` in the browser |
| Browser auto-reconnects | `EventSource` resends `Last-Event-ID`; the endpoint resumes from the last delivered event id |
| Stream closes at `maxDuration` | Expected, not an error — the client reconnects and refetches state |
| No shared instance memory | Cross-instance fan-out **must** go through Redis Pub/Sub; the Redis ZSET is the leaderboard of record for reads |
| No client → server push needed | Chat and reactions are ordinary `POST`s (server functions) — no WebSocket required in v1 |

`vercel/resumable-stream` is used so a dropped SSE stream resumes exactly where it
left off instead of replaying from the start.

| Event | Direction | Payload |
| --- | --- | --- |
| `score:update` | server → room | `{ teamId, score, rank, delta }` |
| `scoreboard:full` | server → room | full standings (on join / resync) |
| `challenge:unlock` | server → room | `{ challengeId }` (dynamic CTF unlock) |
| `announce` | server → room | organizer broadcast |
| `chat:message` | server → room | channel messages (sent via a normal POST) |
| `judge:progress` | server → room | `{ submissionId, status }` |
| `attack:event` | server → room | A/D kill/patch feed (Phase 2) |

**Scale-out path** (documented, not speculative): if concurrent SSE connections become a
cost or a limit problem, move the `/api/live/:slug` endpoint to a dedicated always-on
host (Fly.io) or swap the transport for Ably/Pusher. The event contract above does not
change, so the swap is one route.

Presence and typing indicators are the only features that would justify WebSockets —
they are deferred past the first milestone.

### 4.3 Code execution pipeline

```
submit(code, languageId)
  → server fn: rate limit, tournament state check, language allow-list check
  → create Submission(status=QUEUED) + JudgeRun
  → BullMQ job → apps/judge worker
      → resolve Language.judge0LanguageId + limits
      → POST Judge0 /submissions?base64_encoded=true&wait=false
      → poll GET /submissions/{token} until finished
      → map Judge0 status → our Verdict enum
      → for ACM: run each test case, store SubmissionTestResult
      → write verdict + ScoreEvent (ACCEPTED / PENALTY)
      → publish score update
```

Runner isolation (non-negotiable):

* Judge0 runs in its own Docker network; runners get `--network none` for compile,
  `--network bridge` only for A/D services.
* Non-root user, read-only rootfs, `--cap-drop ALL`, `no-new-privileges`.
* Hard limits: CPU seconds, memory, max output size, max file size, PID cap, wall-clock
  timeout enforced by the worker, not by the runner.
* Judge0 API key is never exposed to the browser; only `apps/judge` talks to it.
* Per-language starter templates and time/memory multipliers live in `packages/runner`.

### 4.4 Scoring engine (`packages/game`)

```ts
export interface GameMode {
  id: GameModeId
  validateConfig(config: unknown): Result<ModeConfig>
  deriveEvents(input: DeriveInput): ScoreEventDraft[]   // pure
  rank(input: RankInput): Standing[]                    // pure
  tieBreakers: TieBreaker[]
}
```

Implemented modes: `ctf`, `attackDefense`, `hackathon`, `acm`, `polyglot`, `golf`,
`bugHunt`, `knockout`.

Scoring formulas (full detail in `docs/GAME-MODES.md`):

| Mode | Points |
| --- | --- |
| CTF | `max(minPoints, initialPoints − decayPerSolve × solveCount)` at solve time |
| ACM | 1 point per accepted problem + 20 min penalty from last wrong submission |
| A/D | attack = flag value; patch = fixed service checks; both score on `ScoreEvent` |
| Hackathon | Σ (criterion score × rubric weight) |
| Polyglot | `basePoints ÷ language.difficultyWeight` |
| Golf | `max(0, 1000 − bytes)` |

Tie-breakers are declared per mode and applied in order: score → last-event time →
solve count → team name.

---

## 5. Data model

Full draft: [`packages/db/prisma/schema.prisma`](packages/db/prisma/schema.prisma) —
48 models, 24 enums, snake_case tables and columns, validated against the Prisma 7.10.1 CLI.

Core groups:

| Group | Models |
| --- | --- |
| Identity | `User` — a **mirror row** per Clerk user; `id` *is* the Clerk user id. No local session/account/password table |
| Org | `Organization` (optional `clerkOrgId` link), `OrganizationMember` |
| Teams | `Team`, `TeamMember`, `TeamInvite` |
| Tournament | `Tournament`, `TournamentLanguage`, `TournamentParticipant`, `TournamentTeam`, `TournamentRound` |
| Modes | `Challenge`, `ChallengeCategory`, `ChallengeFile`, `ChallengeHint`, `ChallengeSolve`, `Problem`, `ProblemTestCase`, `Project`, `Rubric`, `RubricCriterion`, `RubricScore`, `Service`, `Attack`, `Bracket`, `BracketMatch` |
| Languages | `Language`, `ProblemLanguage`, `ChallengeLanguage` |
| Flags | `Flag`, `FlagInstance`, `FlagSubmission` |
| Judging | `Submission`, `JudgeRun`, `SubmissionTestResult` |
| Scoring | `ScoreEvent` (append-only ledger), `ScoreSnapshot` |
| Comms | `Announcement`, `ChatMessage`, `Notification` |
| Moderation | `Report`, `AuditLog`, `Ban` |
| Misc | `Asset`, `Prize`, `GameEvent` |

Key decisions:

* **`User.id` is the Clerk user id** (`user_…`). Clerk owns credentials, sessions, OAuth
  and MFA; KoArena keeps a mirror row so it can join users in queries. The user's
  platform role lives in Clerk `publicMetadata.role` and is mirrored to `User.role`;
  a Clerk webhook keeps them in sync.
* **`ScoreEvent` is append-only** and the only writer of score. `ScoreSnapshot` is a
  denormalised ranking, rebuildable from events.
* **Ids**: `cuid(2)` for KoArena-owned records, plus a separate `slug` for URLs. Never
  expose sequential ids (they leak volume and enable enumeration).
* **Flags stored encrypted** (AES-256-GCM, key from env), never in plaintext columns, and
  never returned to clients. Flag *submissions* store only a hash of the attempt plus a
  boolean result.
* **Soft deletes** on user-generated content (`deletedAt`), hard delete only for accounts.
* **Enums in the DB**, not free-text strings, for `gameMode`, `tournamentStatus`,
  `submissionStatus`, `scoreEventType`.

---

## 6. Screens & routes

Full map: [`docs/ROUTES.md`](docs/ROUTES.md).

```
/                                   landing (marketing)
/tournaments                        public browse + filters
/tournaments/$slug                  tournament hub
/tournaments/$slug/scoreboard       live standings
/tournaments/$slug/challenges       challenge board (CTF)
/tournaments/$slug/challenges/$id   challenge detail + flag submit
/tournaments/$slug/problems/$id     problem + code editor (ACM)
/tournaments/$slug/submit           code submission client
/tournaments/$slug/services         A/D control panel
/tournaments/$slug/teams/$id        team view
/dashboard                          my tournaments, teams, submissions
/judging                            judge queue + rubric scoring
/organizer                          organizer dashboard
/organizer/$id                      control room (live)
/organizer/$id/setup                tournament wizard
/organizer/$id/challenges           challenge manager
/organizer/$id/monitor              submissions, plagiarism, reports
/admin                              users, moderation, audit
```

---

## 7. UI plan with ReUI (owners, not hand-rolled)

Per the ReUI rules: one container family per screen, semantic tokens, `gap-*` spacing,
`transition-colors` hover, at most one entrance animation per view, every data region
gets empty / loading / error states.

| Screen | Container family | ReUI / shadcn owners |
| --- | --- | --- |
| Live scoreboard | Frame-led | `frame` + `data-grid` (Table v9) + `badge` (`@reui/badge`) for rank states |
| Challenge board | Cards | `filters` (search + category) + `card` + `badge` for difficulty |
| Challenge detail | Card-led | `card` + `code-block` for hints/writeups + `alert` for hints/announcements |
| Code editor | Frame-led | `frame` + Monaco + `tabs` for multi-file |
| Organizer wizard | Card-led | `stepper` (`c-stepper-4` controlled) + `form` + `select` |
| Judging queue | Frame-led | `data-grid` + `filter` + `dialog` for rubric scoring |
| A/D monitor | Frame-led | `data-grid` (services) + `timeline` (kill feed) |
| Schedule | Card-led | `event-calendar` (`c-event-calendar-1`) |
| Notifications | Frame-led | `timeline` (`c-timeline-11` activity feed) |
| File tree (hackathon repos) | Frame-led | `tree` (`c-tree-5` file explorer) |
| Mode board (KOTH) | Frame-led | `kanban` (`c-kanban-6` persisted to backend) |

Free ReUI items to install as starting points (all `c-*`, no license needed):

```
npx shadcn@latest add @reui/data-grid @reui/filters @reui/frame @reui/badge
npx shadcn@latest add @reui/alert @reui/code-block @reui/stepper @reui/timeline
npx shadcn@latest add @reui/tree @reui/kanban @reui/event-calendar
```

Each one is read with `get_component` → `get_examples` → `get_install_command` before
props are written, and validated with `validate_usage` + `get_audit_checklist` at the end.
The ReUI agent skill is installed at `.opencode/skills/reui` (and globally at
`~/.config/opencode/skills/reui`).

### 7.1 `components.json` (project setup)

```jsonc
{
  "style": "base-nova",          // Base UI is the shadcn default since 2026-07
  "registries": {
    "@reui": "https://reui.io/r/{style}/{name}.json"
  },
  "iconLibrary": "lucide"
}
```

Premium later (Pro/Ultimate): add `REUI_LICENSE_KEY` to `.env.local` and switch `@reui`
to the authenticated object form.

---

## 8. Security & anti-cheat

| Threat | Control |
| --- | --- |
| Malicious submissions | Judge0 isolation: no network, non-root, cap-drop, read-only fs, cpu/mem/pid limits, output truncation |
| Flag leaking | Flags encrypted at rest; never returned by any API; flag attempts hashed; per-team rate limit + lockout |
| Plagiarism | Normalised source hash + winnowing fingerprint + token-overlap similarity → organizer review queue |
| Team stuffing | Tournament-level `maxTeams`, `teamSizeMin/Max`, verified-email requirement, join codes |
| Score tampering | ScoreEvent append-only + advisory locks + reconciliation job + audit log |
| Privileged abuse | Clerk session → RBAC middleware on every server function; organizer scope checks; audit log for every mutation |
| Account abuse | Clerk bot protection + rate limits; optional CAPTCHA on signup; Clerk's bot-protection defaults are kept on |
| SSE abuse | Signed session token on connect, origin allow-list, per-connection rate limit, server-side event filter (a player never receives another team's solve feed unless it is public) |
| XSS in writeups | Markdown rendered with a sanitiser (no raw HTML), CSP headers |

---

## 9. Delivery roadmap

**Milestone 1 = CTF + ACM + Hackathon.** Those three modes exercise the three riskiest
subsystems (scoring ledger, code-execution pipeline, human judging), so the rest of the
modes become additive work on a proven engine.

Each phase ends with something demonstrable, not just merged code.

| Phase | Scope | Exit criteria | Status |
| --- | --- | --- | --- |
| **0 · Foundations** | Monorepo, TanStack Start 1.0, Tailwind v4, shadcn + ReUI, Prisma 7 + managed Postgres, Redis, Docker Compose, CI, Biome, Vitest, Clerk init | App boots, `/` renders, DB migrated, Clerk sign-in works, one ReUI `data-grid` on a real table, CI green | **Done** |
| **1 · Identity & org** | Clerk roles + sync, teams + invites, tournament CRUD, the organizer wizard, public browse + registration | Organizer creates a tournament; player registers a team and joins | **Done** |
| **2 · CTF vertical slice** | Challenges, categories, hints, encrypted flags, submissions, dynamic scoring, **live scoreboard over SSE** | Full CTF playable end-to-end with 3 teams and a live board | Next |
| **3 · Code runner** | Monaco editor, Judge0 integration, BullMQ worker on the worker host, ACM mode, test cases, penalties | ACM tournament playable; verdicts stream to the UI | |
| **4 · Hackathon** | Project submissions, rubrics, judge assignment, judge queue, awards | Hackathon from submit → rubric scoring → results | |
| **5 · Security & scale** | Plagiarism detection, audit log, moderation, rate limits, observability, load test | 500 concurrent players on one tournament, board < 200 ms p95 | |
| **6 · Attack & Defense** | Service deployment, bots, attack capture, patch scoring, kill feed | A/D round playable with 2 teams and 1 service | |
| **7 · Language modes** | Polyglot Battle, Golf Royale, Bug Hunt, Knockout brackets, language roulette | All 8 modes reachable from the wizard | |

Rough effort: ~12–14 engineer-weeks to Milestone 1 with one engineer. Phases 0–4 are
the critical path; phases 6–7 add modes on top of a proven engine.

### Phase 0 — what was built

| Piece | Where |
| --- | --- |
| pnpm workspace + Turborepo | `package.json`, `pnpm-workspace.yaml`, `turbo.json` |
| TanStack Start 1.0 app | `apps/web` — routes for `/`, `/tournaments`, `/leaderboard`, `/organizer`, `/teams`, `/dashboard`, `/sign-in`, `/sign-up` |
| Prisma 7 + Postgres | `packages/db` — 48 models, migrations applied, 23 languages seeded |
| Scoring engine | `packages/game` — all 8 modes, 26 unit tests, no I/O |
| Design system | shadcn/ui `base-nova` + ReUI `data-grid`, `frame`, `badge`, `alert`, `filters`, `stepper` |
| Auth | Clerk — provider, request middleware, sign-in/up routes, `requireUser` guard, webhook sync |
| Local infra | `infra/docker-compose.yml` — Postgres 17, Redis 7, MinIO (optional profile) |
| Tooling | Biome 2.5, Vitest 5, GitHub Actions CI |

### Phase 2 — what was built

| Piece | Where |
| --- | --- |
| Flag encryption | `packages/crypto` — AES-256-GCM, value + IV + auth tag in separate columns, timing-safe compare, only the hash of an attempt is stored |
| The live bus | `packages/realtime` — one event contract, one Redis subscriber per instance, fan-out to every stream |
| The score ledger | `features/scoring` — append-only `ScoreEvent`, per-team advisory lock, snapshot rebuilt from the log, ranked by the engine |
| Challenges | `features/challenges` — categories, hints, files, publish/draft, the board with the ReUI `filters` component |
| The solve path | `features/flags` — decrypt, compare, award, record, publish |
| Live channel | `/api/live/$slug` (SSE) and `useLiveEvents` — the browser reconnects on its own |
| Pages | challenge board, challenge detail with the flag form, live scoreboard, the organizer's challenge manager |
| Demo data | `pnpm --filter @koarena/db seed:demo` — a four-challenge CTF with encrypted flags |

**The points rule belongs to the challenge.** A challenge carries its own
`initialPoints` / `minPoints` / `decayPerSolve`; the mode config only supplies
the first-blood bonus. The board, the card and the award all read the same rule
from `@koarena/game`, so they cannot disagree.

**A participant is a team *or* a solo player.** A score snapshot is keyed on the
team id for a team and on the player id for a solo participant — two solo
players are two standings, not one shared row.

**Flags are stored encrypted and never leave the server.** The attempt hash is
what gets recorded; a wrong attempt is a row with `correct = false` and no
usable flag in it.

### Phase 1 — what was built

| Piece | Where |
| --- | --- |
| Clerk user sync | `features/auth/auth.server.ts` — lazy sync on first request, webhook keeps it fresh |
| Roles | `User.role` mirrored from Clerk `publicMetadata.role`; creating a tournament grants ORGANIZER |
| Teams | `features/teams/` — create, rename, delete, invite by email, accept, revoke, remove, leave |
| Tournaments | `features/tournaments/` — create, update, publish (draft → scheduled → registration), register, withdraw |
| Wizard | `features/tournaments/wizard/` — 4 steps, config validated by the scoring engine |
| Public pages | `/tournaments` list (drafts hidden), `/tournaments/$slug` detail with registration |
| Organizer pages | `/organizer` list, `/organizer/new` wizard, `/organizer/$tournamentId` control room |
| Tests | 21 integration tests against the real database |

**Server/client boundary.** TanStack Start's import protection is enabled with
`behavior: { dev: 'mock', build: 'error' }`, so server-only code reaching the
browser fails the production build. The code is split three ways per domain:
`<domain>.server.ts` (server-only), `<domain>.functions.ts` (`createServerFn`
wrappers) and `types.ts` (DTOs).

**Serializable returns.** Server functions return ISO strings, not `Date` objects,
and config objects use a `JsonValue` type. A single `Date` or `unknown` in a
return type collapses the inferred type across the network boundary.

**Bugs the tests caught.** Draft tournaments were appearing in the public list;
`Base UI`'s `Button` drops button semantics when it renders a link (`render`
needs `nativeButton={false}`); a `Date` reached the grid where a string was
expected; and `/organizer/new` was gated behind the organizer role that only
creating a tournament grants.

### Bugs the live browser test caught

These only showed up in a real browser driving the app, not in the unit tests:

- The client asked for `/api/live/<id>` while the route was `/api/live/$slug`,
  so every `EventSource` got a **404** and the board never moved. The server was
  publishing correctly the whole time.
- A subscriber that had not finished its Redis `psubscribe` **silently missed**
  the first events published after it attached. The subscription is now awaited.
- The solve awarded the tournament's points instead of the challenge's, so the
  card said "worth 450" and the award paid 525.
- `/organizer/new` was gated behind the organizer role that creating a
  tournament grants — a player could not start one.
- The tournament page forced a player to have a team, although a solo
  registration is a first-class option in the schema.

---

## 10. Risks

| Risk | Severity | Mitigation |
| --- | --- | --- |
| TanStack Start 1.0 is 8 days old | High | Pin exact versions, avoid bleeding-edge plugins, keep the app layer thin so a framework swap is a rewrite of `apps/web` only |
| Judge0 sandbox escape | Critical | Isolated host, no network, cap-drop, read-only fs, resource caps; consider gVisor/Firecracker later |
| Live-board drift under load | High | Event ledger + snapshots + reconciliation; never compute rank from cache |
| ReUI free-plan limits | Medium | Everything in this plan is free-tier; premium blocks are optional polish only |
| TanStack Table v9 ecosystem churn | Medium | v9 is `latest`; pin and avoid mixing v8/v9 types |
| Prisma 7 `.env` / driver-adapter footguns | Medium | `prisma.config.ts` with `dotenv/config`, `@prisma/adapter-pg`, documented in `packages/db/README.md` |
| Scope creep across 8 modes | High | Ship CTF + ACM + Hackathon first; the `GameMode` interface makes the rest additive |

---

## 11. Decisions — resolved

| # | Decision | Answer |
| --- | --- | --- |
| 1 | First playable milestone | **CTF + ACM + Hackathon** (covers the ledger, the judge pipeline and human judging) |
| 2 | Production target | **Vercel + managed Postgres** — app on Vercel, Judge0 + BullMQ worker on a separate always-on host |
| 3 | Authentication | **Clerk** — `@clerk/tanstack-react-start`, with `@clerk/ui`'s shadcn theme so the prebuilt UI matches the design system |
| 4 | Monorepo shape | `apps/web` + `packages/*` (pnpm workspaces + Turborepo) |
| 5 | Name | **KoArena** (repo name kept) |
| 6 | Realtime transport | **SSE** primary; Redis Pub/Sub for cross-instance fan-out; WebSocket only for presence later |

Still open, and easy to change later:

* Whether to enable Clerk **Organizations** for clubs/leagues in v1 or keep the
  KoArena-owned `Organization` model only (the schema supports both via `clerkOrgId`).
* Whether the A/D service host in Phase 6 reuses the Judge0 host or gets its own.

---

## 12. Environment state (already done)

| Item | Status |
| --- | --- |
| ReUI MCP server | Configured in `~/.config/opencode/opencode.jsonc` + project `opencode.json` (token via `{file:./.secrets/reui-token}`, gitignored) |
| ReUI agent skill | Installed globally (`~/.config/opencode/skills/reui`, v`68f0e6fa91`) and per project (`.opencode/skills/reui`) |
| ReUI install scaffolding | `.mcp.json`, `.cursor/`, `.claude/`, `.agents/`, `.gemini/`, `AGENTS.md` design rules block |
| ReUI plan | **Free** — 27 components + all `c-*` examples, no license needed |
| Clerk | `@clerk/tanstack-react-start` 1.7.4 wired: provider, request middleware, `/sign-in` + `/sign-up`, `requireUser` guard. 8 Clerk agent skills installed in `~/.agents/skills/` |
| Toolchain | Node `22.22.1`, npm `10.9.9`, **pnpm `10.34.7`** (installed to `~/.local/bin`), Bun `1.3.14` |
| Local infra | Postgres 17 + Redis 7 running via `infra/docker-compose.yml`; MinIO behind the optional `storage` profile |
| Database | 49 tables created by the initial migration, 23 languages + a demo organization seeded |
| Repo | `main` branch — plan committed, then the Phase 0 implementation |
