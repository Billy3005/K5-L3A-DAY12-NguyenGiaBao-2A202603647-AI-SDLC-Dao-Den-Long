# Đảo Đèn Lồng

> Video demo: *(sẽ thêm ở Phase 4)* · Bài lab Day 12 AI SDLC, cá nhân: Nguyễn Gia Bảo, 2A202603647 · Đề bài lab: [LAB-README.md](LAB-README.md)

Game 3D góc nhìn thứ ba. Mây, người giữ đèn nhỏ tuổi đội nón lá, chạy khắp Đảo Bến gom đom đóm để thắp lại 5 Đèn Lồng Lớn trước bình minh, đồng thời né và xua Bóng Mực.

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
| E | Nạp đom đóm vào đèn gần nhất |
| F hoặc click chuột trái | Tỏa sáng xua Bóng Mực (tốn 1 đom đóm, hồi chiêu 1 giây) |
| R | Chơi lại |

## Luật chơi và cách tính điểm

- Đom đóm được nhặt tự động khi đi qua, mang tối đa **5** con.
- Mỗi đèn cần **5** đom đóm. Đứng gần đèn (≤ 2 m) và nhấn **E** để nạp.
- Bóng Mực đuổi theo Mây. Bị chạm thì mất 1 ngọn lửa (có 3), rơi một nửa số đom đóm đang mang, rồi bất tử 1,5 giây.
- Tỏa sáng làm Bóng Mực trong bán kính 6 m choáng 3 giây và bị đẩy lùi 4 m.
- Bóng Mực không vào được vùng 4 m quanh đèn **đã thắp**.
- **Thắng:** thắp đủ 5 đèn. **Thua:** hết ngọn lửa, hoặc bình minh tới (sau 5 phút) mà chưa thắp hết.

| Sự kiện | Điểm |
|---|---|
| Nhặt 1 đom đóm | +10 |
| Thắp 1 đèn | +100 |
| Mỗi Bóng Mực bị choáng | +20 |
| Khi thắng: mỗi giây còn lại | +1 |
| Khi thắng: mỗi ngọn lửa còn lại | +50 |

Luật chi tiết và giả định: [SPEC.md](SPEC.md).

## Chế độ headless (Test Contract v1.0)

Khai báo: [game.contract.json](game.contract.json). Sau `npm ci && npm run build`:

```bash
node dist/headless.js --seed 1 --night 1 --ticks 600 --out out.jsonl \
  [--scenario s.json] [--inputs i.json] [--snapshot-every 10]
```

Kiểm chứng end-to-end: `npm run verify -- 1` chạy mọi scenario trong `tests/scenarios/` qua CLI thật hai lần (kiểm tra tất định) và ghi bằng chứng vào [docs/proof/phase-1/](docs/proof/phase-1/summary.md).

`tuning`: mọi trường đều có giá trị thật. `fall_enabled: false` vì người chơi bị giữ trong đảo, không có rơi, nên không bao giờ phát `player_hit` với `by: "fall"`.

## Sáng tạo của tôi

Phase 1 tập trung làm đúng phần lõi, chưa thêm sáng tạo.

## Tài liệu dự án

- [SPEC.md](SPEC.md): luật, giả định, tiêu chí nghiệm thu
- [docs/notes/](docs/notes/): giả định, nhật ký dùng AI, đánh giá từng phase
- [docs/proof/](docs/proof/): bằng chứng kiểm chứng từng phase
- Harness AI: [CLAUDE.md](CLAUDE.md), [.claude/settings.json](.claude/settings.json) (Stop hook chặn kết thúc khi test đỏ), [.claude/skills/verify-phase](.claude/skills/verify-phase/SKILL.md), [CI](.github/workflows/ci.yml)
