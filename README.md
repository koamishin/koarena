<img src="assets/icon.svg" width="64" height="64" alt="">

# KoArena

Tournament platform for programmers — CTF, hackathons, attack &amp; defense, algorithmic
rounds, and language-driven game modes.

Created in [T3 Code](https://t3.codes).

## Plan

* **[PLAN.md](./PLAN.md)** — product scope, tech stack, architecture, roadmap, risks
* **[docs/GAME-MODES.md](./docs/GAME-MODES.md)** — rules + scoring formulas for all 8 modes
* **[docs/PRISMA-SCHEMA.prisma](./docs/PRISMA-SCHEMA.prisma)** — 51-model draft schema (validated with Prisma 7.10.1)
* **[docs/ROUTES.md](./docs/ROUTES.md)** — route & screen map with ReUI component owners
* **[docs/plan-overview.html](./docs/plan-overview.html)** — visual plan summary

## Design system

shadcn/ui (Base UI, `base-nova`) + **ReUI** on Tailwind CSS v4.

The ReUI MCP server and the ReUI agent skill are installed:

* MCP: `opencode.json` → `https://mcp.reui.io` (token in `.secrets/reui-token`, gitignored)
* Skill: `.opencode/skills/reui` (project) and `~/.config/opencode/skills/reui` (global)
* ReUI design rules for agents: `AGENTS.md`

Free plan — all 27 ReUI components and every `c-*` example install without a license.
Premium blocks need **Pro**, Motion Icons need **Ultimate**.
