# Bằng chứng headless: Phase 1

Sinh tự động bởi `npm run verify -- 1` (không sửa tay). Mỗi scenario chạy qua CLI thật `node dist/headless.js` **hai lần**; hai output phải giống hệt nhau (tất định), sau đó đối chiếu sự kiện kỳ vọng (theo thứ tự) và dòng `end`.

- Commit: `7cbc51a` (working tree có thay đổi chưa commit)
- Máy: Windows_NT 10.0.26300 · 12th Gen Intel(R) Core(TM) i5-12500H · Node v22.17.1
- Thời điểm: 2026-11-20T08:08:29.676Z

| Scenario | Yêu cầu | Exit | Thời gian chạy | Kết quả |
|---|---|---|---|---|
| p1-bad-inputs | Contract: file inputs sai định dạng (tick không tăng nghiêm ngặt) -> mã thoát 2 | 2 | 75 ms | ĐẠT |
| p1-collect-and-light | PRD-0: nhặt đom đóm, nạp vào đèn, thắp đèn, thắng khi thắp hết | 0 | 74 ms | ĐẠT |
| p1-dawn | Giả định A7: hết thời lượng Đêm (bình minh) mà chưa thắp hết đèn thì thua | 0 | 71 ms | ĐẠT |
| p1-default-night | Contract: đêm mặc định theo seed (đom đóm + Bóng Mực ngẫu nhiên); Bóng Mực đuổi và chạm người chơi chạy mù; tất định giữa hai lần chạy | 0 | 78 ms | ĐẠT |
| p1-hit-lose | PRD-0: bị Bóng Mực chạm mất máu; hết máu thì thua | 0 | 70 ms | ĐẠT |
| p1-pulse-stun | PRD-0: tỏa sáng xua Bóng Mực, tốn ánh sáng | 0 | 75 ms | ĐẠT |

Đầu vào và output của mỗi scenario nằm trong thư mục con cùng tên (`scenario.json`, `inputs.json`, `out.jsonl`). Định nghĩa kỳ vọng: `tests/scenarios/*.json`.
