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

export function formatDateShort(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function weekdayLabel(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  return weekdayLabels[d.getDay()];
}

export function addDays(iso: string, days: number): string {
  const d = new Date(iso + "T00:00:00");
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Thứ 2 (đầu tuần) của tuần chứa `iso` — dùng để tính dải 7 ngày hiển thị ở
 * Lịch ca chụp theo TUẦN ĐANG XEM (date), thay vì 1 tuần cố định cứng. */
export function startOfWeekIso(iso: string): string {
  const d = new Date(iso + "T00:00:00");
  const day = d.getDay(); // 0 = CN
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  return d.toISOString().slice(0, 10);
}

/** Ngày hôm nay theo giờ máy người dùng, dạng ISO (yyyy-mm-dd). */
export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
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
