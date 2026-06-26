/**
 * Hành động "nhắc" thật ở TaskBoard ("Việc nổi bật") — KHÔNG chỉ điều hướng
 * đến chi tiết đơn, mà mở thẳng app chat (Facebook/Zalo/SMS/gọi điện) với nội
 * dung tin nhắn soạn sẵn, theo đúng yêu cầu của user (xem feedback memory
 * fkm-studio-confirm-action-scope-before-build).
 *
 * Facebook Messenger (m.me) và Zalo (zalo.me) không có cách nào URL-prefill
 * nội dung tin nhắn một cách đáng tin cậy (không phải SMS/mailto) — nên giải
 * pháp khả thi là: mở deep link kênh chat đó trong tab mới + copy nội dung
 * tin nhắn vào clipboard (best-effort), để người dùng dán vào khi chat mở ra.
 * SMS thì prefill được thật qua `sms:...&body=...`.
 */
import { customerById, orderById, staffById } from "@/data";
import { buildVietQRUrl } from "@/lib/payments";
import { reminderSettings } from "@/lib/reminders";
import { formatDateShort, formatVND, weekdayLabel } from "@/lib/format";
import type { Order, Staff, StaffContactChannel } from "@/types";

export type CustomerContactChannel = "facebook" | "zalo";

/** Khách từ nguồn Facebook -> liên lạc qua Facebook; còn lại (Zalo/Giới thiệu/
 * Khách lẻ/Tiktok/Khác) -> liên lạc qua Zalo, theo đúng quy ước user đã chốt. */
export function resolveCustomerChannel(order: Order): CustomerContactChannel {
  return order.source === "Facebook" ? "facebook" : "zalo";
}

export function resolveStaffChannel(staff: Staff): StaffContactChannel {
  return staff.defaultContactChannel;
}

/** Best-effort copy nội dung vào clipboard — không chặn luồng nếu trình duyệt
 * từ chối (vd. không phải HTTPS, hoặc người dùng chưa tương tác trang). */
function copyToClipboard(text: string) {
  navigator.clipboard?.writeText(text).catch(() => {});
}

function openInNewTab(url: string) {
  window.open(url, "_blank", "noopener,noreferrer");
}

/** Mở kênh liên lạc của KHÁCH (Facebook/Zalo) kèm copy sẵn nội dung tin nhắn.
 * `contact` là số Zalo/link Facebook lấy từ `order.socialContact` — nếu trống
 * thì vẫn mở kênh chat chung (không có đích cụ thể) để người dùng tự tìm. */
function openCustomerChannel(channel: CustomerContactChannel, contact: string | undefined, message: string) {
  copyToClipboard(message);
  const handle = contact?.trim();
  if (channel === "facebook") {
    openInNewTab(handle ? `https://m.me/${encodeURIComponent(handle)}` : "https://www.messenger.com/");
  } else {
    openInNewTab(handle ? `https://zalo.me/${encodeURIComponent(handle)}` : "https://chat.zalo.me/");
  }
}

/** Mở kênh liên lạc của NHÂN SỰ theo đúng kênh được truyền vào (mặc định hoặc
 * kênh dự phòng người dùng tự chọn ở nút "Liên lạc"). */
export function openStaffChannel(staff: Staff, channel: StaffContactChannel, message: string) {
  const phone = (staff.zalo || staff.phone || "").trim();
  if (channel === "call") {
    window.location.href = `tel:${phone}`;
    return;
  }
  copyToClipboard(message);
  if (channel === "facebook") {
    // Khác kênh Facebook của khách (chỉ có handle ngắn) — đây là link inbox đầy
    // đủ studio dán tay (vd. m.me/ten.nhan.su hoặc link chat cũ), nên mở thẳng
    // đúng link đó, không tự suy ra URL như openCustomerChannel.
    const link = staff.facebookLink?.trim();
    openInNewTab(link || "https://www.messenger.com/");
    return;
  }
  if (channel === "zalo") {
    openInNewTab(phone ? `https://zalo.me/${encodeURIComponent(phone)}` : "https://chat.zalo.me/");
  } else {
    window.location.href = `sms:${phone}?body=${encodeURIComponent(message)}`;
  }
}

// ---- Nội dung tin nhắn theo từng loại việc ----

export function buildDepositMessage(order: Order): { text: string; qrUrl: string | null } {
  const customer = customerById(order.customerId);
  const qrUrl = buildVietQRUrl(order.remaining, `${order.code} ${customer?.name ?? ""}`.trim());
  const text =
    `Dạ FKM Studio xin nhắc anh/chị ${customer?.name ?? ""}, đơn ${order.code} còn cần đặt cọc ` +
    `${formatVND(order.remaining)}. Anh/chị quét mã QR đính kèm để chuyển khoản giúp em nha. Em cảm ơn anh/chị!`;
  return { text, qrUrl };
}

export function buildScheduleMessage(order: Order): string {
  const customer = customerById(order.customerId);
  return (
    `Dạ FKM Studio xin nhắc anh/chị ${customer?.name ?? ""}, lịch hẹn chụp vào ` +
    `${weekdayLabel(order.date)} ngày ${formatDateShort(order.date)} lúc ${order.time}. ` +
    `Anh/chị sắp xếp đến đúng giờ giúp em nha. Em cảm ơn anh/chị!`
  );
}

export function buildSelectPhotoMessage(order: Order): string {
  const customer = customerById(order.customerId);
  // Nếu studio đã dán danh sách ảnh vào cổng chọn ảnh (xem OrderDetailSheet,
  // [[fkm-studio-ai-chatbot-roadmap]] Giai đoạn 5) thì kèm thẳng link vào tin
  // nhắc — khách bấm vào chọn được ngay, không cần hỏi lại link ở đâu.
  const linkPart = order.photoSelection?.items.length
    ? ` Anh/chị bấm link này để chọn: ${window.location.origin}/chon-anh/${order.id}`
    : "";
  return (
    `Dạ FKM Studio xin nhắc anh/chị ${customer?.name ?? ""}, ảnh chụp ngày ${formatDateShort(order.date)} ` +
    `đã có sẵn để chọn.${linkPart} Anh/chị chọn ảnh giúp em để ekip tiến hành chỉnh sửa nha. Em cảm ơn anh/chị!`
  );
}

export function buildStaffScheduleMessage(order: Order, staff: Staff): string {
  return (
    `Chào ${staff.name}, lịch làm việc ngày ${weekdayLabel(order.date)} ${formatDateShort(order.date)} ` +
    `lúc ${order.time} (đơn ${order.code}). Em sắp xếp đến đúng giờ giúp anh/chị nha. Cảm ơn em!`
  );
}

/** Điểm gọi duy nhất từ TaskBoard — biết loại việc, tự build nội dung + mở
 * đúng kênh liên lạc mặc định. Trả về `qrUrl` (chỉ có ở nhắc cọc) để màn hình
 * gọi có thể hiển thị thêm QR nếu muốn, dù đã mở kênh chat ở bước này. */
export function sendTaskReminder(orderId: string, type: "remind_deposit" | "remind_schedule" | "remind_select_photo"): { qrUrl: string | null } {
  const order = orderById(orderId);
  if (!order) return { qrUrl: null };
  const channel = resolveCustomerChannel(order);

  if (type === "remind_deposit") {
    const { text, qrUrl } = buildDepositMessage(order);
    openCustomerChannel(channel, order.socialContact, text);
    return { qrUrl };
  }
  if (type === "remind_schedule") {
    openCustomerChannel(channel, order.socialContact, buildScheduleMessage(order));
    return { qrUrl: null };
  }
  openCustomerChannel(channel, order.socialContact, buildSelectPhotoMessage(order));
  return { qrUrl: null };
}

export function sendStaffScheduleReminder(orderId: string, staffId: string) {
  const order = orderById(orderId);
  const staff = staffById(staffId);
  if (!order || !staff) return;
  const message = buildStaffScheduleMessage(order, staff);
  openStaffChannel(staff, resolveStaffChannel(staff), message);
}

/** Số ngày trước lịch hẹn để gửi "nhắc lịch", cấu hình ở Thiết lập. */
export function scheduleReminderDaysBefore(): number {
  return reminderSettings.scheduleReminderDaysBefore;
}
