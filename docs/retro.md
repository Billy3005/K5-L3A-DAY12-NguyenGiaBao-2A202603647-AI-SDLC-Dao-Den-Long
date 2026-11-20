# Retro: Đảo Đèn Lồng (Day 12 AI SDLC)

Nguyễn Gia Bảo, 2A202603647 · làm cá nhân. Phân vai: Claude Code viết code chính; Codex CLI đại diện tôi để chốt quyết định, duyệt và review.

## 1. Đánh giá tổng hợp 4 phase

| Phase | Nội dung | Kết quả | Còn thiếu / ghi chú |
|---|---|---|---|
| 1 (PRD-0, v1.0) | Đêm 1 chơi được và headless có tất định | Đạt. 6 scenario chạy qua CLI thật | Review Codex tìm 3 lỗi thật: `random_*=false` vẫn sinh entity mặc định, choáng ngắn 1 tick, vùng an toàn chồng nhau. Đã sửa |
| 2 (Ticket-02, v1.1) | 3 Đêm, lướt, rơi, Gió Lạc, Bùa Gió, tạm dừng, menu, âm thanh, thứ tự 12 bước | Đạt. 16 scenario | Bảng màu Bóng Mực và áo Mây chưa đúng, đã sửa ở Phase 3 |
| 3 (Ticket-03, v1.2) | Dầu đèn, hút dầu, thắng lúc bình minh, sức chứa, điểm mới, chế độ mù màu | Đạt. 22 scenario. 6 test cũ được sửa kèm lý do, không skip | Nhấp nháy 1 Hz không bắt được bằng ảnh tĩnh, phải dùng video |
| 4 (Ticket-04, v1.3) | Bench, soak, bảng xếp hạng, dễ tiếp cận, phát hành | Đạt khi tự đo: 157 FPS, 1% low 49,7, soak 1,11×. Headless giống hệt từng byte so với phase-3 | Soak cần `--no-opt` (lý do trong ADR 0002). `peak_mem_mb` null vì là bản web |

Mỗi phase đều được gắn tag đúng giờ, và CI xanh trên Ubuntu lẫn macOS.

## 2. Điều gì hiệu quả khi làm với AI

- **Sim thuần cộng headless ngay từ ngày đầu.** Mọi luật được test bằng vitest và chạy qua CLI thật. Nhờ vậy ba lần đổi ticket (đổi số, đổi luật thắng, thêm bench) đều sửa nhanh mà không vỡ phần cũ. Ở Phase 4 tôi chứng minh được "đầu ra headless không đổi" bằng cách so từng byte 21 file.
- **Gom quyết định thành một lô gửi Codex** (B*, R1–R13, D1–D15). Mỗi phase chỉ tốn một lần gọi, khoảng 15–23k token. Codex đổi khoảng 1/3 đề xuất, và lần nào lý do cũng xác đáng: rải đều Bóng Mực, `vsync_off` phải dựa trên số đo, cảnh báo dầu thấp chỉ báo khi vừa vượt ngưỡng.
- **Một review Codex mỗi phase, ở session mới, với nguồn đưa thẳng vào prompt.** Ba review đầu đều tìm ra lỗi thật mà test của tôi bỏ sót: chệch 1 tick, đẩy xuyên địa hình, khoảng cách đúng 6 m. Tôi luôn viết test tái hiện chạy đỏ trước rồi mới sửa.
- **Ảnh bằng chứng tự động bằng Playwright.** Ở Phase 3, một chú thích viết trước không khớp với ảnh, và nhờ vậy lộ ra lỗi render (cột đèn vẽ theo vị trí bản đồ thay vì vị trí trong sim). Từ đó có quy tắc: chỉ viết chú thích sau khi mở ảnh.
- **Đo trước, sửa sau.** Ở Phase 4, `p1_low` thấp và RSS soak tăng đều được truy tới nguyên nhân bằng probe rồi mới sửa. Tôi không dò cờ hay sửa số cho đẹp.

## 3. Điều không hiệu quả

- **Resume session Codex dài:** khoảng 145k token mỗi lần gọi, vì phần lớn là lịch sử bị nạp lại. Phase 1 tốn khoảng 347k token Codex chủ yếu vì lý do này. Từ Phase 2 tôi chỉ mở session mới với prompt gọn, nên mỗi phase còn khoảng 45k.
- **Sandbox chỉ-đọc của Codex trên Windows không chạy được shell.** Lần review đầu mất khoảng 30k token mà không ra kết quả. Cách khắc phục: đưa thẳng nguồn hoặc diff vào prompt.
- **Gửi review thiếu ngữ cảnh.** Diff Phase 4 không có `index.html`, nên 2/5 mục Codex báo là sai.
- **Môi trường shell:** hook `rtk` phân tích sai heredoc có backtick; cwd ổ đĩa chữ thường (`c:\`) làm vitest báo lỗi giả; file CRLF làm script sửa file trượt. Mỗi lỗi tốn vài lượt gọi tool.

## 4. Những lần AI sai và cách phát hiện

| Lỗi | Phát hiện bằng |
|---|---|
| Kỳ vọng tính tay lệch 1 tick (hồi chiêu lướt, kết thúc choáng, độ lùi) | Test đỏ, đối chiếu quy ước bộ đếm |
| Code: choáng ngắn 1 tick, cơn gió áp dụng 299 lần, Gió Lạc bỏ chạy 239 tick | Review Codex rồi viết test tái hiện |
| Bóng Mực bị đẩy xuyên địa hình; trường hợp đúng 6 m bị bỏ sót | Review Codex |
| Đèn đặt bằng scenario thiếu `deposited` | Review Codex (HIGH) |
| Render bỏ qua vị trí đèn của sim | Ảnh Playwright không khớp chú thích |
| Stop hook báo đỏ giả | Tái hiện được: `c:/` lỗi, `C:/` chạy được |
| HUD ghi DOM mỗi khung hình làm FPS giật | Bench thử 5 s |
| Server sập khi URL mã hóa hỏng; Bóng Mực bench chuyển sang chase | Review Codex Phase 4 |

## 5. Harness nào giúp nhiều nhất

1. **Skill `verify-phase` cùng `scripts/verify.mjs`:** chạy mọi scenario qua CLI thật, mỗi cái hai lần, rồi ghi bằng chứng. Đây là lưới an toàn chống hồi quy qua cả 4 phase.
2. **Stop hook** (`scripts/stop-gate.mjs`): không cho agent báo "xong" khi test còn đỏ.
3. **CLAUDE.md:** quy tắc kiến trúc (sim không được import three/DOM/Math.random) và "Phase Flow" có giới hạn thời gian, gồm một lô quyết định và một review mỗi phase.
4. **CI** chạy trên Ubuntu và macOS; **test buộc `game.contract.json` khớp `TUNING`**.

## 6. Token và chi phí (ước tính)

| Công cụ | P1 | P2 | P3 | P4 | Tổng |
|---|---|---|---|---|---|
| Codex (đo từ CLI) | ~347k | ~46k | ~43k | ~43k | **~479k** |
| Claude Code | *điền từ `/cost`* | | | | |

Cách tiết kiệm token:
- Không resume session dài; mỗi lần gọi Codex là một session mới.
- Gom câu hỏi thành lô.
- Đưa đúng diff hoặc nguồn cần review, không bắt Codex tự đi khám phá repo.
- Chỉ đọc những phần file cần thiết.
- Dùng `rtk` để rút gọn output của lệnh.

## 7. Nếu làm lại

- Ngay từ Phase 1: chỉ dùng Codex qua session mới với prompt gọn. Riêng việc này tiết kiệm khoảng 300k token.
- Dựng `shots.mjs` (Playwright) từ Phase 1 thay vì Phase 3, để bắt lỗi render sớm hơn.
- Dựng sẵn công cụ sửa file nhận được CRLF và quy ước "không dùng heredoc có backtick" từ đầu.
- Gửi review luôn kèm mọi file đã đổi, kể cả HTML/CSS.
- Đo hiệu năng sớm (một bench nhỏ ở Phase 2), không đợi tới Phase 4.
