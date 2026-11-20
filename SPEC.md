# SPEC: Đảo Đèn Lồng

Spec sống: cập nhật **trước** code mỗi khi ticket đổi. Số liệu: `src/sim/tuning.ts` = `game.contract.json` (test ép khớp). Ticket gốc: [docs/tickets/](docs/tickets/).

| Phase | Nguồn | Contract |
|---|---|---|
| 1 | PRD-0 | v1.0 |
| 2 | [Ticket-02 "Ba hòn đảo"](docs/tickets/ticket-02.md): **thay mọi số liệu tự chọn ở Phase 1** bằng số chuẩn, thêm 3 Đêm và tính năng mới | v1.1 |

## Luật hiện hành (Phase 2)

Số liệu, bản đồ và thứ tự 12 bước trong một tick lấy **nguyên văn** từ Ticket-02; xem bảng trong ticket. Dưới đây chỉ ghi các **giả định** cho chỗ ticket chưa nói rõ (Codex duyệt Q1–Q23 thay người dùng, xem `docs/notes/phase-2.md`).

| # | Giả định |
|---|---|
| B1 | Tăng tốc và dừng tức thì (0 s, thỏa "≤ 0.1 s"), cả trên không. |
| B2 | Hướng quay mặt ban đầu là +Z, cập nhật theo hướng di chuyển. Lướt theo hướng input hiện tại, nếu đứng yên thì theo hướng mặt. Lướt trên không: vy = 0, không trọng lực. |
| B3 | Trần 30 đom đóm chỉ tính loại `random`. "Điểm trống" là điểm chưa có đom đóm random. 20 điểm ban đầu chọn bằng RNG theo seed. |
| B4 | Tâm Bóng Mực / Gió Lạc khi sinh = mặt đất + 1.0 m; độ cao giữ nguyên sau đó (scenario cho `y` thì giữ đúng `y` đó). |
| B5 | Bóng Mực mới sinh ở `spawning` 60 tick (không di chuyển, không gây sát thương, vẫn bị Tỏa Sáng). `wander` = đứng yên. Phát hiện/bỏ đuổi tính theo XZ. Scenario không ghi `state` → `wander`. |
| B6 | Recoil: lùi thẳng ra xa Mây 2 m chia đều 60 tick (bước đầu ngay tick đánh), không gây sát thương. |
| B7 | Thời lượng trạng thái: choáng hiển thị 120 tick (tick kích hoạt đến +119), recoil 60, spawning 60, flee 240 (hoặc 120 sau khi thả đồ), đom đóm rơi 480 tick, chờ hồi sinh 60. |
| B8 | Snapshot: `player.invuln` là boolean, các trường `*_s` tính bằng giây (3 chữ số). Khi không có gió: `wind = {active:false, dir_deg:null}`. |
| B9 | `night_start {night}` mang `tick: 0`, ghi trước snapshot tick 0. Nếu đang tạm dừng lúc hết `--ticks` thì `end.state = "paused"`. |
| B10 | Điểm xuất phát mọi Đêm là (0,0,0) theo contract. Ở Đêm 3, điểm này nằm trong tháp chuông, nên áp luật **"kẹt trong khối"**: nếu đang ở trong địa hình thì được đi ngang tự do ở độ cao hiện tại cho tới khi ra chỗ đứng hợp lệ. |
| B11 | Địa hình: đứng trên mặt cao nhất ≤ y + 0.3 m. Mặt cao hơn mức đó là vách (chặn đi ngang, có trượt theo từng trục). Tháp chuông là vách cao 14 m. |
| B12 | Gió Lạc: `idle` lượn vòng bán kính 3 m quanh điểm sinh với 2 m/s. Điểm sương là điểm sinh Bóng Mực của Đêm. Con đã `removed` vẫn ở lại trong mảng snapshot. |
| B13 | Gió Đêm 3: cơn gió bắt đầu tại sim_tick 1800, 3600, … dài 300 tick, hướng chọn bằng RNG, cộng 2 m/s vào vận tốc ngang. Báo trước 120 tick (chỉ hiển thị và âm thanh). |
| B14 | Rơi: `player_hit {by:"fall", flames, dropped:0, lost}`. Trong 60 tick chờ, Mây đứng yên tại chỗ rơi, không hành động, không nhặt, không bị chạm. |
| B15 | Đom đóm rơi do bị đánh: góc và bán kính 1.5–2.5 m chọn bằng RNG; `y` = mặt đất tại điểm đó (trên khoảng không thì lấy `y` của Mây). |
| B16 | Sự kiện `pulse`: `{stunned_ids, drifter_ids}`. Thứ tự sự kiện trong cùng tick theo thứ tự xử lý (ví dụ `drifter_drop` trước `pulse`). |
| B17 | Vùng an toàn: Bóng Mực trong vùng khi đèn vừa thắp bị đẩy ra theo hướng tâm 0.2 m/tick (≤ 30 tick), không gây sát thương trong lúc đó. Bóng ngoài vùng bị chặn ở mép 6 m. Nhiều vùng chồng nhau được giải lặp. |
| B18 | Scenario: `charms[] {id, pos?, available?, respawn_ticks?}`, `drifters[] {id?, pos, state?, stolen?, state_ticks_left?}`, `shades[] {…, state?, state_ticks_left?}`. |
| B20 | Bộ đếm trong danh sách bước 2 của ticket (bùa, bất tử, hồi chiêu, choáng, TTL) giảm **trước** khi di chuyển, theo đúng thứ tự bắt buộc. Vì vậy Bùa Gió nhặt ở tick T hiển thị `charm_s` từ tick T đến T+599 và tăng tốc di chuyển cho các tick T+1 đến T+599. Bộ đếm **không** có trong danh sách (Gió Lạc bỏ chạy, cơn gió) giảm **sau** khi di chuyển, để đủ 240 / 300 lần tác dụng. |
| B21 | Đẩy lùi của Tỏa Sáng dừng khi gặp vật cản địa hình (vách tầng, tháp chuông: mặt đất cao hơn chân Bóng Mực, tức tâm − 1 m, quá 0.3 m) hoặc mép vùng an toàn. |
| B19 | Phiên bản chơi: tạm dừng chỉ dừng gọi `step()` (logic dừng hoàn toàn). Điểm tổng = tổng điểm các Đêm đã thắng. |

## Tiêu chí nghiệm thu Phase 2 (Ticket-02 Phần 3 + contract)

| ID | Làm A → thấy B | Kiểm chứng |
|---|---|---|
| AC2.1 Số chuẩn | `tuning` khớp Ticket-02; chạy 6.0 m/s, nhảy 7 m/s, lướt 14 m/s × 12 tick, hồi chiêu 90 tick | `contract.test`, `rules.test` (movement), `p2-dash` |
| AC2.2 Rơi | Ra khỏi đảo → `player_hit by:fall` + `lost`, hồi sinh sau 60 tick, bất tử | `rules.test` (falling), `p2-fall-respawn` |
| AC2.3 Bóng Mực | Lịch sinh 300 + 480k; spawning → wander/chase 12/18 m; trúng → recoil, −1 lửa, rơi đom đóm; vùng an toàn 6 m | `rules.test` (shades), `p2-shade-schedule`, `p2-safe-zone` |
| AC2.4 Tỏa Sáng | 3 đom đóm, 3D 5 m, choáng 120 tick, đẩy 4 m/15 tick, +5/con | `rules.test` (pulse), `p1-pulse-stun` |
| AC2.5 Gió Lạc | Đuổi khi mang ≥ 5 trong 15 m; cướp min(3, mang); Tỏa Sáng → flee / thả đồ | `rules.test` (drifters), `p2-drifter-steal`, `p2-drifter-pulse-drop` |
| AC2.6 Bùa Gió | Nhặt → 600 tick, 7.2 m/s, lướt không hồi chiêu; xuất hiện lại sau 2700 tick | `rules.test` (charms), `p2-charm` |
| AC2.7 Ba Đêm | `--night 1/2/3` dùng đúng bản đồ chuẩn (đèn, điểm sinh, bục nhảy, tầng/dốc, gió) | `rules.test` (maps), `contract.test` (format), `p2-night2-pad`, `p2-night3-full` |
| AC2.8 Tạm dừng | `pause` → `paused`, `state:"paused"`, sim_tick/thời gian đứng yên; nhấn lại → `resumed` | `rules.test` (pause), `p2-pause`; bản chơi: Esc/P mở menu |
| AC2.9 Chuỗi 3 Đêm | Menu → giới thiệu (Ông Đăng) → chơi → kết quả → Đêm kế; thắng Đêm 3 → Bình Minh; thua → chơi lại Đêm | Chơi thử + ảnh chụp |
| AC2.10 Cài đặt | Âm lượng, độ nhạy chuột lưu giữa các lần mở (localStorage) | Chơi thử: đổi, tải lại trang |
| AC2.11 Âm thanh | Nhạc nền và 10 hiệu ứng theo ticket (tổng hợp WebAudio) | Chơi thử |
| AC2.12 HUD + bảng màu | Bố cục HUD, đồng hồ đỏ nhấp nháy khi ≤ 30 s, nhắc nạp đèn, mũi tên tới đèn; màu theo bảng chuẩn; ánh sáng môi trường = 0.15 + 0.55 × tỉ lệ đèn sáng | Ảnh chụp; `src/render/main.ts` (hằng `P`) |
| AC2.13 Hiệu năng | Một Đêm đủ 21.600 tick ≤ 30 s; bản chơi ≥ 30 FPS ở 1280×720 | `contract.test` (performance), đo CLI 243 ms; FPS: bộ đếm trong HUD |
| AC2.14 Hồi quy | Các scenario Phase 1 vẫn đạt khi đổi sang số chuẩn | `p1-*` trong `npm run verify -- 2` |

## Lịch sử: Phase 1 (PRD-0, contract v1.0)

Các giả định A1–A13 của Phase 1 nằm ở tag `phase-1`. Ticket-02 thay toàn bộ số liệu và phần lớn luật tự chọn (đảo, đèn, sức chứa, chi phí, choáng, điểm, rơi). Những gì còn giữ: thứ tự `interact` chỉ xét đèn chưa sáng; đầu vào hỏng → mã thoát 2; tọa độ làm tròn 3 chữ số.
