# Phase 2: Ticket-02 "Ba hòn đảo" + Contract v1.1

## Quy trình đã chạy

1. Lưu nguyên văn ticket vào [docs/tickets/ticket-02.md](../tickets/ticket-02.md) để agent tra cứu thay vì nhớ số liệu.
2. Ưu tiên theo điểm: logic headless và contract trước (30 điểm test ẩn), giao diện sau.
3. **Lô 23 câu hỏi mơ hồ (Q1–Q23) gửi Codex bằng session mới**, trả lời dạng `OK`/`CHANGE`, khoảng **15k token**. Lô Phase 1 resume session cũ tốn khoảng 146k token.
   - Codex đổi 1 mục: Q13, điểm xuất phát Đêm 3 giữ là (0,0,0) theo contract, dù điểm này nằm trong tháp chuông. Tôi thêm luật "kẹt trong khối" (B10) để vẫn chơi được.
   - Trong lúc chờ Codex trả lời, Claude viết code theo đề xuất mặc định nên không mất thời gian chờ.
4. Viết lại lõi mô phỏng theo thứ tự 12 bước bắt buộc của ticket. SPEC ghi giả định B1–B19 và tiêu chí nghiệm thu AC2.1–AC2.14.
5. Test: 42 test (luật, contract, tất định, mã thoát, hiệu năng) và 16 scenario qua CLI thật, mỗi scenario chạy hai lần.
6. Review độc lập bằng Codex (session mới, ticket và nguồn đưa thẳng vào prompt) tìm được 4 mục:
   - **HIGH:** Tỏa Sáng đẩy Bóng Mực xuyên tháp chuông và vách tầng. **Đã sửa** (B21).
   - **MED:** cơn gió chỉ tác dụng 299 lần. **Đã sửa** (B20).
   - **MED:** Gió Lạc bỏ chạy chỉ bay 239 tick. **Đã sửa** (B20).
   - **MED:** Bùa Gió chỉ tăng tốc 599 tick di chuyển. **Không sửa:** ticket bắt buộc giảm bộ đếm "bùa" ở bước 2, trước bước di chuyển, nên ghi thành B20.

   Mỗi mục đã sửa có test tái hiện, viết trước và đã đỏ trước khi sửa.

## Thay đổi yêu cầu: test và scenario cũ bị thay

| Cũ (Phase 1) | Mới | Lý do |
|---|---|---|
| `tests/rules.test.ts` (17 test với số tự chọn: sức chứa 5, choáng 3 s, +10 khi nhặt…) | Viết lại toàn bộ theo số chuẩn | Ticket-02 Phần 1 "thay mọi giá trị bạn tự chọn". File cũ còn ở tag `phase-1`. |
| `p1-collect-and-light`: 5 đom đóm thắp đèn | 10 đom đóm, điểm tính khi nạp | `lantern_cost` 10, `per_mote` tính khi nạp |
| `p1-pulse-stun`: mang 2, Bóng Mực ở (5,0,0) | Mang 4, Bóng Mực ở (4,1,0) | Tỏa Sáng tốn 3; bán kính 5 m đo 3D từ chân + 0.8 m |
| `p1-default-night`: kỳ vọng bị Bóng Mực chạm | Kỳ vọng rơi khỏi đảo | Ticket-02 bật rơi khỏi đảo; Bóng Mực chỉ sinh từ tick 300 |
| `fall_enabled: false`, người chơi bị giữ trong đảo | Rơi khi Y < −10 | Ticket-02 |
| Bóng Mực có 3 con từ đầu | Lịch sinh 300 + khoảng sinh, trạng thái `spawning` | Ticket-02 |

Các scenario `p1-hit-lose`, `p1-dawn`, `p1-bad-inputs` vẫn đạt mà không phải sửa.

## Đánh giá Phase 2

| Tiêu chí | Kết quả | Bằng chứng |
|---|---|---|
| AC2.1–AC2.8, AC2.13 (headless) | Đạt | 42 test + 16/16 scenario, [docs/proof/phase-2/summary.md](../proof/phase-2/summary.md) |
| AC2.14 Hồi quy Phase 1 | Đạt | `p1-*` chạy lại với số chuẩn |
| AC2.13 Hiệu năng headless | Đạt | Đêm 3 đủ 21.600 tick: 243 ms (i5-12500H, Node 22) |
| AC2.8 Menu tạm dừng | Đạt | [screenshots.md](../proof/phase-2/screenshots.md), ảnh 06 |
| AC2.9 Chuỗi 3 Đêm | Đạt | Ảnh 02–05: kết quả Đêm 1 → giới thiệu Đêm 2 (Ông Đăng) → thắng Đêm 2 (tổng 2638) → giới thiệu Đêm 3. Điểm khớp luật. |
| AC2.12 HUD | Đạt | Ảnh 01: đúng bố cục ticket, có mũi tên chỉ đèn |
| AC2.12 Bảng màu | **Chưa đạt** | Thân Bóng Mực hiện tím sáng (ticket: `#120A1A` gần đen, viền `#7A3CFF`); áo Mây trông tối, khăn đỏ khó thấy |
| AC2.13 FPS ≥ 30 | Đạt (đo ở điều kiện khắt khe hơn) | 54–76 FPS ở 1707×825 (nhiều điểm ảnh hơn 1280×720 khoảng 1,5 lần); chưa đo đúng ở 1280×720 |
| AC2.10 Cài đặt, AC2.11 Âm thanh, menu chính, màn Bình Minh | Đã làm, **chưa có ảnh** | Cần ảnh bảng Cài đặt và màn Bình Minh |

## Nhật ký lỗi của AI

| # | Lỗi | Phát hiện bằng | Xử lý |
|---|---|---|---|
| 1 | 3 kỳ vọng test tính tay lệch một tick hoặc sai kịch bản (hồi chiêu lướt 89 thay vì 90 tick; kịch bản rơi chỉ chạy 3 tick nên chưa ra khỏi đảo; choáng hết ở tick 120 thay vì 121) | Test đỏ ở lần chạy đầu | Đối chiếu ticket: code đúng, kỳ vọng sai. Sửa kỳ vọng và ghi quy ước bộ đếm vào CLAUDE.md và skill `verify-phase`, để lần sau không lặp lại. |
| 2 | Recoil chỉ đi được 59/60 bước, vì bước lùi đầu tiên mới chạy ở tick sau tick đánh | Claude tự phát hiện khi tính kỳ vọng tay cho test | Lùi một bước ngay tick đánh. Test kiểm tra đủ 2 m sau 60 tick. |
| 3 | Bản nháp `step.ts` có một dòng không hợp lệ (`p.vy_set`) và `dropMotes` ghi vị trí hai lần | Claude đọc lại trước khi chạy | Sửa trước khi chạy kiểm tra kiểu |
| 5 | Hai lỗi lệch một tick ở bộ đếm (gió, Gió Lạc bỏ chạy) và lỗi đẩy xuyên vật cản | Review Codex (người review khác người viết) | Test tái hiện rồi sửa. Quy ước bộ đếm đã ghi vào CLAUDE.md. |
| 4 | Ý ban đầu ép độ cao Bóng Mực theo địa hình mỗi tick làm khoảng cách 3D của Tỏa Sáng khó đoán với scenario (đặt ở y = 0 thì bị đổi) | Claude tự phát hiện khi viết test Tỏa Sáng | Giữ nguyên `y` khi sinh hoặc theo scenario (B4) |

## Token và chi phí (ước tính)

| Công cụ | Việc | Token |
|---|---|---|
| Codex | Lô 23 quyết định (session mới) | 14,982 |
| Codex | Review Phase 2 (session mới, ticket và nguồn đưa thẳng vào prompt, khoảng 60 KB) | 30,971 |
| **Codex tổng Phase 2** | | **≈ 46k** (Phase 1: ≈ 347k) |
| Claude Code | Đọc ticket, code, test, kiểm chứng | *điền từ `/cost`* |

**Cách tiết kiệm:**
- Ticket lưu thành file để không phải dán lại vào prompt.
- Câu hỏi gom thành một lô và chạy nền song song với lúc viết code.
- Không dùng trình duyệt tự động.
- Kiểm chứng bằng CLI và test thay vì chạy agent lặp lại.
