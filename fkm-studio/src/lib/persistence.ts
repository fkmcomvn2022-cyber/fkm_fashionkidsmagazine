/**
 * Lưu/nạp toàn bộ dữ liệu thật của app vào localStorage của trình duyệt, để
 * dữ liệu không bị mất khi tải lại trang/tắt máy. Tất cả dữ liệu hiện đang
 * sống trong các mảng/biến module-level (orders, customers, concepts, staff,
 * inventory, addonServices, expenses, messages, breakWindowSettings,
 * vietQRSettings) — xem memory fkm-studio-data-write-path. Module này không
 * thêm 1 nguồn dữ liệu mới, chỉ đọc/ghi lại đúng các mảng/biến đó vào trình
 * duyệt. `messages` thêm vào Phase 2 (xem [[fkm-studio-ai-chatbot-roadmap]])
 * — trước đó là seed tĩnh, giờ là dữ liệu sống (tin Facebook + tin studio tự
 * gửi) nên phải lưu/khôi phục như mọi dữ liệu thật khác.
 *
 * Phase 0 (xem [[fkm-studio-ai-chatbot-roadmap]]): MỖI LẦN persistAll() chạy,
 * cũng bắn 1 bản mirror lên backend thật (server/) qua PUT /api/state —
 * best-effort, không chặn UI, không throw nếu backend chưa chạy/không có
 * mạng. localStorage VẪN là nguồn đọc duy nhất lúc khởi động (loadPersisted
 * chưa đọc từ backend) — backend hiện chỉ là bản mirror để chuẩn bị cho
 * Phase 2+ (webhook ghi vào state này). Khi cần app multi-device/multi-người
 * dùng thật, loadPersisted sẽ phải đổi sang đọc backend làm nguồn chính.
 */
import { orders } from "@/data/orders";
import { customers } from "@/data/customers";
import { concepts } from "@/data/concepts";
import { staff } from "@/data/staff";
import { inventory, addonServices, expenses } from "@/data/inventory";
import { messages } from "@/data/messages";
import { crewSettlements } from "@/data/crewSettlements";
import { breakWindowSettings, setBreakWindowSettings, type BreakWindowSetting } from "@/lib/scheduling";
import { vietQRSettings, setVietQRSettings, type VietQRSettings } from "@/lib/payments";
import { reminderSettings, setReminderSettings, type ReminderSettings } from "@/lib/reminders";
import { aiAutoReplySettings, setAiAutoReplySettings, type AiAutoReplySettings } from "@/lib/aiReply";
import { automationSettings, setAutomationSettings, type AutomationSettings } from "@/lib/automation";
import type { Order, Customer, Concept, Staff, InventoryItem, AddonService, Expense, Message, CrewSettlement } from "@/types";

const STORAGE_KEY = "fkm-studio-data-v1";

// Đổi qua biến môi trường Vite (VITE_BACKEND_URL) khi deploy backend thật ở
// 1 domain khác — mặc định trỏ vào server chạy local lúc dev (server/).
// Export ra để các module khác (vd. lib/push.ts) gọi cùng 1 backend, không
// lặp lại logic đọc biến môi trường ở nhiều nơi.
export const BACKEND_URL = import.meta.env.VITE_BACKEND_URL ?? "http://localhost:4000";

interface PersistedSnapshot {
  orders: Order[];
  customers: Customer[];
  concepts: Concept[];
  staff: Staff[];
  inventory: InventoryItem[];
  addonServices: AddonService[];
  expenses: Expense[];
  messages: Message[];
  crewSettlements: CrewSettlement[];
  breakWindowSettings: BreakWindowSetting[];
  vietQRSettings: VietQRSettings;
  reminderSettings: ReminderSettings;
  aiAutoReplySettings: AiAutoReplySettings;
  automationSettings: AutomationSettings;
}

function replaceArrayContents<T>(target: T[], next: unknown): void {
  if (!Array.isArray(next)) return;
  target.length = 0;
  target.push(...(next as T[]));
}

/**
 * Đọc dữ liệu đã lưu trong trình duyệt (nếu có) và nạp đè lên dữ liệu mẫu —
 * chỉ gọi 1 lần, trước khi app render lần đầu (xem main.tsx). Nếu chưa từng
 * lưu, hoặc dữ liệu lưu bị hỏng/không đọc được, giữ nguyên dữ liệu mẫu gốc —
 * không bao giờ làm app crash vì lỗi đọc dữ liệu cũ.
 */
export function loadPersisted(): void {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(STORAGE_KEY);
  } catch (err) {
    console.warn("Trình duyệt không cho phép đọc dữ liệu đã lưu — dùng dữ liệu mẫu.", err);
    return;
  }
  if (!raw) return;

  try {
    const snap = JSON.parse(raw) as Partial<PersistedSnapshot>;
    replaceArrayContents(orders, snap.orders);
    replaceArrayContents(customers, snap.customers);
    replaceArrayContents(concepts, snap.concepts);
    replaceArrayContents(staff, snap.staff);
    replaceArrayContents(inventory, snap.inventory);
    replaceArrayContents(addonServices, snap.addonServices);
    replaceArrayContents(expenses, snap.expenses);
    replaceArrayContents(messages, snap.messages);
    replaceArrayContents(crewSettlements, snap.crewSettlements);
    if (snap.breakWindowSettings) setBreakWindowSettings(snap.breakWindowSettings);
    if (snap.vietQRSettings) setVietQRSettings(snap.vietQRSettings);
    if (snap.reminderSettings) setReminderSettings(snap.reminderSettings);
    if (snap.aiAutoReplySettings) setAiAutoReplySettings(snap.aiAutoReplySettings);
    if (snap.automationSettings) setAutomationSettings(snap.automationSettings);
  } catch (err) {
    console.warn("Dữ liệu đã lưu bị lỗi, dùng lại dữ liệu mẫu.", err);
  }
}

/**
 * Lưu toàn bộ dữ liệu hiện tại vào trình duyệt — gọi sau MỌI lần ghi dữ liệu
 * thật (hooked vào appState.bumpDataVersion(), xem appState.tsx). Lỗi khi lưu
 * (vd. hết dung lượng localStorage) chỉ cảnh báo ra console, không chặn luồng
 * nghiệp vụ đang chạy (đơn vẫn tạo được dù lưu thất bại).
 */
export function persistAll(): void {
  const snapshot: PersistedSnapshot = {
    orders,
    customers,
    concepts,
    staff,
    inventory,
    addonServices,
    expenses,
    messages,
    crewSettlements,
    breakWindowSettings,
    vietQRSettings,
    reminderSettings,
    aiAutoReplySettings,
    automationSettings,
  };
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch (err) {
    console.warn("Không thể lưu dữ liệu vào trình duyệt (có thể do hết dung lượng).", err);
  }
  mirrorToBackend(snapshot);
}

/** Bắn snapshot lên backend (server/) — best-effort, im lặng nếu backend
 * chưa chạy hoặc mất mạng (vd. đang dev mà chưa `npm run dev` ở server/).
 * Không await ở nơi gọi, không chặn luồng ghi dữ liệu chính của app. */
function mirrorToBackend(snapshot: PersistedSnapshot): void {
  fetch(`${BACKEND_URL}/api/state`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(snapshot),
  }).catch(() => {
    // Backend chưa chạy hoặc không có mạng — bỏ qua, localStorage vẫn giữ dữ liệu thật.
  });
}

/** Có dữ liệu đã lưu trong trình duyệt hay chưa — dùng để hiển thị trạng thái
 * thật ở màn Trung tâm Dữ liệu (thay vì số liệu giả). */
export function hasPersistedData(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== null;
  } catch {
    return false;
  }
}

/**
 * Xoá dữ liệu đã lưu và tải lại trang — app khởi động lại từ đầu với dữ liệu
 * mẫu gốc. Dùng cho nút "Xoá dữ liệu / dùng lại dữ liệu mẫu" ở Trung tâm Dữ
 * liệu — luôn phải xác nhận với người dùng trước khi gọi hàm này vì không
 * thể hoàn tác.
 */
export function resetToSampleData(): void {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (err) {
    console.warn("Không thể xoá dữ liệu đã lưu.", err);
  }
  window.location.reload();
}
