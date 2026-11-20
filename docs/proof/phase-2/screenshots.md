# Ảnh chụp: Phase 2

Người dùng chụp từ bản chơi `npm run dev`, mã ở tag `phase-2`, lúc 15:41–16:02 ngày 2026-11-20. Cửa sổ trình duyệt 1707×825 (FPS hiển thị ở góc dưới trái). Ảnh được commit sau khi gắn tag.

| Ảnh | Chứng minh | Kết quả |
|---|---|---|
| [01-night1-hud-fps.png](01-night1-hud-fps.png) | AC2.12 HUD đúng bố cục ticket: lửa trên trái, đồng hồ mm:ss trên giữa, đèn 3/5 và điểm 630 trên phải, thanh 10 ô đom đóm dưới giữa, ô hồi chiêu Lướt/Tỏa dưới phải, mũi tên chỉ đèn ngoài màn hình; một đèn đã thắp. **76 FPS** | Đạt |
| [02-night1-won.png](02-night1-won.png) | AC2.9: kết quả Đêm 1 → "Đêm kế tiếp". Điểm 1268 khớp luật: 50 đom đóm nạp × 10 + 5 đèn × 100 + 84 giây × 2 + 2 lửa × 50 | Đạt |
| [03-night2-intro.png](03-night2-intro.png) | AC2.9: giới thiệu Đêm 2 "Đảo Cau", lời Ông Đăng, 6 đèn trong 5,5 phút. 54 FPS | Đạt |
| [04-night2-won.png](04-night2-won.png) | AC2.9: thắng Đêm 2 với 1370 điểm (60 × 10 + 6 × 100 + 60 giây × 2 + 1 lửa × 50); tổng 2638 = tổng các Đêm đã thắng | Đạt |
| [05-night3-intro.png](05-night3-intro.png) | AC2.9: giới thiệu Đêm 3 "Đảo Chuông", 7 đèn trong 6 phút. 63 FPS | Đạt |
| [06-pause-menu.png](06-pause-menu.png) | AC2.8: menu Tạm dừng có Tiếp tục / Chơi lại Đêm / Cài đặt / Về menu; đồng hồ đứng ở 04:58 | Đạt |

**FPS (AC2.13):** đo được 54–76 FPS ở 1707×825. Độ phân giải này có nhiều điểm ảnh hơn 1280×720 khoảng 1,5 lần, nên đây là điều kiện khắt khe hơn yêu cầu. Chưa đo đúng ở 1280×720.

**Chưa có ảnh:** menu chính, bảng Cài đặt (thanh âm lượng, độ nhạy), màn Bình Minh sau Đêm 3, gameplay Đêm 2/3 (cầu, bục nhảy, tầng, Gió Lạc, Bùa Gió). Logic của các phần này đã kiểm chứng headless.

**Lệch bảng màu thấy trong ảnh (chưa đạt AC2.12):**
- Thân Bóng Mực hiện màu tím sáng, trong khi ticket yêu cầu thân `#120A1A` gần đen với viền `#7A3CFF`. Nguyên nhân: độ phát sáng của vật liệu quá mạnh.
- Áo Mây trông xám xanh, không phải kem `#E8E2D0`, và khăn đỏ khó thấy do cảnh tối.

Sẽ sửa ở phase sau.
