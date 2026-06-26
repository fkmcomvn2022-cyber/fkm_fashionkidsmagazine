/**
 * Sinh số thứ tự tiếp theo cho 1 prefix id (vd "c" -> c1, c2... ) bằng cách
 * quét số lớn nhất đang có trong danh sách, KHÔNG dùng biến đếm cố định khởi
 * tạo 1 lần khi load module. Lý do: sau khi nạp dữ liệu đã lưu từ trình duyệt
 * (xem persistence.ts), độ dài/nội dung mảng có thể khác hẳn dữ liệu mẫu ban
 * đầu — một biến đếm tính sẵn từ `arr.length` lúc module load sẽ bị lệch và
 * có thể tạo ra id trùng. Quét lại mỗi lần gọi luôn đúng bất kể khi nào dữ
 * liệu được nạp/đè.
 */
export function nextNumericId(prefix: string, items: { id: string }[]): number {
  let max = 0;
  for (const item of items) {
    if (!item.id.startsWith(prefix)) continue;
    const n = parseInt(item.id.slice(prefix.length), 10);
    if (!Number.isNaN(n) && n > max) max = n;
  }
  return max + 1;
}
