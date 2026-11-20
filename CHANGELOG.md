# CHANGELOG

## [phase-3] Ticket-03 "Đèn cạn dầu" (Contract v1.2)

### Thay đổi phá vỡ tương thích (BREAKING)
- **Luật thắng:** bỏ thắng sớm khi thắp hết đèn và bỏ lý do `all_lit`. Giờ chỉ thắng ở bình minh nếu còn sống và số đèn sáng ≥ `ceil(0.6 × N)` (`reason: "dawn_survived"`). Thua `dawn` khi số đèn sáng dưới ngưỡng.
- **Thời lượng Đêm:** 300/330/360 s đổi thành **240/270/300 s** (`night*_duration_s`).
- **Điểm:**
  - Mỗi đom đóm nạp vào đèn: +10 thành **+5**, áp dụng cho cả thắp mới, thắp lại và châm dầu.
  - Thưởng thời gian bị bỏ (`per_second_left: 0`).
  - Mới: thắp lại +40, Tỏa Sáng trúng Bóng Mực đang `drain` được tổng +15.
  - Lúc bình minh, chỉ khi thắng: mỗi đèn sáng +50 + floor(fuel).
- **Đèn đã sáng:** vẫn nhận đom đóm để châm dầu (sự kiện `refuel`).
- **Vùng an toàn:** đèn có `fuel < 30` mất vùng an toàn.
- **Bóng Mực `wander`:** không còn đứng yên. Nó đi tới đèn yếu gần nhất, nếu không có thì tới đèn tắt gần nhất.
- **Sức chứa:** 10 cố định đổi thành `10 + 2 × successful_lights`, tối đa 20.
- **Snapshot:**
  - `lanterns[]` thêm `fuel` (1 chữ số thập phân), `ever_lit`, `relit_count`.
  - `player` thêm `capacity`.
  - Bóng Mực có thêm trạng thái `drain`.
- **Sự kiện:**
  - `lantern_lit` thêm `relight`.
  - Mới: `refuel`, `lantern_out`, `fuel_drain`.
- **Scenario:**
  - `lanterns[]` thêm `lit`, `fuel`, `ever_lit`. Đèn `lit: true` mặc định có `fuel` 100 và `deposited` bằng chi phí thắp.
  - `player.successful_lights`.
  - `shades[].target_lantern_id`.
- **Tuning:** thêm `fuel_max`, `fuel_decay_per_s`, `fuel_per_mote`, `relight_cost`, `win_ratio`, `drain_per_s`, `low_fuel_threshold`, `capacity_max`.

### Bản chơi
- Đèn có thanh dầu, nhấp nháy 1 Hz khi dầu dưới 30. Đèn tắt bị xẹp 20% và có vết rách.
- Cài đặt mới "Bảng màu dễ phân biệt", được lưu lại: viền và mắt Bóng Mực đổi từ `#7A3CFF` sang `#00B3FF`; cảnh báo UI đổi sang màu trắng kèm ⚠.
- HUD: đang mang / sức chứa, số đèn sáng kèm số đèn cần để thắng, nhắc "Châm dầu".
- Sửa bảng màu còn nợ từ Phase 2: thân Bóng Mực gần đen `#120A1A` có viền và mắt riêng; áo Mây và khăn đỏ dễ thấy hơn.

Lý do thiết kế: [docs/adr/0001-lantern-fuel-and-dawn-win.md](docs/adr/0001-lantern-fuel-and-dawn-win.md).

## [phase-2] Ticket-02 "Ba hòn đảo" (Contract v1.1)
- Số chuẩn thay toàn bộ số tự chọn của Phase 1. Thêm 3 bản đồ, lướt, rơi khỏi đảo, Gió Lạc, Bùa Gió, tạm dừng, menu, cài đặt, âm thanh và HUD đầy đủ. Chi tiết: [docs/notes/phase-2.md](docs/notes/phase-2.md).

## [phase-1] PRD-0 (Contract v1.0)
- Bản chơi Đêm 1 và chế độ headless đầu tiên.
