# ADR 0002: Bench qua trình duyệt thật, soak với `--no-opt`, bảng xếp hạng qua server Node

Trạng thái: chấp nhận (Phase 4, Ticket-04). Các quyết định D1–D15 được Codex duyệt theo lô. Codex đổi 6 mục, ghi chú ở cuối.

## Bối cảnh
Game là bản web (Three.js), còn luật nằm trong một sim thuần, chạy được cả trong headless. Ticket-04 yêu cầu ba thứ:
- Bench mở **cửa sổ 1280×720** và báo RSS.
- Soak đo RSS của tiến trình.
- Bảng xếp hạng "lưu trên đĩa cục bộ" và xuất được bằng `<run_cmd> --export-leaderboard`.

Bản web không tự làm được những việc đó.

## Quyết định
1. **Bench = Playwright điều khiển trình duyệt thật, có cửa sổ** (`scripts/bench.mjs`).
   - Thứ tự chọn trình duyệt: Chrome đã cài, rồi Edge, rồi Chromium của Playwright.
   - Chạy với cờ `--disable-gpu-vsync --disable-frame-rate-limit`.
   - Thời gian mỗi khung đo trong trang bằng mốc thời gian của `requestAnimationFrame`. Thống kê dùng hàm thuần `frameStats` (p95 lấy theo nearest-rank) và có unit test bám đúng công thức của ticket.
   - `load_ms` tính bằng `performance.now()` của tiến trình bench lúc trang báo khung hình đầu tiên. Con số này gồm cả thời gian khởi động server và trình duyệt.
2. **Cảnh bench nằm trong sim:** `createBenchWorld(seed)` cùng cờ `World.bench`.
   - Cờ này chỉ phía render bật; headless không bao giờ bật, nên đầu ra contract không đổi.
   - Khi bật cờ: không hao hay hút dầu, không nhặt đom đóm, không va chạm, không kết thúc Đêm, và (theo review) Bóng Mực không chuyển sang `chase`.
   - 200 Bóng Mực và 100 đom đóm rải theo xoắn ốc hướng dương, mỗi điểm chiếm diện tích bằng nhau, cộng nhiễu lấy từ seed. Cách rải này đều hơn rải ngẫu nhiên thuần (đề xuất của Codex).
3. **`peak_mem_mb = null`** cho bản web. Chromium chạy game trong tiến trình renderer/GPU riêng và không cho đọc RSS của chúng. File kết quả ghi `mem_note` giải thích và `js_heap_peak_mb` để tham khảo.
4. **`vsync_off` theo số đo** (đề xuất của Codex). Chỉ ghi `true` khi `avg_fps > 65`, vì cờ dòng lệnh không chứng minh được vsync đã tắt.
5. **Soak** chạy bằng `dist/soak.js`.
   - Đêm thứ i (tính từ 0) dùng seed `7 + i` và bản đồ `(i mod 3) + 1`.
   - Input sinh từ một bộ RNG mulberry32 riêng, nên dãy số RNG của thế giới không bị đụng tới.
   - **`--no-opt`:** đo bằng probe thì RSS tăng khoảng 13 MB một lần trong Đêm đầu (33 → 46 MB), rồi đi ngang. Chạy 10 Đêm hay 30 Đêm đều ra cùng mức, và `heapUsed` chỉ tăng 4,1 → 4,5 MB, tức là không có rò rỉ.
   - Thử tắt TurboFan bằng `--no-opt`: tỷ lệ còn 1,11×, kết quả giống hệt, thời gian chạy 0,2 → 0,3 s.
   - Cờ `--max-semi-space-size=1` và `--max-old-space-size=64` không giúp gì, nên phần tăng là bộ nhớ của trình biên dịch tối ưu.
6. **Bảng xếp hạng:** `run_cmd` đổi sang `node dist/server.js`.
   - Đây là server Node không phụ thuộc thư viện, được esbuild đóng gói chung với module luật `src/leaderboard.ts`. Client và server dùng chung module này, và nó có unit test.
   - Dữ liệu lưu ở `data/leaderboard.json`, ghi bằng file tạm rồi đổi tên. Biến môi trường `LEADERBOARD_FILE` đổi được đường dẫn.
   - Khi không có server (`npm run dev` hoặc host tĩnh), trình duyệt tự chuyển sang lưu bằng localStorage.

## Hệ quả
- Chơi chỉ cần Node. Riêng bench cần thêm Chrome/Edge hoặc `npx playwright install chromium`.
- Số bench phụ thuộc trình duyệt và GPU của máy chấm. Số tự đo chỉ để tham khảo.
- `run_cmd` cũ (`vite preview`) vẫn chơi được, nhưng không có bảng xếp hạng trên đĩa.

## Codex đổi (lô D1–D15)
- **D1:** `vsync_off` lấy theo số đo.
- **D6:** rải đều bằng phân tầng.
- **D9:** định nghĩa lại score.
- **D11:** cảnh báo dầu thấp báo khi vừa vượt ngưỡng, phụ đề có hàng đợi.
- **D12:** "Giảm chuyển động" được lưu, mặc định theo `prefers-reduced-motion`.
- **D14:** Release gồm cả script bench và hướng dẫn cài Playwright.
