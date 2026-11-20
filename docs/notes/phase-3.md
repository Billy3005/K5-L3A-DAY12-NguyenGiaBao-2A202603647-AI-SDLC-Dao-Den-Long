# Phase 3: Ticket-03 "Đèn cạn dầu" (Change Request, Contract v1.2)

## Quy trình (30 phút)

1. Lưu nguyên văn ticket vào [docs/tickets/ticket-03.md](../tickets/ticket-03.md).
2. Gửi Codex **lô 13 quyết định (R1–R13)** chạy nền, khoảng 22k token. Claude viết code song song theo đề xuất mặc định. Codex đổi 2 mục:
   - **R2:** `target_lantern_id` chỉ là mục tiêu ban đầu.
   - **R9:** đẩy khỏi vùng an toàn đúng 30 tick.
3. Ghi quyết định thiết kế vào [ADR 0001](../adr/0001-lantern-fuel-and-dawn-win.md) và thay đổi phá vỡ tương thích vào [CHANGELOG.md](../../CHANGELOG.md).
4. Test: 60 test. Scenario: 22/22 qua CLI thật, mỗi scenario chạy 2 lần (6 Phase 1 + 10 Phase 2 + 6 Phase 3).
5. Review Codex (session mới, nguồn đưa thẳng vào prompt), khoảng 21k token, báo 2 mục. Cả hai được sửa, có test tái hiện đỏ trước và xanh sau:
   - **HIGH:** đèn scenario `lit: true` phải có `deposited` bằng chi phí thắp.
   - **MED:** Bóng Mực cách đèn đúng 6 m cũng phải bị đẩy ra, vì "trong bán kính r" nghĩa là ≤ r.

## Test cũ bị luật mới làm sai (cập nhật, không skip)

| Test / scenario | Thay đổi | Lý do (Ticket-03) |
|---|---|---|
| `rules.test` "win bonus … all_lit" | **Xóa**, thay bằng `fuel.test` › dawn win rule | §3 bỏ thắng sớm, §5 bỏ thưởng thời gian |
| `rules.test` deposit score 200 | Đổi thành 150, kèm `relight: false`, `fuel: 100`, `capacity: 12` | §5: +5 mỗi đom đóm; §7 thêm trường mới |
| `rules.test` "wander stays put" | Đổi thành "wander đi tới đèn tắt gần nhất" | §2 "đi về đèn tắt gần nhất" |
| `rules.test` pause `time_left 299.5` | Đổi thành 239.5 | §3: Đêm 1 dài 240 s |
| `contract.test` v1.1, thời lượng 300/330/360 | Đổi thành v1.2 và 240/270/300, thêm kiểm tra `capacity`, `fuel`, `ever_lit`, `relit_count` | §7 |
| `p1-collect-and-light` (kỳ vọng thắng `all_lit` ở tick 52) | Kỳ vọng `lantern_lit relight:false`, **không** có `game_over`, kết thúc `playing`, điểm 150 | §3, §5 |

Mọi scenario và test Phase 1–2 còn lại vẫn đạt mà không phải sửa.

## Đánh giá Phase 3

| Yêu cầu | Kết quả | Bằng chứng |
|---|---|---|
| §1 Dầu, châm dầu, hết dầu, thắp lại | Đạt | `fuel.test` (fuel), `p3-refuel`, `p3-out-relight` |
| §2 Hút dầu, mất vùng an toàn, bị đẩy khi dầu ≥ 30 | Đạt | `fuel.test` (drain), `p3-drain` |
| §3 Luật thắng lúc bình minh | Đạt | `fuel.test` (dawn), `p3-dawn-win`, `p3-dawn-lose` |
| §4 Sức chứa tăng dần | Đạt | `fuel.test` (capacity), `p3-capacity` |
| §5 Điểm mới | Đạt | Kiểm tra điểm trong các test và scenario trên |
| §6 Chế độ mù màu, §1 thanh dầu, đèn tắt bị xẹp | Đạt (ảnh bổ sung sau khi gắn tag) | [screens/README.md](../proof/phase-3/screens/README.md), ảnh 02, 03, 05 |
| §1 Nhấp nháy 1 Hz khi dầu < 30 | Đã làm, **chưa chứng minh bằng ảnh** | Cả hai ảnh 03 và 04 đều rơi vào pha "tắt"; cần quay clip |
| §7 Contract v1.2 | Đạt | `contract.test`, [docs/proof/phase-3/summary.md](../proof/phase-3/summary.md) |
| Nợ Phase 2: bảng màu Bóng Mực và áo Mây | **Đã sửa** (đóng mục "chưa đạt" của Phase 2) | Ảnh 03–05 |

Lỗi tìm thấy khi chụp: bản render vẽ cột đèn theo vị trí mặc định của bản đồ, không theo `w.lanterns[].pos`. Lỗi chỉ lộ ra khi scenario dời đèn, nên ảnh 03 bản đầu không khớp chú thích. Đã sửa để render đi theo sim, rồi chụp lại.

## Nhật ký lỗi của AI

| # | Lỗi | Phát hiện | Xử lý |
|---|---|---|---|
| 1 | Test hút dầu đặt Bóng Mực ngay biên 2 m; cộng dồn số thực làm khoảng cách thành 2,0000000x nên vào `drain` trễ 1 tick | Test đỏ | Dời kịch bản 0,1 m để tránh biên. Bài học: không đặt kịch bản đúng ngưỡng so sánh. |
| 2 | Đèn đặt sẵn bằng scenario và trường hợp đúng 6 m bị bỏ sót | Review Codex | Thêm test tái hiện rồi sửa |
| 3 | Heredoc bash chứa template literal bị hook `rtk` phân tích sai, nên lần chỉnh giao diện đầu không được áp dụng | Lỗi shell (không có file nào bị sửa) | Chuyển script chỉnh sửa ra file trong scratchpad. Từ giờ không dùng heredoc dài khi trong đó có backtick. |

## Token (ước tính)

Số Claude Code đếm từ transcript của session (`usage` của từng phản hồi, model claude-opus-5-5, chia theo giờ gắn tag phase). "Đọc cache" là ngữ cảnh đọc lại từ prompt cache, rẻ hơn khoảng 10 lần so với token mới.

| Công cụ | Việc | Token |
|---|---|---|
| Codex | Lô R1–R13 (session mới) | 21,610 |
| Codex | Review Phase 3 | 21,392 |
| Claude Code | Đọc ticket, code, test, tài liệu | ≈ 209k mới (output 80k + ghi cache 130k) · đọc cache 18.4M · 43 lượt model |
