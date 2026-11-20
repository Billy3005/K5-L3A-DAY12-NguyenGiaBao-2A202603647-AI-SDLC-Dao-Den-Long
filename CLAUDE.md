# CLAUDE.md — Đảo Đèn Lồng (Day 12 AI SDLC lab)

3D game (TypeScript + Three.js) with a headless mode graded by hidden tests against **Test Contract v1.3** (3 nights; bench + soak + leaderboard export).
Lab rules: [LAB-README](LAB-README.md) · [GUIDE](GUIDE.md) · [RUBRIC](RUBRIC.md) · [SUBMISSION](SUBMISSION.md). Living spec: [SPEC.md](SPEC.md). Ticket text (verbatim): [docs/tickets/](docs/tickets/) — quote it, never paraphrase numbers from memory.

## Commands

```
npm ci && npm run build        # build_cmd: web -> dist/web, headless -> dist/headless.js
npm run dev                    # play locally (Vite)
npm test                       # vitest: unit + scenario + determinism + contract-sync
npm run verify -- N            # build + run ALL tests/scenarios (old phases = regression) via dist/headless.js, twice, diff -> docs/proof/phase-N/
node dist/headless.js --seed 1 --night 3 --ticks 600 --out out.jsonl
npm run shots -- N             # Playwright screenshots of the built game -> docs/proof/phase-N/screens/ (verify captions by eye)
npm start                      # run_cmd: node dist/server.js (web + leaderboard API -> data/leaderboard.json); --export-leaderboard out.json
node scripts/bench.mjs --seed 42 --duration 30 --out bench.json   # bench_cmd (real browser window via Playwright)
node --expose-gc --no-opt dist/soak.js --seed 7 --nights 10 --out soak.json   # soak_cmd (--no-opt: see ADR 0002)
```

## Where things live

- `src/sim/tuning.ts` contract numbers (`TUNING`) + ticket constants in ticks (`C`); `src/sim/maps.ts` the 3 standard maps (`topAt` terrain).
- `src/sim/step.ts` follows Ticket-02's **mandatory 12-step tick order**; keep the numbered comments in sync with the ticket.
- `src/sim/bench.ts` bench scene (`World.bench`, render-only, never headless); `src/io/soak.ts` soak; `src/leaderboard.ts` rules shared by client + `src/server.ts`.
- Timer convention: a state set at tick T with N ticks shows in snapshots for ticks T..T+N-1 (decrement happens in step 2 of later ticks).

## Architecture rules (hard)

- `src/sim/` is pure logic: **never** import `three`, DOM, `Date`, `Math.random`, or timers. Randomness only via the seeded RNG in the world.
- Render (`src/render/`) only reads sim state and feeds inputs; it never changes rules. Creative extras live in render only, or behind a flag that headless keeps off.
- All tuning numbers live in `src/sim/tuning.ts`. `game.contract.json` must match it (a test enforces this). Change both together.
- Output contract: coordinates rounded to 3 dp, event `tick = k+1` for step k, final line `{"type":"end",...}`, bad scenario/inputs → exit 2.

## 1. Think Before Coding
State assumptions explicitly; if ambiguous, present interpretations instead of picking silently. Push back when a simpler approach exists. If unclear, stop and ask. Contract/PRD ambiguity → record the assumption in `SPEC.md` + `docs/notes/phase-N.md`, never invent requirements.

## 2. Simplicity First
Minimum code that solves the ticket. No speculative features, abstractions for single use, or configurability nobody asked for. Graphics beyond the requirement earn zero points.

## 3. Surgical Changes
Touch only what the task needs; match existing style; don't refactor what isn't broken; remove only orphans you created. Every changed line traces to the ticket.

## 4. Goal-Driven Execution
Turn each requirement into a check (`do A → see B`) before coding. Plan as `step → verify: check`. "Agent says it runs" is not evidence: run tests/headless and save output.

## 5. Phase Flow (time-boxed: 60 / 60 / 30 / 90 min)

Overrides the template's per-skill approval gates (too slow for the time box; user delegated decisions to Codex):

1. Read ticket → list must-haves + ambiguities → **one batched Codex decision call** (defaults proposed, Codex answers OK/CHANGE).
2. Update `SPEC.md` (rules + acceptance criteria) first, then code.
3. Test-first on `src/sim` (vitest scenarios), small commits, one concern each.
4. Self-verify: `npm test` green + `npm run verify -- N` → proof in `docs/proof/phase-N/`.
5. **One Codex review per phase** of the whole phase diff before tagging: fresh `codex exec -c sandbox_mode="read-only" -` with the contract text + changed sources **inlined** in the prompt (Codex's Windows sandbox cannot run shell; never resume long sessions, ~145k tokens each). Write a failing test per finding, then fix in-scope ones; report others.
6. Notes (`docs/notes/phase-N.md`: assumptions, eval, AI log with token estimates) → `git tag phase-N` → push.

Time is up → tag anyway and record what is unfinished as "chưa đạt". Never hand-edit outputs or write always-pass tests.

## 6. Tokens
Keep context lean: read only the files needed, batch questions to Codex, use short prompts, stop and redirect when going off-track. Log rough token use per phase.
