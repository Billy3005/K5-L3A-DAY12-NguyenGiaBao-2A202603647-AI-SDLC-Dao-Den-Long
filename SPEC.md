# SPEC: Đảo Đèn Lồng

Spec sống: cập nhật **trước** code mỗi khi ticket đổi. Nguồn: PRD-0 + Test Contract v1.0 (lab board, Phase 1). Số liệu: `src/sim/tuning.ts` = `game.contract.json`.

## Luật Phase 1 (Đêm 1, Đảo Bến)

Giả định (A*) là chỗ PRD-0 mơ hồ, được Codex duyệt thay người dùng (xem `docs/notes/phase-1.md`).

| # | Luật |
|---|---|
| A1 | Đảo tròn bán kính 40 m. `fall_enabled=false`: người chơi bị giữ trong đảo, không rơi. |
| A2 | 5 đèn L1..L5 trên ngũ giác bán kính 25 m, L1 tại (0,0,25). |
| A3 | Ngẫu nhiên theo seed: 30 đom đóm lúc đầu, sinh thêm để luôn ≥20; 3 Bóng Mực lúc đầu, +1 mỗi 45 s, tối đa 5 (`shade_spawned`). `random_motes=false` / `random_shades=false` tắt hẳn việc sinh thêm. |
| A4 | Nhặt đom đóm **tự động** khi trong `pickup_radius` và `carried < carry_capacity`. +`per_mote`. |
| A5 | `interact` (cạnh lên) nạp vào đèn **chưa thắp gần nhất** trong `interact_radius`: `amount = min(carried, lantern_cost − deposited)`. Đủ `lantern_cost` → thắp, +`per_lantern`. |
| A6 | `pulse` (cạnh lên, hết hồi chiêu, `carried ≥ pulse_cost`): trừ `pulse_cost` đom đóm; mọi Bóng Mực trong `pulse_radius` bị choáng `pulse_stun_s` và đẩy xa `pulse_push_m` theo hướng ra xa người chơi; +`per_stun` mỗi con. Không đủ ánh sáng → không có gì, không phát sự kiện. |
| A7 | Thắng: thắp đủ 5 đèn (`all_lit`), cộng `per_second_left × floor(time_left)` + `per_flame_left × flames`. Thua: hết ngọn lửa (`no_flames`), hoặc hết thời lượng Đêm (`dawn`). |
| A8 | Bóng Mực luôn đuổi người chơi với `shade_speed`; không vào được bán kính `safe_radius` của đèn **đã thắp** (bị đẩy ra mép). Bóng Mực choáng thì đứng yên, không gây sát thương. |
| A9 | Bị chạm (`≤ shade_hit_radius`, không bất tử): −1 ngọn lửa, rơi `floor(carried × hit_drop_ratio)` đom đóm (mất hẳn), bất tử `invuln_s`. Tối đa 1 lần chạm mỗi tick. |
| A10 | Nhảy chỉ đổi trục Y; mọi luật dùng khoảng cách XZ nên nhảy không né được Bóng Mực. |
| A12 | Scenario đã ở trạng thái kết thúc (5 đèn `lit` sẵn, `flames: 0`, `time_left_s: 0`) vẫn là `playing` ở tick 0 (dựng scenario không phát sự kiện); `game_over` xảy ra ở bước đầu tiên (tick 1). Với `--ticks 0` thì `end.state = playing`. |
| A13 | Choáng kéo dài đúng `pulse_stun_s × 60` tick tính từ tick tỏa sáng; nhiều vùng an toàn chồng nhau được giải lặp để Bóng Mực ra ngoài mọi vùng. |
| A11 | Thứ tự trong một tick: hẹn giờ → di chuyển/nhảy → nhặt → nạp → tỏa sáng → Bóng Mực → va chạm → sinh thêm → kết thúc. |

## Tiêu chí nghiệm thu Phase 1

| ID | Làm A → thấy B | Kiểm chứng |
|---|---|---|
| AC1 | Đi qua đom đóm → `mote_picked`, carried +1, điểm +10 | `tests/rules.test.ts`, scenario `p1-collect-and-light` |
| AC2 | Đứng cạnh đèn, nhấn nạp đủ 5 → `deposit`, `lantern_lit` | rules test, `p1-collect-and-light` |
| AC3 | Tỏa sáng gần Bóng Mực → `pulse` có id, Bóng Mực `stunned` và bị đẩy, carried −1 | rules test, `p1-pulse-stun` |
| AC4 | Bóng Mực chạm → `player_hit`, mất lửa, rơi đom đóm; hết lửa → `game_over lost no_flames` | rules test, `p1-hit-lose` |
| AC5 | Thắp hết đèn → `game_over won all_lit`; hết giờ → `lost dawn` | rules test, `p1-collect-and-light`, `p1-dawn` |
| AC6 | Cùng seed/scenario/inputs → output giống hệt; input/scenario sai → exit 2 | `tests/contract.test.ts`, `npm run verify` (chạy 2 lần, so sánh) |
| AC7 | `tuning` trong `game.contract.json` khớp số game dùng | `tests/contract.test.ts` |
| AC8 | Chơi được trong trình duyệt: đi, nhảy, camera 3D, HUD, thắng/thua, chơi lại (R) | Chơi thử thủ công + ảnh chụp |
