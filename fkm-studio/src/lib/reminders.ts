/**
 * Cấu hình "nhắc lịch hẹn trước mấy ngày" cho khách — áp dụng CHUNG cho toàn
 * studio (không theo từng concept), cùng pattern mutable module-level setting
 * như `breakWindowSettings`/`vietQRSettings` (xem memory fkm-studio-data-write-path).
 * Đổi ở Thiết lập, không cần sửa code.
 */
export interface ReminderSettings {
  scheduleReminderDaysBefore: number; // 1 hoặc 2 — nhắc lịch hẹn trước mấy ngày, gửi vào buổi tối
}

export let reminderSettings: ReminderSettings = {
  scheduleReminderDaysBefore: 1,
};

export function setReminderSettings(next: ReminderSettings) {
  reminderSettings = next;
}
