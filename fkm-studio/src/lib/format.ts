import type { OrderStatus } from "@/types";

export function formatVND(n: number): string {
  return n.toLocaleString("vi-VN") + "đ";
}

export function formatVNDShort(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(n % 1_000_000 === 0 ? 0 : 1) + "tr";
  if (n >= 1_000) return (n / 1_000).toFixed(0) + "k";
  return String(n);
}

const weekdayLabels = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

// ---------------------------------------------------------------------------
// LƯU Ý QUAN TRỌNG (lỗi treo trắng app ở múi giờ Việt Nam — đã sửa 29/06/2026):
// Mọi phép tính ngày dạng "yyyy-mm-dd" ở đây làm CHUẨN HOÁ theo UTC, KHÔNG bao
// giờ trộn `new Date(iso + "T00:00:00")` (đọc theo giờ LOCAL của máy) với
// `.toISOString()` (xuất theo giờ UTC). Trước đây cách cũ làm như vậy: ở UTC+7,
// new Date("2026-06-29T00:00:00") là 0h GIỜ VN = 17h hôm trước theo UTC, nên
// addDays(...,+1) cộng 1 ngày LOCAL rồi đổi về UTC lại RƠI ĐÚNG NGÀY CŨ ->
// chuỗi ngày KHÔNG tăng -> vòng lặp `for (d=start; d<=end; d=addDays(d,1))` ở
// WeekCalendar chạy vô hạn -> treo cứng trình duyệt/app (cả web, Mac, Android,
// vì máy người dùng đều ở UTC+7). Máy chạy ở UTC không bao giờ tái hiện được.
// Giải pháp: parse trực tiếp y/m/d và dùng Date.UTC + getUTC*/setUTCDate để
// phép cộng/trừ ngày luôn nhất quán, không phụ thuộc múi giờ máy.
// ---------------------------------------------------------------------------

/** Tạo 1 Date "neo" vào 0h UTC của đúng ngày yyyy-mm-dd (không lệ thuộc múi giờ máy). */
function utcDateFromIso(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

export function formatDateShort(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}/${m}`;
}

export function weekdayLabel(iso: string): string {
  return weekdayLabels[utcDateFromIso(iso).getUTCDay()];
}

export function addDays(iso: string, days: number): string {
  const d = utcDateFromIso(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Thứ 2 (đầu tuần) của tuần chứa `iso` — dùng để tính dải 7 ngày hiển thị ở
 * Lịch ca chụp theo TUẦN ĐANG XEM (date), thay vì 1 tuần cố định cứng. */
export function startOfWeekIso(iso: string): string {
  const d = utcDateFromIso(iso);
  const day = d.getUTCDay(); // 0 = CN
  const diff = day === 0 ? -6 : 1 - day;
  d.setUTCDate(d.getUTCDate() + diff);
  return d.toISOString().slice(0, 10);
}

/** Ngày hôm nay theo lịch của máy người dùng, dạng ISO (yyyy-mm-dd). Dùng các
 * thành phần ngày LOCAL (không qua toISOString) để ở UTC+7 vẫn ra đúng "hôm
 * nay" theo giờ VN, rồi mọi phép tính tiếp theo (addDays/startOfWeekIso) xử lý
 * chuỗi này nhất quán theo UTC. */
export function todayIso(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function isSameDate(a: string, b: string): boolean {
  return a === b;
}

export const orderStatusMeta: Record<
  OrderStatus,
  { label: string; color: string; bg: string }
> = {
  new: { label: "Đơn mới", color: "#4f6df5", bg: "#e8edff" },
  deposited: { label: "Đã cọc", color: "#f5a524", bg: "#fef3dc" },
  scheduled: { label: "Đã lên lịch", color: "#4f6df5", bg: "#e8edff" },
  shooting: { label: "Đang chụp", color: "#9b5cf6", bg: "#efe7ff" },
  shot: { label: "Đã chụp", color: "#1fb27a", bg: "#e3f8ee" },
  selecting: { label: "Đang chọn ảnh", color: "#ef5fa7", bg: "#ffe6f2" },
  editing: { label: "Đang chỉnh sửa", color: "#ff9447", bg: "#fff1e2" },
  delivered: { label: "Đã giao ảnh", color: "#1fb27a", bg: "#e3f8ee" },
  completed: { label: "Hoàn thành", color: "#1fb27a", bg: "#e3f8ee" },
  cancelled: { label: "Đã huỷ", color: "#f0476b", bg: "#fde6ea" },
};

export function timeAgoVi(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return "vừa xong";
  if (mins < 60) return `${mins} phút trước`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} giờ trước`;
  const days = Math.floor(hours / 24);
  return `${days} ngày trước`;
}
