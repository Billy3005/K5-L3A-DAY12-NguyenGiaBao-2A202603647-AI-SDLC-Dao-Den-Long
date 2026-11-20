# Bằng chứng headless: Phase 3

Sinh tự động bởi `npm run verify -- 3` (không sửa tay). Mỗi scenario chạy qua CLI thật `node dist/headless.js` **hai lần**; hai output phải giống hệt nhau (tất định), sau đó đối chiếu sự kiện kỳ vọng (theo thứ tự) và dòng `end`.

- Commit: `b7fc722` (working tree có thay đổi chưa commit)
- Máy: Windows_NT 10.0.26300 · 12th Gen Intel(R) Core(TM) i5-12500H · Node v22.17.1
- Thời điểm: 2026-11-20T09:18:41.632Z

| Scenario | Yêu cầu | Exit | Thời gian chạy | Kết quả |
|---|---|---|---|---|
| p1-bad-inputs | Contract: file inputs sai định dạng (tick không tăng nghiêm ngặt) -> mã thoát 2 | 2 | 89 ms | ĐẠT |
| p1-collect-and-light | PRD-0 nhặt/nạp/thắp; Ticket-03 [THAY THẾ]: thắp hết đèn KHÔNG kết thúc Đêm (bỏ all_lit), +5/đom đóm, +100 thắp lần đầu | 0 | 83 ms | ĐẠT |
| p1-dawn | Giả định A7: hết thời lượng Đêm (bình minh) mà chưa thắp hết đèn thì thua | 0 | 79 ms | ĐẠT |
| p1-default-night | Đêm 1 mặc định theo seed; người chạy mù ra khỏi bán kính 40 m thì rơi (Ticket-02: fall bật); tất định giữa hai lần chạy | 0 | 140 ms | ĐẠT |
| p1-hit-lose | PRD-0: bị Bóng Mực chạm mất máu; hết máu thì thua | 0 | 80 ms | ĐẠT |
| p1-pulse-stun | PRD-0 + Ticket-02: Tỏa Sáng tốn 3, bán kính 5 m tính 3D từ chân+0.8 tới tâm Bóng Mực, +5 mỗi con | 0 | 81 ms | ĐẠT |
| p2-charm | Ticket-02 Bùa Gió: nhặt như đom đóm, hiệu lực 600 tick; Đêm 2 tại (35,0,0) | 0 | 77 ms | ĐẠT |
| p2-dash | Ticket-02 Lướt: 14 m/s × 12 tick, hồi chiêu 90 tick từ lúc bắt đầu | 0 | 78 ms | ĐẠT |
| p2-drifter-pulse-drop | Ticket-02 Gió Lạc: Tỏa Sáng trúng con đang flee có đồ -> thả lại đom đóm | 0 | 86 ms | ĐẠT |
| p2-drifter-steal | Ticket-02 Gió Lạc: đuổi khi mang ≥5 trong 15 m, 7 m/s, chạm 1.2 m cướp min(3, mang) | 0 | 82 ms | ĐẠT |
| p2-fall-respawn | Ticket-02 Rơi khỏi đảo (Y<-10): -1 lửa, mất hết đom đóm (lost), chờ 60 tick rồi hồi sinh | 0 | 84 ms | ĐẠT |
| p2-night2-pad | Ticket-02 Đêm 2: bục nhảy (20,0,18) bắn sang đảo B, đáp an toàn (không rơi) | 0 | 81 ms | ĐẠT |
| p2-night3-full | Contract v1.1: một Đêm 3 đầy đủ (≤21.600 tick) chạy xong ≤30 s, tất định | 0 | 268 ms | ĐẠT |
| p2-pause | Ticket-02 Tạm dừng: paused/resumed, tick tăng nhưng sim dừng | 0 | 82 ms | ĐẠT |
| p2-safe-zone | Ticket-02 Vùng an toàn 6 m: Bóng Mực trong vùng khi đèn vừa thắp bị đẩy ra, không gây sát thương | 0 | 89 ms | ĐẠT |
| p2-shade-schedule | Ticket-02 Lịch sinh Bóng Mực Đêm 1: 2 con tại tick 300, rồi mỗi 480 tick | 0 | 88 ms | ĐẠT |
| p3-capacity | Ticket-03 §4 Sức chứa 10 + 2×successful_lights (đã thắp 1 lần -> 12) | 0 | 77 ms | ĐẠT |
| p3-dawn-lose | Ticket-03 §3 Bình minh mà dưới ngưỡng (2/5) -> lost dawn | 0 | 79 ms | ĐẠT |
| p3-dawn-win | Ticket-03 §3 Sống tới bình minh với ≥ ceil(0.6×5)=3 đèn sáng -> won dawn_survived; điểm Σ(50+floor(fuel)) + 50×lửa | 0 | 82 ms | ĐẠT |
| p3-drain | Ticket-03 §2 Bóng Mực wander tới đèn yếu (<30), ≤2 m thì drain 5/s; fuel_drain mỗi 60 tick | 0 | 82 ms | ĐẠT |
| p3-out-relight | Ticket-03 §1 Hết dầu -> lantern_out; thắp lại chỉ cần 5 (relight:true, +40) | 0 | 81 ms | ĐẠT |
| p3-refuel | Ticket-03 §1 Châm dầu: used = min(mang, ceil((100-fuel)/10)), fuel ≤ 100, +5/đom đóm | 0 | 81 ms | ĐẠT |

Đầu vào và output của mỗi scenario nằm trong thư mục con cùng tên (`scenario.json`, `inputs.json`, `out.jsonl`). Định nghĩa kỳ vọng: `tests/scenarios/*.json`.
