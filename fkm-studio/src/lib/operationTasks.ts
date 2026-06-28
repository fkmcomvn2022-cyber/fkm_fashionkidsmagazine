import { orders, customerById, staffById } from "@/data";
import { todayIso, weekdayLabel, formatDateShort } from "@/lib/format";
import { reminderSettings } from "@/lib/reminders";
import type { Order, OperationTask } from "@/types";

function daysBetween(fromIso: string, toIso: string): number {
  const a = new Date(fromIso + "T00:00:00").getTime();
  const b = new Date(toIso + "T00:00:00").getTime();
  return Math.round((b - a) / 86_400_000);
}

function toMin(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

const ROLE_FIELDS = ["photoStaffId", "makeupStaffId", "stylistStaffId", "retoucherId"] as const;

/**
 * "Việc nổi bật" ở Home — trước đây `data/tasks.ts` là 6 dòng MẪU cố định,
 * đứng yên mãi mãi, không bao giờ đổi theo dữ liệu thật. Hàm này tính LẠI MỖI
 * LẦN gọi từ orders/customers/staff thật, áp dụng cho MỌI khách (không chỉ
 * Facebook — khác `server/src/automationCron.ts` vốn chỉ tự động GỬI cho
 * khách có `facebookId`). Ở đây chỉ tính ra việc CẦN NHẮC TAY để chủ studio
 * xem rồi tự bấm gửi đúng kênh (xem lib/messaging.ts — TaskBoard.tsx vẫn gọi
 * `sendTaskReminder`/`sendStaffScheduleReminder` như trước, chỉ đổi nguồn
 * danh sách).
 *
 * Khác với cron tự động (phải tự lưu cờ `reminders.*SentAt` để khỏi gửi
 * lặp), danh sách tay này KHÔNG cần lưu cờ riêng — mỗi loại việc tự "biến
 * mất" khi điều kiện hết đúng, không cần nhớ "đã nhắc rồi":
 *  - Nhắc cọc: hết khi `recordPayment()` tự chuyển status khỏi "new".
 *  - Nhắc chọn ảnh: hết khi khách xác nhận xong (`photoSelection.completedAt`).
 *  - Nhắc lịch (khách + nhân sự): chỉ hiện đúng ngày còn cách
 *    `scheduleReminderDaysBefore` ngày, tự hết khi qua ngày đó.
 *  - Thiếu nhân sự / trùng lịch: là tình trạng tức thời — còn thiếu/còn
 *    trùng là còn hiện, gán đủ/sửa lịch là tự hết.
 */
export function computeOperationTasks(): OperationTask[] {
  const today = todayIso();
  const daysBefore = reminderSettings.scheduleReminderDaysBefore;
  const liveOrders = orders.filter((o) => o.status !== "cancelled");
  const tasks: OperationTask[] = [];

  for (const o of liveOrders) {
    const daysUntil = daysBetween(today, o.date);
    const customerName = customerById(o.customerId)?.name ?? "?";

    if (o.status === "new") {
      tasks.push({
        id: `dep-${o.id}`,
        type: "remind_deposit",
        orderId: o.id,
        title: `Nhắc cọc — ${customerName}`,
        dueLabel: daysUntil <= 0 ? `Ca hôm nay ${o.time}, chưa cọc` : `Ca ${weekdayLabel(o.date)} ${formatDateShort(o.date)}, chưa cọc`,
        urgent: daysUntil <= 0,
      });
    }

    if (o.status !== "new" && daysUntil === daysBefore) {
      tasks.push({
        id: `sch-${o.id}`,
        type: "remind_schedule",
        orderId: o.id,
        title: `Nhắc lịch — ${customerName}`,
        dueLabel: `Còn ${daysBefore} ngày tới ca ${weekdayLabel(o.date)} ${formatDateShort(o.date)}`,
        urgent: daysBefore <= 1,
      });
    }

    if ((o.photoSelection?.items?.length ?? 0) > 0 && !o.photoSelection?.completedAt) {
      tasks.push({
        id: `sel-${o.id}`,
        type: "remind_select_photo",
        orderId: o.id,
        title: `Nhắc chọn ảnh — ${customerName}`,
        dueLabel: "Đã gửi ảnh, khách chưa chọn xong",
      });
    }

    if (daysUntil <= 2 && (!o.photoStaffId || !o.makeupStaffId)) {
      const missing = [!o.photoStaffId && "Photo", !o.makeupStaffId && "Makeup"].filter(Boolean).join(", ");
      tasks.push({
        id: `staff-${o.id}`,
        type: "missing_staff",
        orderId: o.id,
        title: `Thiếu nhân sự (${missing}) — ${customerName}`,
        dueLabel: `Ca ${o.time} ${weekdayLabel(o.date)} ${formatDateShort(o.date)}`,
        urgent: daysUntil <= 1,
      });
    }

    if (daysUntil === daysBefore) {
      const staffIds = new Set(
        ROLE_FIELDS.map((f) => o[f]).filter((id): id is string => !!id),
      );
      for (const staffId of staffIds) {
        const staffName = staffById(staffId)?.name ?? "?";
        tasks.push({
          id: `staffsch-${o.id}-${staffId}`,
          type: "remind_staff_schedule",
          orderId: o.id,
          staffId,
          title: `Nhắc lịch làm việc — ${staffName}`,
          dueLabel: `Ca ${o.time} ${weekdayLabel(o.date)} ${formatDateShort(o.date)}`,
        });
      }
    }
  }

  // Trùng lịch — 2+ đơn cùng ngày, cùng 1 nhân sự (Photo/Makeup/Stylist/
  // Retoucher), giờ chồng lấn THẬT (theo time + durationMin từng đơn, không
  // chỉ giống ngày đại khái) — tái dùng kiểu tính của staffConflictIssues
  // trong data/orders.ts (chặn lúc tạo đơn), ở đây quét lại toàn bộ đơn ĐÃ
  // lưu để bắt cả trường hợp chủ studio đã bấm "Vẫn tạo đơn" (allowConflict).
  const byDate = new Map<string, Order[]>();
  for (const o of liveOrders) {
    if (!byDate.has(o.date)) byDate.set(o.date, []);
    byDate.get(o.date)!.push(o);
  }
  const reportedPairs = new Set<string>();
  for (const dayOrders of byDate.values()) {
    for (let i = 0; i < dayOrders.length; i++) {
      for (let j = i + 1; j < dayOrders.length; j++) {
        const a = dayOrders[i];
        const b = dayOrders[j];
        const aStart = toMin(a.time);
        const aEnd = aStart + a.durationMin;
        const bStart = toMin(b.time);
        const bEnd = bStart + b.durationMin;
        if (aStart >= bEnd || bStart >= aEnd) continue;
        const sharedStaff = ROLE_FIELDS.some((f) => a[f] && a[f] === b[f]);
        if (!sharedStaff) continue;
        const pairKey = [a.id, b.id].sort().join("|");
        if (reportedPairs.has(pairKey)) continue;
        reportedPairs.add(pairKey);
        tasks.push({
          id: `conf-${pairKey}`,
          type: "conflict",
          orderId: a.id,
          title: `Trùng lịch — ${customerById(a.customerId)?.name ?? "?"} & ${customerById(b.customerId)?.name ?? "?"}`,
          dueLabel: `Ca ${weekdayLabel(a.date)} ${formatDateShort(a.date)} — cùng nhân sự, giờ chồng lấn`,
          urgent: true,
        });
      }
    }
  }

  const orderDateOf = (orderId: string) => orders.find((o) => o.id === orderId)?.date ?? "";
  tasks.sort((t1, t2) => {
    if (!!t1.urgent !== !!t2.urgent) return t1.urgent ? -1 : 1;
    return orderDateOf(t1.orderId).localeCompare(orderDateOf(t2.orderId));
  });

  return tasks;
}
