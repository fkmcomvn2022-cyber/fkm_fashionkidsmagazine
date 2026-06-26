import type { OperationTask } from "@/types";

export const operationTasks: OperationTask[] = [
  { id: "t1", type: "remind_deposit", orderId: "o6", title: "Nhắc cọc — Vũ Ngọc Anh", dueLabel: "Trước 16:00 hôm nay", urgent: true },
  { id: "t2", type: "conflict", orderId: "o8", title: "Trùng lịch — Nguyễn Thị Mai 26/06", dueLabel: "Cần xác nhận lại", urgent: true },
  { id: "t3", type: "remind_schedule", orderId: "o7", title: "Nhắc lịch — Bùi Thị Lan ngày mai 09:00", dueLabel: "Gửi trước 20:00 hôm nay" },
  { id: "t4", type: "remind_select_photo", orderId: "o3", title: "Nhắc chọn ảnh — Lê Thị Hương", dueLabel: "Đã chụp 1 ngày trước" },
  { id: "t5", type: "remind_schedule", orderId: "o9", title: "Nhắc lịch — Lê Thị Hương 27/06", dueLabel: "Gửi trong hôm nay" },
  { id: "t6", type: "remind_staff_schedule", orderId: "o7", staffId: "s1", title: "Nhắc lịch làm việc — Anh Khôi ngày mai 09:00", dueLabel: "Gửi trước 20:00 hôm nay" },
];
