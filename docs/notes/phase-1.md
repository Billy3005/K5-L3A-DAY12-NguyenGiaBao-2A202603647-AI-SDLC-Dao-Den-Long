# Phase 1: PRD-0 + Test Contract v1.0

## Quy trình đã chạy

1. Đọc PRD-0 và Test Contract. Tách phần bắt buộc chính xác (contract) khỏi phần mơ hồ (luật chơi, số liệu).
2. **Một lượt duyệt quyết định theo lô với Codex** (đại diện người dùng): Claude đề xuất 9 quyết định D1–D9 kèm giá trị mặc định, Codex trả lời OK hoặc CHANGE.
   - Codex đổi 3 mục: D2 (`run_cmd` thêm `--host 0.0.0.0`), D4 (`random_*: false` phải tắt cả sinh định kỳ), D7 (giữ tài liệu lab, chỉ thay README; README gốc được giữ thành `LAB-README.md`).
3. Ghi luật và giả định vào [SPEC.md](../../SPEC.md) (A1–A13) kèm tiêu chí nghiệm thu AC1–AC8.
4. Viết lõi mô phỏng thuần (`src/sim`) cùng test luật, CLI headless, client Three.js.
5. Tự kiểm chứng: `npm test` (28 test), `npm run verify -- 1` (6 scenario qua CLI thật, mỗi cái chạy 2 lần để so tính tất định).
6. **Review độc lập bằng Codex** (session mới, chỉ gửi đoạn contract và mã nguồn) → sửa 4 lỗi, giữ 1 mục thành giả định A12.

## Đánh giá Phase 1

| Tiêu chí | Kết quả | Bằng chứng |
|---|---|---|
| AC1 Nhặt đom đóm | Đạt | `tests/rules.test.ts`, `p1-collect-and-light` |
| AC2 Nạp đèn, thắp đèn | Đạt | rules test, `p1-collect-and-light` |
| AC3 Tỏa sáng xua Bóng Mực | Đạt | rules test, `p1-pulse-stun` |
| AC4 Bị chạm mất lửa, hết lửa thua | Đạt | rules test, `p1-hit-lose` |
| AC5 Thắng `all_lit`, thua `dawn` | Đạt | rules test, `p1-collect-and-light`, `p1-dawn` |
| AC6 Tất định, exit 2 khi đầu vào sai | Đạt | `tests/contract.test.ts`, `p1-bad-inputs`, mỗi scenario chạy 2 lần |
| AC7 `tuning` khớp game | Đạt | `tests/contract.test.ts` so `game.contract.json` với `src/sim/tuning.ts` |
| AC8 Chơi được trên trình duyệt | **Chưa kiểm chứng bằng ảnh** | Cần chơi thử thủ công và chụp màn hình (xem bên dưới) |
| Build trên macOS/Linux | Chờ CI | `.github/workflows/ci.yml` chạy `npm ci && npm run build` trên ubuntu và macos sau khi push. Docker Desktop local không chạy nên chưa thử Linux tại máy. |

Bằng chứng headless: [docs/proof/phase-1/summary.md](../proof/phase-1/summary.md).

## Nhật ký lỗi của AI

| # | Lỗi | Phát hiện bằng | Xử lý / chỉnh harness |
|---|---|---|---|
| 1 | Claude chỉ áp dụng nửa quyết định D4: `random_*: false` tắt sinh định kỳ nhưng vẫn sinh 30 đom đóm và 3 Bóng Mực ban đầu khi scenario không kèm danh sách | Review Codex (HIGH) | Viết test tái hiện (đỏ) rồi sửa. Đây là ví dụ cho lý do cần reviewer khác người viết. |
| 2 | Lệch một tick: Bóng Mực bị choáng mất 1 tick ngay trong tick tỏa sáng (179 thay vì 180) | Review Codex (MED) | Test tái hiện rồi sửa, ghi A13 |
| 3 | Vùng an toàn chồng nhau: đẩy ra khỏi vùng này lại rơi vào vùng khác | Review Codex (MED) | Test tái hiện, giải ràng buộc lặp |
| 4 | Kỳ vọng của scenario `p1-default-night` sai: Claude giả định chuỗi input "mù" sẽ nhặt được đom đóm | `npm run verify` báo FAIL | Kiểm tra output thật: game đúng luật, kỳ vọng sai. Sửa kỳ vọng thành tính chất có nghĩa (Bóng Mực đuổi và chạm người chơi). Đã thêm vào skill `verify-phase` quy tắc: kỳ vọng tính tay **trước** khi chạy, không chép output vào kỳ vọng. |
| 5 | Phiên bản đầu của `stop-gate.mjs` dùng `require` trong ESM | Claude tự đọc lại trước khi chạy | Viết lại, test cả nhánh xanh và nhánh đỏ |
| 6 | Review Codex lần đầu không đọc được repo (sandbox read-only trên Windows chặn shell) | Codex tự báo | Đổi sang đưa mã nguồn thẳng vào prompt: rẻ hơn và không phụ thuộc sandbox |

## Token và chi phí (ước tính)

| Công cụ | Việc | Token |
|---|---|---|
| Codex (OpenAI) | Hỏi lại nhiệm vụ (resume session dài) | 144,509 |
| Codex | Duyệt lô 9 quyết định (resume) | 146,079 |
| Codex | Review lần 1, thất bại vì sandbox | 29,975 |
| Codex | Review lần 2, mã nguồn đưa thẳng vào prompt | 26,173 |
| **Codex tổng** | | **≈ 347k** |
| Claude Code | Toàn bộ phần đọc tài liệu, code, kiểm chứng | *điền từ `/cost` cuối phase* |

**Cách đã tiết kiệm:**
- Gom 9 quyết định vào một lượt Codex, trả lời dạng `OK`/`CHANGE`.
- Review bằng session Codex mới, chỉ gửi contract và nguồn (khoảng 26k token), thay vì resume session cũ (khoảng 145k token mỗi lượt).
- CLAUDE.md ngắn, không chép hơn 30 skill chung từ mẫu.
- Không dùng trình duyệt tự động để chụp ảnh.

**Bài học:** resume session dài là đắt nhất, vì phần lớn token là lịch sử nạp lại. Từ Phase 2, mọi lượt Codex sẽ dùng session mới kèm prompt tự đủ thông tin.

## Việc còn lại

- Chơi thử bản web và chụp 1–2 ảnh (HUD, đèn sáng, màn thắng/thua) vào `docs/proof/phase-1/`.
- Push, xem CI xanh trên ubuntu/macos, rồi gắn tag `phase-1`.
