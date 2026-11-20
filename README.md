# Đảo Đèn Lồng

> Video demo: *(sẽ thêm ở Phase 4)* · Bài lab Day 12 AI SDLC, cá nhân: Nguyễn Gia Bảo, 2A202603647 · Đề bài lab: [LAB-README.md](LAB-README.md)

Game 3D góc nhìn thứ ba. Mây, người giữ đèn nhỏ tuổi đội nón lá, đi qua ba hòn đảo (Đảo Bến, Đảo Cau, Đảo Chuông) gom đom đóm để thắp lại các Đèn Lồng Lớn trước bình minh. Trên đường đi, Mây phải né và xua Bóng Mực, đồng thời giữ đom đóm khỏi bị Gió Lạc cướp.

## Cài đặt và chạy (3 lệnh)

Cần Node.js ≥ 20.19 (macOS / Linux / Windows).

```bash
npm ci && npm run build      # 1. cài và build (web + headless)
npm run preview              # 2. mở http://localhost:4173 để chơi
npm test                     # 3. chạy toàn bộ kiểm thử
```

Chế độ dev có hot reload: `npm run dev`.

## Điều khiển

| Phím | Hành động |
|---|---|
| W A S D | Di chuyển (theo hướng camera) |
| ← → hoặc kéo chuột | Xoay camera |
| Space | Nhảy |
| Shift | Lướt (14 m/s trong 0,2 giây, hồi chiêu 1,5 giây) |
| E | Nạp đom đóm vào đèn gần nhất |
| F hoặc click chuột trái | Tỏa Sáng xua Bóng Mực (tốn 3 đom đóm, hồi chiêu 3 giây) |
| Esc / P | Tạm dừng: Tiếp tục / Chơi lại Đêm / Cài đặt / Về menu |

## Luật chơi và cách tính điểm (số chuẩn Ticket-02)

- **Ba Đêm** chơi nối tiếp:
  - Đảo Bến: 5 đèn, 5 phút.
  - Đảo Cau: hai đảo nối bằng cầu tre và bục nhảy, 6 đèn, 5 phút 30 giây.
  - Đảo Chuông: 3 tầng, có dốc, bục nhảy và gió mạnh, 7 đèn, 6 phút.
- **Đom đóm:** nhặt tự động khi đi qua, mang tối đa **10** con. Mỗi đèn cần **10** con và nhớ tiến độ nạp. Đứng gần đèn (≤ 2 m) rồi nhấn **E** để nạp.
- **Bóng Mực** đuổi khi Mây ở trong 12 m. Bị chạm thì mất 1 Ngọn Lửa (có 3), rơi một nửa số đom đóm ra quanh Mây (nhặt lại được trong 8 giây), rồi bất tử 1,5 giây.
- **Tỏa Sáng** làm Bóng Mực trong 5 m choáng 2 giây và bị đẩy lùi 4 m.
- **Vùng an toàn:** Bóng Mực không vào được vùng 6 m quanh đèn đã thắp.
- **Rơi khỏi đảo:** mất 1 Ngọn Lửa và toàn bộ đom đóm, sau 1 giây hồi sinh ở điểm xuất phát.
- **Gió Lạc** (Đêm 2, 3): đuổi khi Mây mang từ 5 đom đóm trở lên và cướp tới 3 con. Tỏa Sáng làm nó bỏ chạy, hoặc thả lại số đã cướp.
- **Bùa Gió** (Đêm 2, 3): trong 10 giây, Mây chạy 7,2 m/s và lướt không cần hồi chiêu.
- **Thắng:** thắp hết đèn. **Thua:** hết Ngọn Lửa, hoặc bình minh tới mà chưa thắp hết. Thua thì chơi lại Đêm đó. Thắng Đêm 3 thì hiện màn hình Bình Minh với tổng điểm.

| Sự kiện | Điểm |
|---|---|
| Mỗi đom đóm **nạp vào đèn** | +10 |
| Thắp 1 đèn | +100 |
| Mỗi Bóng Mực trúng Tỏa Sáng (mỗi lần) | +5 |
| Khi thắng: mỗi giây còn lại | +2 |
| Khi thắng: mỗi Ngọn Lửa còn lại | +50 |

Tổng điểm là tổng điểm các Đêm đã thắng. **Cài đặt** (âm lượng, độ nhạy chuột) được lưu giữa các lần mở game.

Luật chi tiết và giả định: [SPEC.md](SPEC.md).

## Chế độ headless (Test Contract v1.1)

Khai báo: [game.contract.json](game.contract.json). Sau `npm ci && npm run build`:

```bash
node dist/headless.js --seed 1 --night 1|2|3 --ticks 600 --out out.jsonl \
  [--scenario s.json] [--inputs i.json] [--snapshot-every 10]
```

Kiểm chứng end-to-end: `npm run verify -- 2` chạy **mọi** scenario trong `tests/scenarios/` (gồm cả Phase 1 để kiểm tra hồi quy) qua CLI thật, mỗi scenario hai lần để kiểm tra tất định, và ghi bằng chứng vào [docs/proof/phase-2/](docs/proof/phase-2/summary.md). Một Đêm đầy đủ 21.600 tick chạy khoảng 0,25 giây.

`tuning` khớp số chuẩn của Ticket-02 (test ép khớp). Giả định cho những chỗ ticket chưa nói rõ: [SPEC.md](SPEC.md) mục B1–B19.

## Sáng tạo của tôi

Chưa thêm sáng tạo ngoài yêu cầu: Phase 1 và 2 tập trung làm đúng phần lõi và contract. Âm thanh được tổng hợp bằng WebAudio, không dùng file asset.

## Tài liệu dự án

- [SPEC.md](SPEC.md): luật, giả định, tiêu chí nghiệm thu
- [docs/notes/](docs/notes/): giả định, nhật ký dùng AI, đánh giá từng phase
- [docs/proof/](docs/proof/): bằng chứng kiểm chứng từng phase
- Harness AI: [CLAUDE.md](CLAUDE.md), [.claude/settings.json](.claude/settings.json) (Stop hook chặn kết thúc khi test đỏ), [.claude/skills/verify-phase](.claude/skills/verify-phase/SKILL.md), [CI](.github/workflows/ci.yml)
