# Ảnh chụp: Phase 3 (tự động bằng Playwright)

Tạo bằng `npm run build && npm run shots -- 3` ([scripts/shots.mjs](../../../../scripts/shots.mjs)):
- Script chạy bản build qua `vite preview` và điều khiển bằng Playwright (Chromium headless, 1280×720).
- Các trạng thái đặc biệt được dựng bằng `window.ddl.load(night, scenario)`. Hook này dùng đúng `createWorld` của sim với scenario theo contract.
- Ảnh không sửa tay. Mã ở commit sau tag `phase-3`; nội dung ảnh 03/04 cần bản sửa vị trí đèn đi kèm.

| Ảnh | Thấy gì | Yêu cầu |
|---|---|---|
| [01-menu.png](01-menu.png) | Menu chính | Ticket-02: chuỗi 3 Đêm |
| [02-settings.png](02-settings.png) | Cài đặt: âm lượng, độ nhạy chuột, ô "Bảng màu dễ phân biệt" | Ticket-03 §6 (cài đặt được lưu) |
| [03-fuel-states.png](03-fuel-states.png) | Phải sang trái: L1 thanh dầu đầy (100); L2 thanh dầu khoảng một nửa (55); L3 dầu 22 (< 30): mờ, không vùng an toàn, Bóng Mực S1 đứng sát hút dầu; L4 tắt (`ever_lit`), cầu đèn bị xẹp. HUD: 7/14 (sức chứa 10 + 2×2), "3/5 (cần 3)", đồng hồ đỏ khi ≤ 30 s | §1 thanh dầu, §2, §4, HUD |
| [04-low-fuel-blink.png](04-low-fuel-blink.png) | Chụp sau ảnh 03 khoảng 0,5 s. Bóng Mực S2 (`wander`) đã đi về phía đèn yếu L3 | §2 Bóng Mực wander tìm đèn yếu |
| [05-colorblind.png](05-colorblind.png) | Bật chế độ mù màu: viền Bóng Mực xanh `#00B3FF`; đồng hồ cảnh báo chuyển trắng kèm ⚠ | §6 |
| [06-binh-minh.png](06-binh-minh.png) | Sống tới bình minh Đêm 3 với 5/7 đèn → màn Bình Minh, tổng 695 = 5 × (50 + 59) + 3 × 50 (khớp luật điểm mới) | §3, §5, Ticket-02 màn Bình Minh |
| [07-night2-map.png](07-night2-map.png) | Đêm 2: hai đảo, cầu tre, bục nhảy; HUD "0/6 (cần 4)" | Ticket-02 bản đồ chuẩn |
| [08-night3-map.png](08-night3-map.png) | Đêm 3: vách tầng 1, dốc, tầng 2 và tháp chuông; HUD "0/7 (cần 5)" | Ticket-02 bản đồ chuẩn |

**Bảng màu còn nợ từ Phase 2:** ảnh 03–05 cho thấy đã sửa. Thân Bóng Mực gần đen `#120A1A` có viền và mắt riêng; áo Mây màu kem, khăn đỏ dễ thấy.

**Chưa chứng minh được bằng ảnh:**
- Nhịp nhấp nháy 1 Hz của đèn dầu thấp: cả ảnh 03 và 04 đều rơi vào pha "tắt" của L3. Cần quay clip.
- Vết rách trên đèn tắt: khó thấy ở khoảng cách này.

**FPS** ghi trên ảnh (7–17) là Chromium headless **vẽ bằng phần mềm** (SwiftShader, không có GPU), **không** dùng làm bằng chứng hiệu năng. Số đo FPS trên máy thật nằm ở [phase-2/screenshots.md](../../phase-2/screenshots.md).
