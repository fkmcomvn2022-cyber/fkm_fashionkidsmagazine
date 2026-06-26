/**
 * Giai đoạn 6 (xem [[fkm-studio-ai-chatbot-roadmap]]) — quét định kỳ (mỗi
 * giờ, xem index.ts) để tự gửi 3 loại nhắc tự động qua Facebook cho khách có
 * `facebookId` (đúng luật ở src/lib/automation.ts: auto_remind_deposit /
 * auto_remind_schedule / auto_remind_select_photo). Dùng đúng cờ
 * `Order.reminders` để KHÔNG nhắc trùng — mỗi loại chỉ gửi 1 lần/đơn.
 *
 * QUAN TRỌNG: khách KHÔNG có `facebookId` (nguồn khác Facebook) hoàn toàn
 * không bị động tới ở đây — luồng nhắc tay TaskBoard (đã build ở các task
 * #76-84) giữ nguyên y như cũ cho nhóm khách này.
 */
import type { StateSnapshot } from "./store.js";
import { sendFacebookImage, sendFacebookMessage, appendMessage } from "./facebook.js";
import { buildDepositReminderText, buildScheduleReminderText, buildSelectPhotoReminderText, type OrderShape } from "./chatOrders.js";

const FB_PAGE_ACCESS_TOKEN = process.env.FB_PAGE_ACCESS_TOKEN ?? "";
// URL public của app frontend (route /chon-anh/:orderId) — để trống nếu chưa
// deploy app công khai, tin nhắc chọn ảnh vẫn gửi được, chỉ thiếu link kèm.
const APP_PUBLIC_URL = process.env.APP_PUBLIC_URL ?? "";

interface CustomerShape {
  id?: string;
  name?: string;
  facebookId?: string;
  [key: string]: unknown;
}

interface AutomationRuleShape {
  key: string;
  enabled: boolean;
}

interface ReminderSettingsShape {
  scheduleReminderDaysBefore?: number;
}

function isRuleEnabled(state: StateSnapshot, key: string): boolean {
  const rules = (state.automationSettings as { rules?: AutomationRuleShape[] } | undefined)?.rules;
  return rules?.find((r) => r.key === key)?.enabled ?? true;
}

function customersOf(state: StateSnapshot): CustomerShape[] {
  return Array.isArray(state.customers) ? (state.customers as CustomerShape[]) : [];
}

function ordersOf(state: StateSnapshot): OrderShape[] {
  return Array.isArray(state.orders) ? (state.orders as OrderShape[]) : [];
}

export interface AutomationCronResult {
  depositReminders: number;
  scheduleReminders: number;
  selectPhotoReminders: number;
}

/**
 * Chạy 1 lượt quét — gọi từ setInterval ở index.ts. Đọc/ghi trực tiếp lên
 * `state` truyền vào, nơi gọi tự chịu trách nhiệm `writeState(state)` sau khi
 * hàm này trả về (cùng pattern với handleFacebookWebhookPayload).
 */
export async function runAutomationCron(state: StateSnapshot): Promise<AutomationCronResult> {
  const result: AutomationCronResult = { depositReminders: 0, scheduleReminders: 0, selectPhotoReminders: 0 };
  if (!FB_PAGE_ACCESS_TOKEN) return result;

  const customers = customersOf(state);
  const customerById = new Map(customers.map((c) => [c.id, c]));
  const todayIso = new Date().toISOString().slice(0, 10);
  const reminderSettings = (state.reminderSettings as ReminderSettingsShape | undefined) ?? {};
  const daysBefore = reminderSettings.scheduleReminderDaysBefore ?? 1;

  const depositEnabled = isRuleEnabled(state, "auto_remind_deposit");
  const scheduleEnabled = isRuleEnabled(state, "auto_remind_schedule");
  const selectPhotoEnabled = isRuleEnabled(state, "auto_remind_select_photo");

  for (const order of ordersOf(state)) {
    if (order.status === "cancelled") continue;
    const customer = customerById.get(order.customerId);
    if (!customer?.facebookId) continue; // khách kênh khác — bỏ qua, giữ luồng TaskBoard tay
    if (!order.reminders) order.reminders = {};
    const name = customer.name ?? "khách";

    if (depositEnabled && order.status === "new" && !order.reminders.depositReminderSentAt) {
      const { text, qrUrl } = buildDepositReminderText(state, order, name);
      const sent = await sendFacebookMessage(customer.facebookId, text, FB_PAGE_ACCESS_TOKEN);
      if (sent.ok) {
        order.reminders.depositReminderSentAt = new Date().toISOString();
        appendMessage(state, { customerId: customer.id ?? "", channel: "facebook", fromCustomer: false, text, aiGenerated: true });
        if (qrUrl) await sendFacebookImage(customer.facebookId, qrUrl, FB_PAGE_ACCESS_TOKEN);
        result.depositReminders += 1;
      }
    }

    if (scheduleEnabled && order.date && order.status !== "new" && !order.reminders.scheduleReminderSentAt) {
      const daysUntil = Math.round((new Date(`${order.date}T00:00:00`).getTime() - new Date(`${todayIso}T00:00:00`).getTime()) / 86_400_000);
      if (daysUntil === daysBefore) {
        const text = buildScheduleReminderText(order, name);
        const sent = await sendFacebookMessage(customer.facebookId, text, FB_PAGE_ACCESS_TOKEN);
        if (sent.ok) {
          order.reminders.scheduleReminderSentAt = new Date().toISOString();
          appendMessage(state, { customerId: customer.id ?? "", channel: "facebook", fromCustomer: false, text, aiGenerated: true });
          result.scheduleReminders += 1;
        }
      }
    }

    if (
      selectPhotoEnabled &&
      order.photoSelection?.items?.length &&
      !order.photoSelection?.completedAt &&
      !order.reminders.selectPhotoReminderSentAt
    ) {
      const text = buildSelectPhotoReminderText(order, name, APP_PUBLIC_URL);
      const sent = await sendFacebookMessage(customer.facebookId, text, FB_PAGE_ACCESS_TOKEN);
      if (sent.ok) {
        order.reminders.selectPhotoReminderSentAt = new Date().toISOString();
        appendMessage(state, { customerId: customer.id ?? "", channel: "facebook", fromCustomer: false, text, aiGenerated: true });
        result.selectPhotoReminders += 1;
      }
    }
  }

  return result;
}
