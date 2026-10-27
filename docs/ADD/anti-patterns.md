# Anti-patterns catalogue

Codified recurring failure shapes. Consult before reviewing code that touches a listed surface.

## Convention
- A suspected pattern first appears in a daily summary as a candidate: `CAND-NNN — <one-line shape>` (three-digit, sequential, never reused).
- Promote it to this catalogue on its **second sighting**, or after a single high-cost hit by judgment.
- Each entry: ID · shape · where it bites (track / files) · how to detect · the fix · first and second sighting dates.

## Catalogue

### AP-001 — PBIR group children written with page-absolute positions (was CAND-001)
- **Shape:** a generator or agent writes `position.x / y` of a visual inside a visual group as page coordinates; Desktop stores children relative to the group, so the visual lands offset by the group's own x / y (often off-canvas).
- **Where it bites:** Track B, `pbi-report/**/*.Report/definition/pages/**/visuals/*/visual.json` with a `parentGroupName`.
- **Detect:** for every visual with `parentGroupName`, check that `x + width ≤ group width` and `y + height ≤ group height`; anything larger is almost certainly page-absolute. Open in Desktop: children drawn outside their group's box.
- **Fix:** convert to group-relative (`child − group origin`) before writing; the CLAUDE.md Track B rule "children of a visual group store positions relative to the group" is the guard.
- **Sightings:** 2026-10-21 (twice, Ledger rebuild).

### AP-002 — Sub-agent memory written inside a track folder (was CAND-003)
- **Shape:** a sub-agent started with its working directory inside a track folder resolves "repo-root `.claude/agent-memory/`" against that folder and creates `<track>/.claude/agent-memory/`, so the next run doesn't find its notes and the track folder grows a stray `.claude/`.
- **Where it bites:** every track folder (`fabric-app/`, `js-report/`, `pbi-report/`); seen with fin (`fabric-app/.claude/agent-memory/` still exists 2026-10-23).
- **Detect:** any `.claude/` directory below the repo root other than the root one.
- **Fix:** every delegation brief names the absolute memory path (repo-root `.claude/agent-memory/<agent>/`); move stray notes back to the root folder and remove the track copy (USER's call).
- **Sightings:** 2026-10-21 (twice); 2026-10-23 (the fin folder still present).

### AP-003 — "Harmless" read-only git commands despite the no-git rule (was CAND-008)
- **Shape:** an agent runs `git status`, `git check-ignore`, `git diff` or `git log` to "just check" while the rule says agents never run git; read-only commands still touch the working tree's index lock and break the USER-only git contract.
- **Where it bites:** all agents, including the main agent; most often at the end of a task ("verify what changed").
- **Detect:** any `git ` invocation in an agent transcript or tool log.
- **Fix:** check state with file tools (Glob / Grep / Read, `.gitignore` text) instead of git; every delegation brief says "no git commands at all, including read-only ones"; the git block for the USER is the only git output.
- **Sightings:** 2026-10-22 (5 hits: nerd ×2, bip ×2, main agent ×1); 2026-10-23 (hunter `git log`, ginee `git --version`, both despite the brief line).
