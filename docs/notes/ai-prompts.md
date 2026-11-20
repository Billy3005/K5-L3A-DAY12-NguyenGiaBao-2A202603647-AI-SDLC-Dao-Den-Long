# Prompt chính gửi Codex CLI (nhật ký AI)

Codex CLI không có file cấu hình trong repo, nên các lời nhắc chính được lưu ở đây (SUBMISSION mục 7).
- Mọi lần gọi đều dùng `codex exec -c sandbox_mode="read-only" -`, tức là một session mới mỗi lần.
- Ở các prompt review, ticket và mã nguồn (hoặc diff) được dán thẳng vào sau phần chỉ dẫn; phần đó được lược bỏ ở đây.
- Câu trả lời của Codex và cách xử lý nằm trong `docs/notes/phase-N.md`.

## Phase 1: lô quyết định

```text
Claude Code here. User delegated all planning decisions to you (as their representative) and wants MINIMAL tokens on both sides. Answer ONLY in this format, one line per item: `<id>: OK` or `<id>: CHANGE -> <new value> (<reason, max 15 words>)`. No preamble, no re-reading files, no summary. Read-only; do not run tools.

Phase 1 time box ~60 min. Proposed decisions (my defaults):

D1 Stack: TypeScript + Three.js + Vite (game); pure-TS sim core in src/sim (no three/DOM imports, seeded PRNG mulberry32, fixed 60 tick/s); Vitest; Zod for scenario/inputs validation (exit 2). Headless bundled by esbuild -> dist/headless.js.
D2 Contract cmds: build_cmd `npm ci && npm run build`; run_cmd `npm run preview` (serves built web); headless_cmd `node dist/headless.js`. Windows dev OK; graders on mac/linux need only Node>=18.
D3 Tuning: player_speed 6, carry_capacity 5, lantern_cost 5, lantern_count_night1 5, pickup_radius 1.0, interact_radius 2.0, pulse_cost 1 (carried motes), pulse_radius 6, night1_duration_s 300, flames 3, invuln_s 1.5, hit_drop_ratio 0.5 (floor), pulse_stun_s 3, pulse_push_m 4, pulse_cooldown_s 1, safe_radius 4, shade_speed 3.5, shade_hit_radius 1.0, fall_enabled false (player clamped inside island r=40). score: per_mote 10, per_lantern 100, per_stun 20, per_second_left 1 (floor of time_left at win), per_flame_left 50 (at win only).
D4 Rules/assumptions: island r=40; lanterns on pentagon r=25; 30 random motes at start, respawn to keep >=20 active; 3 shades at start + 1 every 45s up to 5 (shade_spawned). Pickup automatic within pickup_radius if carried<capacity. Interact (rising edge) deposits into nearest unlit lantern within interact_radius: amount=min(carried, cost-deposited); lit when deposited>=cost. Shades always chase player; cannot enter safe_radius of LIT lanterns only (pushed to edge). Hit: dist<=shade_hit_radius, not invuln, shade not stunned -> flames-1, dropped=floor(carried*ratio) removed from game, invuln starts. Pulse (rising edge, cooldown ready, carried>=pulse_cost): carried-=cost, all shades within pulse_radius stunned+pushed radially away; pulse event even if 0 stunned; per_stun per shade. Pulse with carried<cost: nothing, no event. Win all_lit; lose no_flames; time 0 -> lost/dawn. Jump: Y physics only, no gameplay effect (XZ distances). Event order within a tick: move -> pickup -> interact/deposit/lit -> pulse -> shade move -> hits -> spawns -> game_over.
D5 Process (overrides user's template "approval gate between every skill" + "Codex review before every commit", too slow for 60/30-min phases): per phase = 1 batched Codex decision call -> SPEC update -> TDD on sim -> Claude self-verify -> ONE Codex review of the whole phase diff before tag (fresh `codex exec` with diff + acceptance criteria, NOT resuming this long session, to save tokens) -> fix in-scope -> tag. Small commits allowed without per-commit review.
D6 Harness (rubric B/C): short CLAUDE.md (template rules 1-4 kept, 5-6 rewritten as D5, + project commands/contract rules); Stop hook runs `npm test` and blocks finishing while red; skill `verify-phase` (runs scenarios, determinism double-run diff, writes docs/proof/phase-N/); GitHub Actions CI running test + determinism. Do NOT copy the template's 30+ generic skills (context cost).
D7 Repo layout: move lab docs (current README/GUIDE/...) to docs/lab/; new README per PRD (3 commands, controls, scoring, headless, "Sáng tạo của tôi"); docs/notes/phase-N.md (assumptions, acceptance criteria, AI log w/ token estimates, eval); docs/proof/phase-N/; scenarios in tests/scenarios/*.json with expected assertions.
D8 Creativity: none in Phase 1 (core first); one small render-only idea later, disabled in headless.
D9 Snapshot extras: include recommended `motes` array (id,pos). Shade states: "chase","stunned". Coordinates rounded 3 dp.
```

## Phase 1: review (phần chỉ dẫn)

```text
You are an independent reviewer (you did NOT write this code). Review Phase 1 of a game whose headless mode is graded by HIDDEN automated tests against the Test Contract below. The full source is INLINED below; do NOT use any tools or shell, just read and answer. Files: src/sim/*.ts, src/io/*.ts, src/headless.ts, SPEC.md (assumptions A1-A11 are approved; don't relitigate them unless they violate the contract).

Focus ONLY on things that could fail a hidden contract test or break determinism: contract violations, tick/event semantics, scenario/inputs handling, output format, exit codes, edge cases (scenario values, ids, ordering). Skip style/nits.

Output format, max 12 lines, no preamble:
`[HIGH|MED|LOW] file:line — problem — concrete failing case`
If nothing significant: `NO BLOCKING ISSUES`.
```

## Phase 2: lô câu hỏi Q1–Q23

```text
You represent the product owner. Decide ambiguities in TICKET-02 (file docs/tickets/ticket-02.md in this repo, content also pasted below is NOT needed: read that file only if a question needs it). Minimize tokens. Do not use tools except reading that one file if necessary.

Answer ONLY one line per item: `<id>: OK` or `<id>: CHANGE -> <value> (<reason ≤15 words>)`. No preamble.

Context: deterministic TS sim, 60 tick/s, graded by hidden headless tests (Contract v1.1). Hidden Phase-1 tests must still pass with standard numbers.

Q1 Movement accel: velocity set instantly to target each tick (0 s satisfies "≤0.1 s"); same in air.
Q2 Facing starts +Z, updates to horizontal move dir when moving. Dash dir = current move input dir (after yaw), else facing.
Q3 Dash 12 ticks at 14 m/s; airborne dash: vy=0 and no gravity during dash. Dash during pad launch allowed; launch horizontal velocity resumes after dash.
Q4 Mote cap 30 counts kind=random only. "Empty point" = spawn point with no random mote on it. Initial 20 distinct points chosen by seeded RNG. Spawn ticks are sim_tick 240,480,...
Q5 Shade center y = ground height under it + 1.0 (hover; over void keep last y). Hit height diff = |player.pos.y − shade.pos.y| ≤ 1.5. Drifter y same rule.
Q6 New spawned shade: state "spawning" for 60 ticks (no move, no hit, can be pulsed), then wander/chase by distance.
Q7 wander = stays in place (stationary hover). chase at shade speed toward player XZ. Detect: XZ dist ≤12 → chase; give up: XZ dist >18 → wander. Player in fall-wait is ignored (shades go wander).
Q8 Scenario shade without state → "wander" (immediately subject to transitions).
Q9 recoil: hitting shade moves 2 m straight away from Mây over 60 ticks (linear), cannot hit; then wander/chase by distance.
Q10 Snapshot player.invuln = boolean; dash_cd_s, pulse_cd_s, charm_s in seconds (3 dp). Inactive wind: {active:false, dir_deg:null}.
Q11 night_start {night} emitted with tick 0, written before the tick-0 snapshot.
Q12 If paused at the end, end.state = "paused".
Q13 Night 3 start: contract says (0,0,0) but that is inside bell tower (tier 2). Use (0,6,-5) on tier 2 facing +Z? Night 2 start (0,0,0).
Q14 Drifter idle: circles its spawn point at radius 3 m, 2 m/s. Mist points = that night's shade spawn points. Removed drifters stay in snapshot array with state "removed". After theft/flee timeout, stolen motes vanish with it.
Q15 Wind (night 3, wind_enabled default true): gust starts at sim_tick 1800, 3600, ... lasting 300 ticks, dir_deg from RNG at gust start, adds 2 m/s horizontal to player velocity (ground+air). Warning (render only) 120 ticks before.
Q16 Fall: player_hit {by:"fall", flames, dropped:0, lost:n}. During 60-tick wait player frozen at fall position, cannot act/pickup/be hit; then respawn at night start, vel 0, invuln 90.
Q17 Hit drops: floor(carried/2) motes at seeded random angle/radius in ring 1.5–2.5 m around Mây, y = ground at that XZ (if void: player ground y). kind=dropped, ttl 480 ticks.
Q18 Shade spawn picks random valid point (XZ ≥15 m from player) via RNG; the 2 at tick 300 use distinct points.
Q19 pulse event data: {stunned_ids:[shades hit incl. already stunned], drifter_ids:[drifters hit]}.
Q20 Scenario charms entries {id, pos?, available?, respawn_ticks?}; drifters entries {id?, pos, state?, stolen?, state_ticks_left?}.
Q21 tuning: per_mote=10 now means per DEPOSITED mote; per_stun=5; per_second_left=2; pulse_stun_s=2; invuln_s=1.5; hit_drop_ratio=0.5; fall_enabled=true; shade_speed=4.0 (night-3 4.5 internal); safe_radius=6; carry_capacity=10; lantern_cost=10; pulse_cost=3; pulse_radius=5; pulse_cooldown_s=3; pulse_push_m=4.
Q22 Safe zone eviction: shades inside a lantern lit this tick move radially out at 0.2 m/tick until at 6 m (≤30 ticks), cannot hit meanwhile, keep their state name. Shades outside are clamped to 6.0 m when moving in.
Q23 Night 3 terrain: stand on highest surface ≤ y+0.3 (step tolerance); target higher than that = wall (block horizontal move). Tower = surface at y 14 inside r≤2 on tier 2 (wall).
```

## Phase 2: review (phần chỉ dẫn)

```text
You are an independent reviewer (you did NOT write this code). The game's headless mode is graded by HIDDEN automated tests against TICKET-02 / Contract v1.1 (full ticket below). Source is INLINED; do NOT use tools or shell.

Approved decisions (don't relitigate): instant accel; facing +Z; air dash vy=0; mote cap counts random only; shade y fixed at spawn/scenario value (spawn = ground+1); spawning 60 ticks; wander = stationary; recoil 2 m over 60 ticks; player.invuln boolean; wind inactive dir_deg null; night_start at tick 0 before tick-0 snapshot; end.state "paused" if paused; Night 3 start (0,0,0) with "embedded" walk-out rule; drifter idle circles r=3; gust every 1800 sim ticks for 300; pulse event adds drifter_ids.

Focus ONLY on what could fail hidden tests or break determinism: violations of the ticket's numbers, the mandatory tick order, event/snapshot/scenario semantics, off-by-one in timers (stun 120, invuln 90, ttl 480, flee 240/120, charm 600/2700, fall wait 60, eviction ≤30), pause semantics, spawn schedules, win/lose priority. Skip style.

Output max 14 lines, no preamble: `[HIGH|MED|LOW] file:line — problem — concrete failing case`. If nothing significant: `NO BLOCKING ISSUES`.
```

## Phase 3: lô R1–R13

```text
You represent the product owner. Decide ambiguities in TICKET-03 "Đèn cạn dầu" (repo file docs/tickets/ticket-03.md; read only if needed). Minimize tokens, no other tools.
Answer ONLY one line per item: `<id>: OK` or `<id>: CHANGE -> <value> (<reason ≤15 words>)`. No preamble.

Context: deterministic sim, 60 tick/s, hidden headless tests (Contract v1.2). Phase-2 shades: wander was stationary.

R1 wander now MOVES toward its target lantern at shade speed (4.0; night3 4.5). Target, re-evaluated each tick: nearest lit lantern with fuel<30 (tie smaller id); else keep current target if still unlit, else nearest unlit lantern; none -> stand still. Hover once within 2 m of an unlit target.
R2 Scenario shades[].target_lantern_id = shade's initial/current target (needed for state "drain").
R3 drain -> chase when Mây XZ ≤ 6 m; wander -> chase detect stays 12 m; chase gives up >18 m.
R4 fuel_drain event: per draining shade, every 60 ticks of continuous draining (counter starts on entering drain), emitted in step 2 after subtraction; fuel 1 dp.
R5 Lit lantern keeps deposited = its light cost (10 or 5); refuel doesn't change deposited; lantern_out resets deposited 0.
R6 tuning.score: per_mote 5, per_lantern 100, per_stun 5, per_second_left 0 (time bonus removed), per_flame_left 50. Extra score numbers (relight 40, drain-stun 15, dawn lamp 50+floor(fuel)) live in code/README only.
R7 Scenario lantern lit:true -> ever_lit forced true; fuel default 100. lit:false with fuel given -> fuel ignored (0).
R8 relit_count increments on each relight (not first light).
R9 Refuel eviction: only when fuel was <30 before refuel and ≥30 after; shades within 6 m pushed out ≤30 ticks, no damage meanwhile.
R10 Fuel stored as integer 1/60 units; snapshot fuel = round(units/60, 1 dp). Low-fuel check fuel<30 means units<1800.
R11 lantern_lit data {lantern_id, relight}. game_over at dawn: no_flames first, then won/dawn_survived if lit ≥ ceil(0.6×N) else lost/dawn. Win score: Σ lit (50+floor(fuel)) + 50×flames.
R12 Drain transitions in step 8 order: lantern out / fuel≥30 / dist>2 m -> wander; else Mây ≤6 m -> chase.
R13 Pulse score: +15 total for a shade that was in drain right before the hit, else +5.
```

## Phase 3: review (phần chỉ dẫn)

```text
You are an independent reviewer (you did NOT write this code). Hidden automated tests grade the headless mode against TICKET-03 / Contract v1.2 (ticket below; it extends Ticket-02's mandatory 12-step tick order). Source is INLINED; do NOT use tools.

Approved decisions: wander walks to nearest weak lit lantern (<30), else keeps/picks nearest unlit, hovers within 2 m of unlit; scenario target_lantern_id = initial target; drain->chase at 6 m; fuel_drain per shade every 60 drain ticks in step 2; lit lantern keeps deposited = its cost; tuning per_second_left 0; scenario lit:true forces ever_lit, default fuel 100; relit_count++ per relight; refuel eviction only when crossing <30 -> >=30, exactly 30 ticks to >6 m; fuel integer 1/60 units; pulse +15 for a draining shade.

Focus ONLY on what could fail hidden tests: fuel arithmetic/rounding, interact candidate selection, step-2 decay/drain + lantern_out timing, drain transitions, safe-zone loss <30, win/lose at dawn (priority, threshold ceil(0.6N), score), capacity, event payloads, scenario fields. Skip style.

Output max 12 lines, no preamble: `[HIGH|MED|LOW] file:line — problem — concrete failing case`. If nothing significant: `NO BLOCKING ISSUES`.
```

## Phase 4: lô D1–D15

```text
You represent the product owner for a student game lab (TypeScript + Three.js web game "Đảo Đèn Lồng", pure deterministic sim in src/sim, headless CLI node dist/headless.js, 60 tick/s). Phase 4 ticket (Contract v1.3) asks for: bench mode, soak test, local leaderboard, accessibility, packaging, release v1.0.0. Answer each decision with "OK" or "CHANGE: <short reason + alternative>". Be terse (max ~8 lines total beyond the list). No shell needed.

Ticket extracts:
- bench: `<bench_cmd> --seed 42 --duration 30 --out bench.json`; window 1280x720 not fullscreen, vsync off if possible (else README note); Night 1 full effects; exactly 200 shades in wander spread evenly over the island (seed 42), exactly 100 motes; L1-L3 lit fuel 100; disabled: extra spawns, damage, mote pickup, fuel decay, night end; shades still wander normally. No input, Mây still at (0,0,0). Camera orbit centre (0,0,0) r=30 Y=15 looking at origin, starts at (30,15,0), counter-clockwise seen from above, 15 s per lap. First 3 s warm-up, then measure exactly --duration s, exit 0. Fields: contract_version "1.3", avg_fps=1000N/Σdt, p1_low_fps (mean of k=max(1,ceil(0.01N)) largest dt), frame_ms_p95, frames, load_ms (process start -> first bench frame), peak_mem_mb (RSS; null for web if not measurable + explain), vsync_off, renderer, os.
- soak: `<soak_cmd> --seed 7 --nights 10 --out soak.json`; headless, one process, nights 1->2->3 rotating, "Đêm thứ i dùng seed 7 + i", each night until end or standard duration; random inputs by seed: new move direction every 30 ticks; per tick 5% jump, 3% dash, 2% pulse, 10% interact. mem_start_mb = RSS after loading first night; mem_end_mb = RSS after resetting last night. Pass: crashes=0, mem_end <= 1.2 mem_start.
- leaderboard: after Bình Minh or any loss, enter name 3-12 chars [A-Za-z0-9_] (Vietnamese diacritics = bonus); entry {name, score (sum of won nights), nights_won 0-3, achieved_at ISO 8601 with tz, seed}; top 10, score desc, tie -> earlier first; stored on local disk, survives restart; leaderboard screen from main menu; `<run_cmd> --export-leaderboard out.json` -> {"entries":[...]} in order.
- a11y: rebind all actions (4 moves, jump, dash, interact, pulse, pause), detect duplicate keys and tell the user, "Khôi phục mặc định", persisted; captions/visual cues: shade appears (+ edge-of-screen arrow), wind about to blow, last 10 s, lantern fuel < 30; reduced motion disables camera shake + screen flash; UI text >= 18 px at 1280x720, large text option x1.25.

Proposed decisions:
D1 bench runner: `node scripts/bench.mjs` (bench_cmd) drives the built web game with Playwright (devDependency) in a HEADED Chromium window, viewport 1280x720; tries installed Google Chrome, then Edge, then Playwright's Chromium. Flags --disable-gpu-vsync --disable-frame-rate-limit -> vsync_off true. Optional --headless for CI (numbers then not meaningful).
D2 frame timing measured in the page with requestAnimationFrame timestamps; dt_i = gap between consecutive frames inside the measured window; p95 = nearest-rank (sorted asc, index ceil(0.95N)-1). Stats computed by a pure, unit-tested function.
D3 load_ms = node performance.now() (ms since bench process start) when the page reports its first bench frame (includes server start + browser launch).
D4 peak_mem_mb = null for this web build (Chromium is multi-process; renderer/GPU process RSS not reliably exposed via Playwright); bench.json adds "mem_note" explaining and "js_heap_peak_mb" from performance.memory as extra info.
D5 camera angle θ = 2π·t/15 with t from the first bench frame (warm-up included), position (30cosθ, 15, −30sinθ) (three.js Y up: −Z is "up" on a top-down view with +X right, so this is CCW from above).
D6 bench sim: a `bench` world option (never set by headless) that skips fuel decay/drain, pickups, contact (hits/steals) and the win/lose check; spawns already off via random_*=false and wind off. 200 shades + 100 motes placed uniformly by area on the Night-1 disk (r = 38·sqrt(u), θ = 2πv) using the world's seeded RNG (seed 42), shades state wander. Headless output unchanged (all scenarios re-run as regression).
D7 soak: `node --expose-gc dist/soak.js` (soak_cmd). i is 0-based: night i (i=0..9) uses seed 7+i and night (i mod 3)+1, so --seed is the first night's seed. Input RNG = separate mulberry32(seed of that night) (world RNG untouched). Move direction = random angle every 30 ticks (incl. tick 0). Buttons held for that tick only per probability. A night stops at game_over or after durationS·60 sim ticks. results[i] = "won"/"lost" ("crashed" if it threw; crashes counts these). mem_end after dropping the last world + global.gc(). duration_s = wall time of the whole run, 1 dp.
D8 leaderboard storage: replace run_cmd `npm run preview` with `node dist/server.js` (zero-dep Node server bundled by esbuild): serves dist/web + GET/POST /api/leaderboard persisted to data/leaderboard.json (next to dist, gitignored; env LEADERBOARD_FILE overrides). `node dist/server.js --export-leaderboard out.json` writes {"entries":[...]}. Browser falls back to localStorage when the API is absent (vite dev / static hosting). Ordering/validation in one pure module shared by client and server, unit-tested.
D9 name: NFC-normalised, 3-12 code points of [A-Za-z0-9_] plus Vietnamese letters (bonus). Entry seed = the run seed chosen at "Bắt đầu" (night n uses runSeed+n-1). Score = sum of won nights in this run; offered after Bình Minh and after any loss (not after a mid-run win).
D10 rebind: stored as KeyboardEvent.code; Escape always also pauses/back (not rebindable, safety). Duplicate -> assignment refused + message "Phím X đang dùng cho Y". Arrow keys camera unchanged. Mouse click pulse stays.
D11 cues: caption line under the timer for 3 s: "Bóng Mực xuất hiện" (+ purple/blue arrow at screen edge toward the newest shade for 3 s), "Gió sắp thổi" (2 s before gust, existing timing), "10 giây cuối", "Đèn Lx sắp cạn dầu" (while fuel < 30).
D12 reduced motion: adds small camera shake + red screen flash on player_hit (new feel), both disabled with reduced motion (default from prefers-reduced-motion); also stops timer blink.
D13 fonts: html font-size 18px and rem units; HUD minimum 18px; "Chữ lớn" sets 22.5px root.
D14 release v1.0.0: zip with dist/ (web + server.js + headless.js + soak.js), README/LICENSE/CREDITS; run with Node 20 `node dist/server.js`. Demo .mp4 recorded by the student (Windows Game Bar) and attached to the release.
D15 contract: game.contract.json 1.3 with bench_cmd, soak_cmd, run_cmd `node dist/server.js`; headless JSONL unchanged (no version field in output).
```

## Phase 4: review (phần chỉ dẫn; sau đó là `git diff` của src, scripts/bench.mjs, contract, package.json)

```text
You are reviewing Phase 4 of a student game (TypeScript + Three.js, pure deterministic sim in src/sim, headless CLI graded by hidden tests). Ticket-04 summary: bench mode (200 wander shades + 100 motes, L1-L3 lit fuel 100, no spawns/damage/pickups/fuel loss/night end, camera orbit r30 Y15 CCW 15 s/lap, 3 s warm-up, stats avg_fps=1000N/Σdt, p1_low=1000/mean(k largest dt) k=max(1,ceil(.01N)), p95, load_ms from process start to first bench frame), soak (10 nights rotating 1→2→3, night i seed 7+i, random inputs: new move dir every 30 ticks, per tick 5% jump 3% dash 2% pulse 10% interact; crashes=0 and mem_end<=1.2 mem_start), local leaderboard (name 3-12 [A-Za-z0-9_] (+Vietnamese bonus), entry name/score(sum of won nights)/nights_won/achieved_at ISO+tz/seed, top 10, score desc then earlier first, disk-persisted, menu screen, `<run_cmd> --export-leaderboard out.json` -> {"entries":[...]}), accessibility (rebind all actions incl. 4 moves/jump/dash/interact/pulse/pause with duplicate detection+message, reset defaults, persisted; captions: shade appears + edge arrow, wind soon, last 10 s, lantern fuel<30; reduced motion disables camera shake + screen flash; UI text >=18px, big text x1.25), contract v1.3 with bench_cmd/soak_cmd; headless output for v1.0-1.2 must stay unchanged.
Decisions already approved: soak_cmd uses --no-opt (RSS growth was V8 TurboFan memory: JS heapUsed flat 4.1->4.5MB, RSS plateau same at 10 vs 30 nights; with --no-opt 32.9->36.5MB, identical results). peak_mem_mb null for web with note. vsync_off true only if measured avg_fps>65.
Find REAL bugs only (wrong behaviour vs the ticket, crashes, headless output changes, security issue in the server). Output at most 8 findings, each: severity HIGH/MED/LOW, file:line-ish, one-line problem, one-line fix. If nothing, say "no findings". Be terse. No shell needed: the diff is below.
```
