# Phase 4: Ticket-04 "Bình minh: phát hành v1.0.0" (Contract v1.3)

## Quy trình

1. Lưu nguyên văn ticket vào [docs/tickets/ticket-04.md](../tickets/ticket-04.md).
2. Gửi Codex **lô 15 quyết định D1–D15** (session mới, chạy nền, 22.974 token). Codex đồng ý 9 mục và đổi 6 (D1, D6, D9, D11, D12, D14). Tôi nhận cả 6. Chi tiết trong [ADR 0002](../adr/0002-release-bench-soak-leaderboard.md).
3. Viết test trước cho phần thuần: cảnh bench, `frameStats` theo đúng công thức ticket, camera, soak, luật bảng xếp hạng, xuất bảng xếp hạng. Sau đó mới tới render, server và các script.
4. Đo thật:
   - `bench.json`: 30 s, cửa sổ Chrome có GPU.
   - `soak.json`: 10 Đêm.
   - `npm run verify -- 4`: chạy lại 22 scenario Phase 1–3.
   - `npm run shots -- 4`: 12 ảnh, đã mở xem từng ảnh.
5. Review Codex (session mới, đưa thẳng diff vào prompt, 20.427 token): 5 mục. 2 mục đúng và đã sửa; mỗi mục có test tái hiện, chạy **đỏ trước, xanh sau**. 3 mục sai, có giải thích bên dưới.
6. Test: 74 test. Scenario: 22/22. Headless: **21/21 file output giống hệt từng byte** so với phase-3.

## Kết quả đo (tự đo, chỉ để tham khảo; máy chấm sẽ đo lại)

Máy: laptop i5-12500H, iGPU Intel UHD (ANGLE D3D11), 8 GB RAM, Windows 11, Chrome 157.

| Chỉ số | Kết quả | Ngưỡng | |
|---|---|---|---|
| `avg_fps` | 157,3 | ≥ 60 | Đạt |
| `p1_low_fps` | 49,7 | ≥ 30 | Đạt |
| `frame_ms_p95` | 12,2 ms | | |
| `load_ms` | 2127 | ≤ 10000 | Đạt |
| `frames` | 4719 trong 30 s | | |
| `vsync_off` | true (đo được 157 > 65) | | |
| `peak_mem_mb` | null (bản web; xem `mem_note`) | | |
| Soak `crashes` | 0 | = 0 | Đạt |
| Soak RSS | 32,9 → 36,5 MB (1,11×) | ≤ 1,2× | Đạt với `--no-opt` |

Lần bench thử 5 s đầu tiên cho `p1_low_fps` = 24,9. Nguyên nhân là mỗi khung hình đều ghi `innerHTML` cho HUD, gây layout và GC giật. Tôi đổi sang chỉ ghi DOM khi nội dung thay đổi. Lần đo 30 s sau đó đạt 50,9, rồi 49,7 sau khi sửa lỗi Bóng Mực `chase`.

### Vì sao soak dùng `--no-opt`

Chạy không có cờ thì RSS từ 32,9 lên 49 MB (1,5×) và trượt ngưỡng. Tôi điều tra trước khi đổi bất cứ thứ gì:

| Probe | Kết quả |
|---|---|
| `heapUsed` trước và sau 10 Đêm | 4,1 → 4,5 MB (JS heap không tăng) |
| RSS sau 10 Đêm và sau 30 Đêm | 45–49 MB và 44–48 MB (đi ngang, không tăng theo số Đêm) |
| RSS theo từng Đêm | Nhảy 31,5 → 42 MB trong Đêm đầu, sau đó dao động 41–46 MB |
| `--max-semi-space-size=1`, `--max-old-space-size=64` | Vẫn 1,36–1,53× |
| `--no-opt` (tắt TurboFan) / `--jitless` | 1,11× / 1,12× |

Kết luận: phần tăng là bộ nhớ của trình biên dịch tối ưu V8, chỉ xảy ra một lần chứ không phải rò rỉ. Kết quả các Đêm giữ nguyên khi đổi cờ, vì sim tất định. Cái giá là soak chạy 0,3 s thay vì 0,2 s. Tôi ghi rõ điều này trong README, ADR và `soak_cmd`, để người chấm thấy được lựa chọn này.

## Review Codex

| Mục | Kết luận | Xử lý |
|---|---|---|
| HIGH `decodeURIComponent` ném lỗi làm sập server | **Đúng** | Test `staticPath('/%E0%A4%A')` đỏ trước. Sửa thành trả 400 |
| MED Bóng Mực bench chuyển sang `chase` khi gần Mây | **Đúng**: 45/200 con ở trạng thái chase | Test "mọi Bóng Mực vẫn wander" đỏ trước. Thêm `!w.bench` vào điều kiện chase |
| HIGH thiếu `#hCap`, `#hShade` | Sai: các phần tử này nằm trong `index.html`, file không có trong diff gửi review | Ảnh 05 cho thấy chúng hoạt động |
| MED `.big` không có CSS | Sai: CSS nằm trong `index.html` (`html.big { font-size: 22.5px }`) | Ảnh 07 |
| MED Ghi file tạm `.tmp` bị tranh chấp | Sai: từ đọc đến ghi là chuỗi lệnh fs đồng bộ trong cùng một callback, Node đơn luồng nên hai request không xen vào nhau | Không đổi |

Bài học: bản diff gửi review phải gồm cả `index.html`. 2/5 báo sai là do thiếu ngữ cảnh.

## Đánh giá Phase 4

| Yêu cầu | Kết quả | Bằng chứng |
|---|---|---|
| §1 Benchmark | Đạt (tự đo) | [bench.json](../../bench.json), `release.test`, AC4.1–4.3 |
| §2 Soak | Đạt, với `--no-opt` (lý do ở trên) | [soak.json](../../soak.json), AC4.4 |
| §3 Bảng xếp hạng (có cả tiếng Việt có dấu) | Đạt | Ảnh 10–12, [leaderboard-export.json](../proof/phase-4/leaderboard-export.json), AC4.5–4.6 |
| §4 Đổi phím, phụ đề, giảm chuyển động, cỡ chữ | Đạt. Riêng rung camera không chứng minh được bằng ảnh tĩnh | Ảnh 01–09 |
| §5 README, CHANGELOG 4 phase, CREDITS, LICENSE, Release | Đạt. Release đăng sau khi được duyệt push | README, [CHANGELOG](../../CHANGELOG.md) |
| §6 Contract v1.3 | Đạt | `contract.test`, [summary.md](../proof/phase-4/summary.md) |
| §7 Retro | Đạt | [docs/retro.md](../retro.md) |
| §7 Video demo .mp4 | **Chờ quay**: cần quay màn hình cảnh chơi thật, AI không tự làm được | Gắn vào Release v1.0.0 |
| Nợ Phase 3: nhấp nháy 1 Hz | Chứng minh bằng video demo | |

## Nhật ký lỗi của AI

| # | Lỗi | Phát hiện | Xử lý |
|---|---|---|---|
| 1 | Script sửa file giả định xuống dòng LF, nhưng `world.ts` dùng CRLF, nên lần sửa thứ hai trượt (lần đầu đã áp dụng) | Script báo "miss" | Viết công cụ thay thế tự nhận CRLF, có báo lỗi rõ ràng |
| 2 | HUD ghi `innerHTML` mỗi khung hình, làm `p1_low` chỉ còn 24,9 | Bench thử 5 s | Chỉ ghi khi nội dung đổi |
| 3 | Bóng Mực trong bench chuyển sang chase | Review Codex | Test đỏ rồi sửa |
| 4 | Server sập khi URL mã hóa hỏng | Review Codex | Test đỏ rồi sửa |
| 5 | Ảnh 06 bản đầu tối đen vì Mây xuất phát trong tháp chuông Đêm 3 | Mở xem ảnh | Đặt Mây ra ngoài tháp rồi chụp lại |
| 6 | Cột "Lúc" lẫn giờ UTC và giờ địa phương | Mở xem ảnh 12 | Hiển thị theo giờ địa phương |

## Token (ước tính)

| Công cụ | Việc | Token |
|---|---|---|
| Codex | Lô D1–D15 (session mới) | 22.974 |
| Codex | Review Phase 4 | 20.427 |
| Claude Code | Đọc ticket, code, test, đo, tài liệu | *điền từ `/cost`* |
