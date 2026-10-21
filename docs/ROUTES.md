# KoArena — Route & Screen Map

TanStack Start file-based routing. Files live in `apps/web/src/routes/`.
`__root.tsx` holds the shell, providers and the auth/session context.

Conventions:

* **Route guards** live in `beforeLoad` on the route — never in the component.
  Clerk's `auth()` / `getAuth()` is resolved in `beforeLoad` and the result is passed
  into the loader; components never call the auth SDK directly.
* **Data** is loaded in the route `loader` (server-side) and mutated through
  `createServerFn` server functions; components never call the DB.
* **Search params** are validated with Zod via `validateSearch` (TanStack Router).
* Every screen below lists its **container family** and its **ReUI/shadcn owners**,
  per the ReUI rules (one container family per screen, never a Card inside a Frame).
* Clerk prebuilt UI (`<UserButton>`, `<SignInButton>`, `<OrganizationSwitcher>`) uses the
  `@clerk/ui` **shadcn theme** so it matches the KoArena surfaces.

---

## 1. Public

| Route | File | Purpose | UI owners |
| --- | --- | --- | --- |
| `/` | `index.tsx` | Landing: what KoArena is, modes, CTA | Card-led marketing, `badge` for mode chips |
| `/tournaments` | `tournaments/index.tsx` | Browse live + upcoming tournaments | `filters` + `data-grid` (Frame-led) |
| `/tournaments/$slug` | `tournaments/$slug/index.tsx` | Tournament hub: about, rules, timeline, join | Card-led, `timeline` for the schedule |
| `/tournaments/$slug/scoreboard` | `.../scoreboard.tsx` | Live standings | Frame-led, `data-grid` + `badge` rank states |
| `/tournaments/$slug/archive` | `.../archive.tsx` | Past tournaments, top boards | Frame-led, `data-grid` |
| `/leaderboard` | `leaderboard/index.tsx` | Global all-time player board | Frame-led, `data-grid` |
| `/login`, `/register` | `auth/*.tsx` | Auth | Card-led, shadcn `card` + `form` |

> Clerk owns the actual sign-in screens. KoArena links to `/sign-in` (Clerk's hosted
> route) and only renders its own `auth/callback` screen for the tournament join-code
> and email-verification handshakes.

## 2. Participant (play area)

| Route | Purpose | UI owners |
| --- | --- | --- |
| `/dashboard` | My tournaments, teams, submissions | Cards + `data-grid` (Frame-led for the table) |
| `/tournaments/$slug/play` | Mode-dependent entry point | — |
| `/tournaments/$slug/play/challenges` | CTF challenge board | Cards + `filters` + `badge` difficulty |
| `/tournaments/$slug/play/challenges/$id` | Challenge detail, files, hints, flag input | Card-led, `code-block` for hints, `alert` for hints |
| `/tournaments/$slug/play/problems` | ACM problem list | Cards + `filters` |
| `/tournaments/$slug/play/problems/$id` | Problem + editor + submit | Frame-led, Monaco in `frame`, `tabs` for files |
| `/tournaments/$slug/play/services` | A/D control panel | Frame-led, `data-grid` (services) + `timeline` (kill feed) |
| `/tournaments/$slug/play/brackets` | Knockout bracket | Frame-led, `kanban`-style match columns |
| `/tournaments/$slug/play/teams/$id` | Team view (captain: manage roster) | Cards + `data-grid` (members) |
| `/tournaments/$slug/submissions` | My submissions | Frame-led, `data-grid` + `code-block` for output |
| `/tournaments/$slug/solutions/$id` | Read-only solution (writeup) | Card-led, `code-block` + `timeline` |

## 3. Judge

| Route | Purpose | UI owners |
| --- | --- | --- |
| `/judging` | My assignment queue | Frame-led, `data-grid` + `filters` |
| `/judging/$assignmentId` | Rubric scoring form (blind by default) | Card-led, `stepper` + shadcn `slider`/`input` |
| `/judging/completed` | Submitted scores | Frame-led, `data-grid` |

## 4. Organizer

| Route | Purpose | UI owners |
| --- | --- | --- |
| `/organizer` | My tournaments + templates | Cards + `data-grid` |
| `/organizer/$id/setup` | Creation wizard (mode-aware steps) | Card-led, `stepper` (`c-stepper-4` controlled) |
| `/organizer/$id` | Control room: live state, quick actions | Cards (KPIs) + `frame` (table) |
| `/organizer/$id/challenges` | Challenge manager | Frame-led, `data-grid` + `filters` |
| `/organizer/$id/problems` | Problem + test case manager | Frame-led, `data-grid` + `code-block` (test data) |
| `/organizer/$id/languages` | Enabled languages + weights | Cards, `number-field` for weights |
| `/organizer/$id/teams` | Registered teams, seeding, kick | Frame-led, `data-grid` |
| `/organizer/$id/judging` | Judge assignments (hackathon) | Frame-led, `data-grid` + `filters` |
| `/organizer/$id/monitor` | Submissions, plagiarism, flags, reports | Frame-led, `data-grid` + `tabs` |
| `/organizer/$id/schedule` | Rounds & calendar | Card-led, `event-calendar` (`c-event-calendar-1`) |
| `/organizer/$id/settings` | Mode config, rules, danger zone | Card-led, shadcn `form` + `alert-dialog` |

## 5. Admin

| Route | Purpose | UI owners |
| --- | --- | --- |
| `/admin` | Platform overview | Cards (KPIs) + `frame` |
| `/admin/users` | Users, roles, bans | Frame-led, `data-grid` + `filters` |
| `/admin/reports` | Moderation queue | Frame-led, `data-grid` |
| `/admin/audit` | Audit log | Frame-led, `data-grid` + `timeline` |
| `/admin/languages` | Global language registry + Judge0 ids | Frame-led, `data-grid` |

---

## 6. Server routes (API-ish, non-UI)

| Route | Purpose |
| --- | --- |
| `api/health` | Liveness + DB/Redis/Judge0 status |
| `api/live/$slug` | **SSE** live channel: score updates, announcements, solve feed, judge progress, chat. Resumable via `Last-Event-ID` |
| `api/scoreboard/$slug` | Full standings JSON (SSR fallback + no-JS) |
| `api/judge/webhook` | Judge0 result callback (signed) |
| `api/clerk/webhook` | Clerk `user.created` / `user.updated` / `user.deleted` → mirror into `User` |
| `api/files/$assetId` | Signed download redirect for assets |

### Live event contract

| Event | Payload |
| --- | --- |
| `score:update` | `{ teamId, score, rank, delta }` |
| `scoreboard:full` | full standings (on join / resync) |
| `challenge:unlock` | `{ challengeId }` |
| `announce` | `{ title, body }` |
| `chat:message` | `{ channel, userId, body, createdAt }` |
| `judge:progress` | `{ submissionId, status }` |
| `attack:event` | `{ serviceId, attackerTeamId, captured: boolean }` (Phase 6) |

---

## 7. Screen states (required everywhere)

Every data region ships all three:

| State | Pattern |
| --- | --- |
| Empty | `frame`/`card` with an icon, one sentence, one action button |
| Loading | `Skeleton` shaped like the real content (same grid/rows), not a spinner |
| Error | Inline `alert` with the message and a **Retry** button |

Dark mode must work for all of them.

---

## 8. Motion budget

* One entrance animation per view (a stagger counts as one).
* Hover/press: `transition-colors` only.
* Reveal: `duration-200 ease-[cubic-bezier(0.22,1,0.36,1)]`, transform + opacity.
* Live scoreboard rows: **no** per-row animation on score change — animate the number
  with a CSS transition on the tabular-nums value only.
* `MotionConfig reducedMotion="user"` once at the root; `motion-reduce:` on CSS.
