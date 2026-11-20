# Ảnh chụp: Phase 4 (tự động bằng Playwright)

**Cách tạo:** `npm run build && npm run shots -- 4` ([scripts/shots.mjs](../../../../scripts/shots.mjs)).
- Game chạy qua `dist/server.js` (đúng `run_cmd`), nên bảng xếp hạng dùng API và file thật. File đó nằm ở [../leaderboard.json](../leaderboard.json), còn bản xuất bằng tiến trình khác là [../leaderboard-export.json](../leaderboard-export.json).
- Các tình huống được dựng bằng `window.ddl.load(night, scenario)`, dùng cùng `createWorld` với headless. `window.ddl.step(n)` cho sim chạy nhanh n tick, đi qua đúng đường xử lý sự kiện và phụ đề như khi chơi.
- Ảnh không sửa tay. Mọi chú thích dưới đây viết **sau khi** đã mở xem ảnh.

| Ảnh | Thấy gì | Yêu cầu |
|---|---|---|
| [01-settings-a11y.png](01-settings-a11y.png) | Màn Cài đặt có thêm "Giảm chuyển động (tắt rung camera, chớp màn hình)", "Chữ lớn (×1.25)" và nút "Đổi phím" | §4 |
| [02-keys-duplicate.png](02-keys-duplicate.png) | Bảng đổi phím cho 9 hành động. Thử gán Nhảy = F thì bị từ chối, kèm dòng "Phím F đang dùng cho "Tỏa sáng". Chọn phím khác." | §4 phát hiện trùng phím |
| [03-keys-rebound.png](03-keys-rebound.png) | Gán Nhảy = J thành công | §4 đổi phím |
| [04-keys-reset.png](04-keys-reset.png) | Sau khi bấm "Khôi phục mặc định", Nhảy trở lại Space | §4 |
| [05-captions-shade-arrow.png](05-captions-shade-arrow.png) | Ba dòng phụ đề: "Bóng Mực xuất hiện!", "10 giây cuối!", "Đèn L1 sắp cạn dầu (< 30)". Mũi tên tím ở mép phải chỉ về Bóng Mực vừa sinh. Đồng hồ 00:09 | §4 phụ đề / chỉ báo |
| [06-caption-wind.png](06-caption-wind.png) | Đêm 3, sim chạy nhanh tới 2 s trước cơn gió đầu tiên: phụ đề "Gió sắp thổi!". Dòng thông tin góc trái vẫn ghi "Đêm 1" vì nó chỉ làm mới mỗi giây; HUD hiện 0/7 (cần 5), đúng Đêm 3 | §4 |
| [07-big-text.png](07-big-text.png) | Bật Chữ lớn: chữ HUD và ô hồi chiêu to hơn (gốc 22,5 px) | §4 cỡ chữ |
| [08-hit-flash.png](08-hit-flash.png) | Bóng Mực chạm Mây (còn 2 Ngọn Lửa), cả màn hình phủ lớp đỏ | §4 / phần sáng tạo |
| [09-hit-reduced-motion.png](09-hit-reduced-motion.png) | Cùng tình huống nhưng bật Giảm chuyển động: không có lớp đỏ. Riêng rung camera thì ảnh tĩnh không chứng minh được (xem video demo) | §4 giảm chuyển động |
| [10-name-invalid.png](10-name-invalid.png) | Thua Đêm 1 thì hiện form "Lưu điểm 0 (0 Đêm thắng)". Tên "ab" bị từ chối, kèm lời nhắc 3–12 ký tự | §3 |
| [11-leaderboard-saved.png](11-leaderboard-saved.png) | Lưu "Nguyễn_Bảo" (tiếng Việt có dấu) xong thì chuyển sang Bảng xếp hạng, dòng mới tô vàng | §3 |
| [12-leaderboard-menu.png](12-leaderboard-menu.png) | Tải lại trang, vào Menu → Bảng xếp hạng: Zed 1200 › Bao_01 450 › Mây 450 › Nguyễn_Bảo 0. Bao_01 và Mây bằng điểm, Bao_01 lưu trước nên đứng trên | §3 sắp xếp, lưu bền |

**FPS** ghi trong ảnh là Chromium headless vẽ bằng phần mềm (SwiftShader), **không** phải bằng chứng hiệu năng. Số hiệu năng nằm ở [bench.json](../../../../bench.json), đo bằng cửa sổ thật có GPU.
