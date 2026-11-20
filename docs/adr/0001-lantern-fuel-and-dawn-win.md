# ADR 0001: Đèn có nhiên liệu và luật thắng lúc bình minh

- Trạng thái: Đã chấp nhận (Phase 3, Ticket-03 "Đèn cạn dầu", Contract v1.2)
- Ngày: 2026-11-20
- Người quyết định: Codex (đại diện người dùng, R1–R13), Claude Code (triển khai)

## Bối cảnh

Đến Phase 2, đèn chỉ có hai trạng thái là `chưa sáng` và `đã sáng`. Đèn đã sáng thì sáng mãi, và game kết thúc ngay khi mọi đèn sáng (`all_lit`).

Playtest cho thấy người chơi giỏi thắng sau khoảng 2 phút, cuối Đêm không còn căng thẳng. Ticket-03 đổi mục tiêu thành "giữ đảo sáng tới bình minh".

## Quyết định

### 1. Mô hình trạng thái đèn

Đèn có thêm ba thuộc tính:
- `fuel`: lưu bằng **số nguyên đơn vị 1/60**, tối đa 6000 (tức 100), để tránh sai số số thực. Chỉ làm tròn tới 1 chữ số thập phân khi xuất ra.
- `everLit`
- `relitCount`

Các trạng thái và chuyển trạng thái:

```
ChưaTừngSáng --nạp 10--> Sáng(fuel=100) --fuel<=0--> Tắt(ever_lit) --nạp 5--> Sáng(fuel=100, relit_count+1)
                              |  ^
                      châm dầu (used = min(mang, ceil((100-fuel)/10)))
```

- **Đèn "yếu":** đang sáng với `fuel < 30`, tức `< 1800` đơn vị. Đèn yếu **mất vùng an toàn**.
- **Hao dầu:** ở bước 2 của tick, đèn tự hao 1 đơn vị (1/60 dầu), cộng 5 đơn vị cho mỗi Bóng Mực đang `drain`.
- **Tắt đèn:** ngay sau bước 2, đèn nào có `fuel <= 0` sẽ tắt (`lantern_out`, `deposited = 0`).
- **Chọn đèn khi tương tác:** xét gộp cả đèn chưa sáng và đèn sáng chưa đầy dầu, lấy đèn gần nhất, bằng nhau thì id nhỏ hơn.

### 2. Bóng Mực

Thêm trạng thái `drain`:
- **`wander` không còn đứng yên.** Bóng Mực đi tới đèn yếu gần nhất. Nếu không có đèn yếu, nó giữ mục tiêu là đèn tắt hiện tại, hoặc chọn đèn tắt gần nhất.
- **Vào `drain`:** khi cách đèn yếu ≤ 2 m. Lúc này Bóng Mực đứng yên và hút dầu.
- **Ra khỏi `drain`:**
  - sang `chase` khi Mây ở trong 6 m,
  - sang `wander` khi đèn tắt, dầu được châm lên ≥ 30, hoặc nó cách đèn quá 2 m,
  - sang `stunned` khi trúng Tỏa Sáng; trúng lúc đang `drain` được tổng +15 điểm.
- **Đẩy khỏi vùng an toàn:** khi đèn vừa được thắp, hoặc dầu được châm từ dưới 30 lên ≥ 30, Bóng Mực đang ở trong vùng (≤ 6 m) bị đẩy theo hướng tâm, **đúng 30 tick**, ra tới quá 6 m. Trong lúc bị đẩy, Bóng Mực không gây sát thương.

### 3. Luật thắng

- **Thắng:** bỏ thắng sớm. Đêm chỉ kết thúc ở bước "xét thắng/thua" của tick bình minh, nếu Mây còn sống và số đèn sáng ≥ `ceil(0.6 × N)` (`dawn_survived`).
- **Thứ tự ưu tiên:** hết Ngọn Lửa luôn xét trước (`no_flames`), kể cả ở chính tick bình minh. Nếu số đèn sáng dưới ngưỡng thì thua `dawn`.
- **Điểm khi thắng:** cộng `Σ(50 + floor(fuel))` cho mỗi đèn đang sáng và 50 cho mỗi Ngọn Lửa còn lại. Không còn thưởng thời gian, nên `tuning.score.per_second_left = 0`.

### 4. Sức chứa

`capacity = min(20, 10 + 2 × successfulLights)`. `successfulLights` đếm số lần thắp và thắp lại trong Đêm; đèn được scenario đặt sẵn không tính.

## Hệ quả

- **Phá vỡ tương thích**, xem [CHANGELOG.md](../../CHANGELOG.md):
  - không còn `all_lit` và thưởng thời gian,
  - điểm đổi,
  - thời lượng Đêm còn 240 / 270 / 300 s,
  - `wander` di chuyển thay vì đứng yên.
- **Test cũ bị luật mới làm sai** được cập nhật kèm lý do ghi trong code, không có test nào bị skip. Danh sách nằm ở [docs/notes/phase-3.md](../notes/phase-3.md).
- **Lựa chọn bị loại:**
  - Lưu `fuel` bằng số thực: dễ sai ở biên 30 và 0 sau hàng nghìn tick.
  - Tính `drain` trong bước 8, lúc Bóng Mực di chuyển: ticket bắt buộc trừ dầu ở bước 2.
- **Rủi ro:** một đèn có `fuel = 100` lúc bắt đầu tick vẫn hao về 99.983 trước bước tương tác, nên vẫn nhận 1 đom đóm châm dầu. Thực tế không bao giờ gặp đèn "đầy" lúc tương tác. Đây là hệ quả trực tiếp của thứ tự bắt buộc trong ticket, nên tôi ghi lại ở đây thay vì xử lý ngoại lệ.
