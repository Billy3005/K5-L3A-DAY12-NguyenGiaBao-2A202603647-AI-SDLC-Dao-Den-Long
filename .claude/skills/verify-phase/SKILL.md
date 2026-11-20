---
name: verify-phase
description: Run the game headless through the real CLI and save evidence for a phase. Use before tagging phase-N, after any change to src/sim or the contract, or when asked "does it work / prove it".
---

# verify-phase

Evidence = real runs of `dist/headless.js`, never hand-written output.

1. `npm test` must be green (unit + contract-sync + determinism + exit codes).
2. Add/adjust scenarios for this phase's requirements in `tests/scenarios/pN-<name>.json`:
   - `requirement` (quote the PRD/ticket line it proves), `seed`, `ticks`, optional `snapshot_every`, `scenario`, `inputs`
   - `expect_exit`; `expect_events` (ordered subset match, `tick`/`data` optional); `expect_end` (subset)
   - Expectations come from the ticket + `SPEC.md`, computed by hand **before** running. If a run disagrees, decide whether the code or the expectation is wrong and log it in `docs/notes/phase-N.md`. Never copy the output into the expectation just to make it pass.
3. `npm run verify -- N` → builds, runs each scenario twice, checks determinism + expectations, writes `docs/proof/phase-N/summary.md` + inputs/outputs.
4. If a ticket replaces an old rule: update or delete the old scenario **with a one-line reason** in the phase notes. Old phases' scenarios keep running unless replaced.
5. Commit the proof together with the code it was generated from, then tag.

Visual-only requirements (HUD, lighting, camera): screenshot/GIF from `npm run dev` into `docs/proof/phase-N/`, captioned with the requirement it shows.
