---
name: verify-phase
description: Run the game headless through the real CLI and save evidence for a phase. Use before tagging phase-N, after any change to src/sim or the contract, or when asked "does it work / prove it".
---

# verify-phase

Evidence = real runs of `dist/headless.js`, never hand-written output.

1. `npm test` must be green (unit + contract-sync + determinism + exit codes).
2. Add/adjust scenarios for this phase's requirements in `tests/scenarios/pN-<name>.json` (DoD: **≥ 1 per new feature**):
   - `requirement` (quote the PRD/ticket line it proves), `seed`, `ticks`, optional `night` (1-3), `snapshot_every`, `scenario`, `inputs`
   - `expect_exit`; `expect_events` (ordered subset match, `tick`/`data` optional); `expect_no_events` (names that must not occur); `expect_end` (subset)
   - Timers: a state set at tick T for N ticks is visible on ticks T..T+N-1. Off-by-one in hand-computed expectations was the #1 mistake in phase 2.
   - Expectations come from the ticket + `SPEC.md`, computed by hand **before** running. If a run disagrees, decide whether the code or the expectation is wrong and log it in `docs/notes/phase-N.md`. Never copy the output into the expectation just to make it pass.
3. `npm run verify -- N` → builds, runs each scenario twice, checks determinism + expectations, writes `docs/proof/phase-N/summary.md` + inputs/outputs.
4. If a ticket replaces an old rule: update or delete the old scenario **with a one-line reason** in the phase notes. Old phases' scenarios keep running unless replaced (they are the regression suite: `p1-*` must still pass in `verify -- 2`).
   Performance: contract requires a full night (≤ 21,600 ticks) in ≤ 30 s; `p2-night3-full` + `tests/contract.test.ts` cover it.
5. Commit the proof together with the code it was generated from, then tag.

Visual-only requirements (HUD, lighting, camera): screenshot/GIF from `npm run dev` into `docs/proof/phase-N/`, captioned with the requirement it shows.
