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

/**
 * ID gốc của dữ liệu mẫu (seed) — viết cứng, KHÔNG tính lại từ dữ liệu đang
 * có, vì mục đích là lọc bỏ chính xác các bản ghi mẫu ban đầu này dù người
 * dùng đã sửa/lưu gì sau đó. Mọi bản ghi tạo qua app thật (createOrder,
 * findOrCreateCustomer, createConcept, createStaff...) đều sinh ID lớn hơn
 * các số này (nextNumericId quét ID lớn nhất hiện có rồi +1), nên không bao
 * giờ trùng vào nhóm này về sau.
 */
const SAMPLE_IDS = {
  orders: new Set(["o1", "o2", "o3", "o4", "o5", "o6", "o7", "o8", "o9", "o10"]),
  customers: new Set(["u1", "u2", "u3", "u4", "u5", "u6", "u7"]),
  concepts: new Set(["c1", "c2", "c3", "c4", "c5"]),
  staff: new Set(["s1", "s2", "s3", "s4", "s5", "s6", "s7"]),
  inventory: new Set(["i1", "i2", "i3", "i4", "i5", "i6", "i7"]),
  addonServices: new Set(["sv1", "sv2", "sv3", "sv4", "sv5", "sv6", "sv7", "sv8", "sv9"]),
  expenses: new Set(["e1", "e2", "e3", "e4", "e5"]),
  messages: new Set(["m1", "m2", "m3", "m4", "m5"]),
};

/** Đếm số bản ghi mẫu còn lại trong từng mảng — dùng để hiển thị trước khi
 * người dùng xác nhận xoá (xem DataCenterPage), tránh xoá "mù" không biết
 * ảnh hưởng bao nhiêu. */
export function countSampleData(): { label: string; count: number }[] {
  return [
    { label: "Đơn hàng mẫu", count: orders.filter((o) => SAMPLE_IDS.orders.has(o.id)).length },
    { label: "Khách hàng mẫu", count: customers.filter((c) => SAMPLE_IDS.customers.has(c.id)).length },
    { label: "Concept mẫu", count: concepts.filter((c) => SAMPLE_IDS.concepts.has(c.id)).length },
    { label: "Nhân sự mẫu", count: staff.filter((s) => SAMPLE_IDS.staff.has(s.id)).length },
    { label: "Trang phục/kho mẫu", count: inventory.filter((i) => SAMPLE_IDS.inventory.has(i.id)).length },
    { label: "Dịch vụ thêm mẫu", count: addonServices.filter((s) => SAMPLE_IDS.addonServices.has(s.id)).length },
    { label: "Chi phí mẫu", count: expenses.filter((e) => SAMPLE_IDS.expenses.has(e.id)).length },
    { label: "Tin nhắn mẫu", count: messages.filter((m) => SAMPLE_IDS.messages.has(m.id)).length },
  ].filter((row) => row.count > 0);
}

/**
 * Xoá CHỈ dữ liệu mẫu ban đầu (seed) — GIỮ NGUYÊN mọi dữ liệu thật đã
 * tạo/sửa sau đó (đơn, khách, concept, nhân sự, kho, dịch vụ, chi phí, tin
 * nhắn mới). Khác với resetToSampleData() (xoá HẾT, quay lại y nguyên dữ
 * liệu mẫu) — hàm này lọc đúng các ID mẫu gốc khỏi từng mảng, lưu lại, rồi
 * tải lại trang. Dùng cho nút "Xoá dữ liệu mẫu, giữ dữ liệu thật" ở Trung
 * tâm Dữ liệu.
 *
 * Lưu ý rủi ro (đã báo người dùng trước khi build): nếu có đơn THẬT đang
 * tham chiếu 1 concept/nhân sự MẪU (vd. đơn thật chụp concept mẫu "Thu Mơ"),
 * xoá concept/nhân sự mẫu đó sẽ làm đơn thật bị mất tên concept/nhân sự hiển
 * thị (dữ liệu đơn không mất, chỉ mất liên kết hiển thị).
 */
export function clearSampleData(): void {
  replaceArrayContents(orders, orders.filter((o) => !SAMPLE_IDS.orders.has(o.id)));
  replaceArrayContents(customers, customers.filter((c) => !SAMPLE_IDS.customers.has(c.id)));
  replaceArrayContents(concepts, concepts.filter((c) => !SAMPLE_IDS.concepts.has(c.id)));
  replaceArrayContents(staff, staff.filter((s) => !SAMPLE_IDS.staff.has(s.id)));
  replaceArrayContents(inventory, inventory.filter((i) => !SAMPLE_IDS.inventory.has(i.id)));
  replaceArrayContents(addonServices, addonServices.filter((s) => !SAMPLE_IDS.addonServices.has(s.id)));
  replaceArrayContents(expenses, expenses.filter((e) => !SAMPLE_IDS.expenses.has(e.id)));
  replaceArrayContents(messages, messages.filter((m) => !SAMPLE_IDS.messages.has(m.id)));
  persistAll();
  window.location.reload();
}
