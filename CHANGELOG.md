# CHANGELOG

## [phase-4] v1.0.0 — Ticket-04 "Bình minh: phát hành v1.0.0" (Contract v1.3)

### Contract và lệnh
- `contract_version` **1.3**. `game.contract.json` thêm `bench_cmd` (`node scripts/bench.mjs`) và `soak_cmd` (`node --expose-gc --no-opt dist/soak.js`).
- **Thay đổi `run_cmd`:** `npm run preview -- --host 0.0.0.0` thành `node dist/server.js` (máy chủ Node không phụ thuộc thư viện, phục vụ `dist/web` và API bảng xếp hạng). `node dist/server.js --export-leaderboard out.json` xuất `{"entries":[...]}`.
- Đầu ra headless của v1.0–v1.2 **không đổi**: 21/21 file output của các scenario Phase 1–3 giống hệt từng byte giữa phase-3 và phase-4.

### Tính năng
- **Benchmark:** cảnh bench chuẩn (cờ `bench` trong sim chỉ phía render bật) và đo FPS bằng cửa sổ trình duyệt thật 1280×720 qua Playwright.
- **Soak:** 10 Đêm trong một tiến trình, input ngẫu nhiên theo seed.
- **Bảng xếp hạng cục bộ:**
  - Nhập tên sau màn Bình Minh hoặc khi thua; nhận tên tiếng Việt có dấu.
  - Giữ top 10, lưu trên đĩa ở `data/leaderboard.json`. Có màn hình riêng từ menu.
- **Dễ tiếp cận:**
  - Đổi phím cho mọi hành động, báo khi trùng phím, có nút "Khôi phục mặc định".
  - Phụ đề và chỉ báo: Bóng Mực xuất hiện kèm mũi tên ở mép màn hình, gió sắp thổi, 10 giây cuối, đèn dưới 30 dầu.
  - Tùy chọn "Giảm chuyển động" và "Chữ lớn ×1.25". Mọi chữ giao diện từ 18 px trở lên.
- **Phần sáng tạo:** rung camera và chớp đỏ khi bị chạm. Cả hai tắt được bằng "Giảm chuyển động".
- **Đóng gói:** `npm start`, Release v1.0.0 kèm bản build zip.

### Sửa lỗi (review Codex)
- `dist/server.js`: URL có mã hóa phần trăm bị hỏng từng làm sập server. Giờ server trả 400.
- Cảnh bench: Bóng Mực ở gần Mây không còn chuyển sang `chase`; cả 200 con giữ trạng thái `wander` như ticket yêu cầu.

Lý do thiết kế: [docs/adr/0002-release-bench-soak-leaderboard.md](docs/adr/0002-release-bench-soak-leaderboard.md).

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
