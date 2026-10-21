# KoArena — Game Mode Specifications

Each mode is a `GameMode` implementation in `packages/game`. A mode owns:
its **config schema**, the **events** it derives, the **ranking** function and its
**tie-breakers**. Everything below is data, not branching logic in the UI — adding a
mode means adding one folder and one registry entry, never editing the app.

Shared vocabulary:

| Term | Meaning |
| --- | --- |
| `ScoreEvent` | Append-only ledger row. The only thing that ever writes a score. |
| `points` | Base value of a thing (a challenge, a flag, a rubric criterion) |
| `weight` | Multiplier applied to points before they hit the ledger |
| `delta` | Signed change actually applied to a team's total |
| `Standing` | One row of the leaderboard: `{ rank, teamId, score, solves, penalty, lastEventAt }` |

---

## 1. CTF (Jeopardy)

**Shape.** Teams race through challenges across categories. Each challenge has a flag.
Solving a flag awards points that decay as more teams solve it.

### Config

```ts
interface CtfConfig {
  basePoints: number            // default 500
  minPoints: number             // default 100
  decayPerSolve: number         // default 50
  dynamicUnlock: boolean        // unlock a challenge only after N solves
  dynamicUnlockThreshold: number
  firstBloodBonus: number       // default 25
  hintsEnabled: boolean
  flagFormat: 'static' | 'regex' | 'case-insensitive'
  allowTeamSize: [number, number]
}
```

### Scoring

```
pointsAtSolve = max(minPoints, basePoints − decayPerSolve × solveCountBeforeThisSolve)
delta         = pointsAtSolve + (isFirstBlood ? firstBloodBonus : 0)
```

### Special mechanics

* **Dynamic scoring** — visible on the challenge card as "currently worth N".
* **First blood** — first solver of a challenge gets a bonus and a broadcast.
* **Dynamic unlock** — a challenge stays hidden until `dynamicUnlockThreshold` solves;
  participants are told a category has opened, not which challenge.
* **Hints** — a hint can cost points (`cost`) and only become visible after `unlocksAt`.
* **Flag attempts** — rate limited per team (default 10/min). Too many wrong attempts
  locks the team out of that challenge for 60s. The lockout is a `ScoreEvent` of type
  `PENALTY` (0 points) so it shows in the audit trail.

### Screens

Challenge board (grid of challenge cards by category), challenge detail (description,
attachments, hints, flag input), live scoreboard, solve feed.

---

## 2. Attack & Defense

**Shape.** Every team runs a vulnerable service. Teams attack each other's services to
capture flags, and patch their own to survive.

### Config

```ts
interface AttackDefenseConfig {
  attackPoints: number           // default 100, per flag captured
  patchPoints: number            // default 50, per successful patch check
  checkIntervalSec: number       // bot check cadence, default 30
  flagRotationSec: number        // default 300
  serviceDownPoints: number      // points deducted per check the service fails
  botKillDelaySec: number
}
```

### Scoring

```
capture:  delta = attackPoints          (team A captures a flag on team B's service)
patch:    delta = patchPoints           (team A's service survives a check after being patched)
downtime: delta = −serviceDownPoints   (per failed bot check, per service)
```

### Special mechanics

* **Per-team flags** — `FlagInstance` rows: the same `Flag` template materialised with a
  unique value per team per rotation.
* **Rotation** — the game master rotates flag values on a timer; the attacker must
  extract the *current* flag, not a stale one.
* **Bots** — the adjudicator service runs a checker against each team's service on the
  configured interval. A failed check is downtime; a service that stays down for
  `botKillDelaySec` is killed and restarted with the original (vulnerable) image.
* **Attack validity** — an attack must be a submitted script that actually extracts the
  current flag from the target service. Only attacks judged by the adjudicator count.
* **Cheat guard** — a team may not attack itself; teams cannot see each other's source.

### Screens

A/D control panel (your services, their services, attack form, kill feed timeline),
service monitor grid (organizer), scoreboard with attack/patch breakdown.

---

## 3. Hackathon (Buildathon)

**Shape.** Teams build for a fixed window, submit a project + writeup, judges score it
against a weighted rubric.

### Config

```ts
interface HackathonConfig {
  rubric: Array<{ name: string; weight: number; maxScore: number }>
  minTeamSize: number
  maxSubmissions: number         // revisions allowed, default 5
  judgingMode: 'blind' | 'open'  // blind = judges cannot see the team name
  requireRepo: boolean
  requireDemo: boolean
  requireWriteup: boolean
}
```

### Scoring

```
raw      = Σ (criterionScore × criterion.weight)
normalised = (raw / Σ (maxScore × weight)) × 1000
```

The rubric weights are normalised, so a rubric totalling 100 points and one totalling 10
produce comparable leaderboard numbers.

### Special mechanics

* **Blind judging** — the judge UI hides team identity until the score is submitted.
* **Assignment** — judges are assigned projects automatically (balanced by load) or
  manually by an organizer; every assignment is tracked (`JudgingAssignment`).
* **Revisions** — a team can resubmit up to `maxSubmissions` times; only the latest
  counts.
* **Conflicts of interest** — a judge cannot score a project from a team they are in.

### Screens

Project submission form (repo link, demo link, description, writeup), judge queue
(`data-grid`), rubric scoring dialog, results board with per-criterion breakdown.

---

## 4. ACM (Algorithmic / ICPC-style)

**Shape.** Teams solve algorithmic problems. Correctness is judged against hidden test
cases. Wrong submissions cost penalty time.

### Config

```ts
interface AcmConfig {
  problemPoints: number          // default 1
  penaltyMinutes: number         // default 20
  penaltyAfterFirstWrong: boolean // ICPC: wrong submissions before the first AC
  wrongSubmissionCap: number     // default 3 per problem per team
  languages: Language[]          // per-problem allow-list
  timeLimitMs: number
  memoryLimitKb: number
}
```

### Scoring

```
solved  = count of accepted problems
penalty = Σ over solved problems ( 20 × wrongSubmissionsBeforeFirstAC )
```

`Standing` sorts by `solved DESC, penalty ASC, lastAcceptedAt ASC`.

### Special mechanics

* **Sticky penalty** — wrong submissions only count if the problem is eventually solved.
* **Per-problem language allow-list** — the editor only offers allowed languages.
* **Test-case feedback modes** — `none` (ICPC strict), `per-test` (show pass/fail count),
  `full` (practice mode).
* **Frozen scoreboard** — standings hide the last N minutes of solves until the round
  ends (classic ICPC penalty hiding), configurable per round.

### Screens

Problem list, problem detail + Monaco editor, submission history, live standings with
the freeze indicator.

---

## 5. Polyglot Battle (Language Arena)

**Shape.** Everyone gets the *same* problem. You pick the language you want to use.
The twist: languages differ in difficulty, so points are normalised by a weight.

### Config

```ts
interface PolyglotConfig {
  basePoints: number             // default 1000
  languageWeights: Record<string, number>  // e.g. { python: 1.0, c: 0.6, rust: 0.5 }
  rounds: number
  banLanguagesPerRound: number   // language roulette: ban N languages each round
  headToHead: boolean            // pairwise duels, winner takes the round
}
```

### Scoring

```
delta = round(basePoints / language.weight)
```

A `c` solution is worth more than a `python` solution because the weight is lower.
Weights are editable per tournament and are part of the config, not hardcoded.

### Special mechanics

* **Language roulette** — each round a random subset of the enabled languages is banned;
  the ban list is public, the scoring weight still applies.
* **Head-to-head** — in a duel, the faster correct submission takes the round
  (`roundPoints`), the loser takes `consolationPoints`.
* **Language leaderboard** — a secondary board grouping by language, showing which
  languages are winning and by how much.

### Screens

Language picker (cards showing each language's weight and ban state), editor, duel
bracket, per-language leaderboard.

---

## 6. Golf Royale (Code Golf)

**Shape.** Same problem, shortest correct program wins.

### Config

```ts
interface GolfConfig {
  basePoints: number             // default 1000
  bytesPenaltyPerByte: number    // default 1
  minBytes: number               // default 1
  tieBreaker: 'first-submitted' | 'fewest-warnings'
}
```

### Scoring

```
delta = max(0, basePoints − bytes × bytesPenaltyPerByte)
```

### Special mechanics

* **Byte count** measured after stripping comments and trailing whitespace
  (normalization is deterministic and shared by all clients).
* **Cheating check** — solutions that hardcode test input are detected by a
  mutation check (running against held-out test cases).
* **Golf board** — shows bytes, language, and the top 10 shortest solutions.

---

## 7. Bug Hunt (Patch Race)

**Shape.** Each challenge is a codebase with a seeded bug. Fastest team to make the
hidden tests pass wins.

### Config

```ts
interface BugHuntConfig {
  basePoints: number             // default 1000
  speedBonusPerMinute: number    // default 20
  language: Language             // the language the codebase is in
  partialCredit: boolean         // award partial points for fewer failing tests
}
```

### Scoring

```
delta = basePoints + speedBonusPerMinute × minutesRemaining
```

### Special mechanics

* **Per-team starting repos** — the same bug, optionally with a per-team twist.
* **Partial credit** — with `partialCredit`, points scale with the percentage of hidden
  tests passing.
* **Test feedback** — always visible (this mode *is* about fixing tests), but hidden
  tests stay hidden until the round ends.

---

## 8. Knockout (KOTH — King of the Hill)

**Shape.** Bracketed head-to-head rounds with elimination.

### Config

```ts
interface KnockoutConfig {
  bracketType: 'single-elim' | 'double-elim' | 'round-robin'
  roundsPerMatch: number         // default 3
  pointsPerRound: number         // default 100
  consolationPoints: number      // default 25
  languages: Language[]          // duel language pool
}
```

### Scoring

```
match winner  = most rounds won (first to ⌈rounds/2⌉)
delta         = pointsPerRound × roundsWon
loser         = consolationPoints
```

### Special mechanics

* **Bracket seeding** — seeded from the previous round's standings or manual.
* **Language duel** — each side picks a language before the match; the pick is hidden
  until both are locked (this is where the language axis really bites).
* **Elimination** — eliminated teams are marked `eliminatedAt` and their score freezes
  on the public board but stays visible in the organizer's view.

---

## 9. Mode composition rules

Rules that apply to **every** mode and live in `packages/game`, not in a mode file:

1. **Only a `ScoreEvent` changes a score.** The UI never computes points.
2. **Points are computed at event time**, never recomputed from current state. A decay
   rule applies to the solve that happened *then*.
3. **Idempotency**: every mutation carries a client key; replaying it is a no-op.
4. **Ranking is deterministic**: score → tie-breakers → team id, always.
5. **Freeze windows**: rounds may freeze the public board; the internal board always
   shows the truth.
6. **Every mode must be playable by a solo participant** unless it explicitly requires
   a team (`ATTACK_DEFENSE`, `HACKATHON` default to teams).

---

## 10. Adding a mode — the checklist

1. `packages/game/src/modes/<mode>.ts` — implement `GameMode`.
2. `packages/game/src/modes/<mode>.test.ts` — table-driven tests with golden cases.
3. Register in `packages/game/src/modes/index.ts`.
4. Add the DB tables it needs to `packages/db/prisma/schema.prisma`.
5. Add the wizard step in `apps/web/src/features/tournaments/wizard/`.
6. Add the player screens under `apps/web/src/routes/play/`.
7. Add the organizer screens under `apps/web/src/features/organizer/`.
8. Seed one example tournament per mode in `packages/db/prisma/seed.ts`.

Steps 5–7 are the only mode-specific UI work; steps 1–4 and 8 are mechanical.
