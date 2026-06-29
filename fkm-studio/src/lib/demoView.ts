/**
 * Công tắc DEMO/THẬT (nút ở TopHeader): ẩn/hiện dữ liệu mẫu trên MỌI màn mà
 * KHÔNG xoá vĩnh viễn.
 *  - "DEMO": hiện cả dữ liệu mẫu (seed) + dữ liệu thật.
 *  - "THẬT": ẩn toàn bộ bản ghi mẫu, chỉ còn dữ liệu thật anh đã tạo.
 *
 * Cách làm: cắt các bản ghi có ID mẫu (xem [[sampleIds]]) ra khỏi chính các
 * mảng dữ liệu sống (orders/customers/...) và cất tạm vào `stash` trong RAM.
 * Vì mọi màn đều đọc thẳng các mảng này nên chỉ cần cắt 1 chỗ là cả app tự
 * lọc, không phải sửa từng nơi đọc. Đây là LỌC XEM, không phải xoá: không ghi
 * đè localStorage khi ẩn, và `persistAll()` vẫn gộp lại stash để dữ liệu mẫu
 * không bị mất khỏi bộ nhớ lưu trữ (xem buildSnapshot trong persistence.ts).
 * Muốn XOÁ HẲN dữ liệu mẫu thì dùng nút riêng ở Trung tâm Dữ liệu
 * (clearSampleData) — khác hẳn công tắc ẩn/hiện này.
 */
import { orders } from "@/data/orders";
import { customers } from "@/data/customers";
import { concepts } from "@/data/concepts";
import { staff } from "@/data/staff";
import { inventory, addonServices, expenses } from "@/data/inventory";
import { messages } from "@/data/messages";
import { SAMPLE_IDS, setSampleHidden } from "@/lib/sampleIds";
import type {
  Order,
  Customer,
  Concept,
  Staff,
  InventoryItem,
  AddonService,
  Expense,
  Message,
} from "@/types";

// Cờ "Chế độ Demo" (bật trong Cài đặt). MẶC ĐỊNH TẮT = dữ liệu thật (đúng thực
// tế dùng hằng ngày, không thấy dữ liệu mẫu). Bật = hiện dữ liệu mẫu để
// xem/giới thiệu. Trước đây là nút THẬT/DEMO ở header (dễ lẫn) — đã chuyển vào
// Cài đặt và đảo mặc định thành thật.
const DEMO_KEY = "fkm-studio-demo-mode";

export interface SampleStash {
  orders: Order[];
  customers: Customer[];
  concepts: Concept[];
  staff: Staff[];
  inventory: InventoryItem[];
  addonServices: AddonService[];
  expenses: Expense[];
  messages: Message[];
}

let stash: SampleStash | null = null;

export function isSampleHidden(): boolean {
  return stash !== null;
}

/** Chế độ Demo đang bật hay không (mặc định false = dữ liệu thật). */
export function getDemoMode(): boolean {
  try {
    return localStorage.getItem(DEMO_KEY) === "1";
  } catch {
    return false;
  }
}

function setDemoModePref(on: boolean): void {
  try {
    localStorage.setItem(DEMO_KEY, on ? "1" : "0");
  } catch {
    // bỏ qua — không chặn luồng chính
  }
}

function spliceSamples<T extends { id: string }>(arr: T[], ids: ReadonlySet<string>): T[] {
  const removed: T[] = [];
  const kept: T[] = [];
  for (const item of arr) (ids.has(item.id) ? removed : kept).push(item);
  arr.length = 0;
  arr.push(...kept);
  return removed;
}

/** Ẩn dữ liệu mẫu (chế độ THẬT). Idempotent: gọi lại khi đang ẩn thì bỏ qua. */
export function hideSampleData(): void {
  if (stash) return;
  stash = {
    orders: spliceSamples(orders, SAMPLE_IDS.orders),
    customers: spliceSamples(customers, SAMPLE_IDS.customers),
    concepts: spliceSamples(concepts, SAMPLE_IDS.concepts),
    staff: spliceSamples(staff, SAMPLE_IDS.staff),
    inventory: spliceSamples(inventory, SAMPLE_IDS.inventory),
    addonServices: spliceSamples(addonServices, SAMPLE_IDS.addonServices),
    expenses: spliceSamples(expenses, SAMPLE_IDS.expenses),
    messages: spliceSamples(messages, SAMPLE_IDS.messages),
  };
  setDemoModePref(false); // ẩn mẫu = Chế độ Demo TẮT (dữ liệu thật)
  setSampleHidden(true); // để merge từ /api/chat-sync cũng bỏ qua bản ghi mẫu
}

/** Hiện lại dữ liệu mẫu (chế độ DEMO). Idempotent. */
export function showSampleData(): void {
  if (!stash) {
    setDemoModePref(true);
    setSampleHidden(false);
    return;
  }
  orders.push(...stash.orders);
  customers.push(...stash.customers);
  concepts.push(...stash.concepts);
  staff.push(...stash.staff);
  inventory.push(...stash.inventory);
  addonServices.push(...stash.addonServices);
  expenses.push(...stash.expenses);
  messages.push(...stash.messages);
  stash = null;
  setDemoModePref(true); // hiện mẫu = Chế độ Demo BẬT
  setSampleHidden(false);
}

/** Áp dụng đúng trạng thái đã lưu lúc khởi động (gọi sau loadPersisted). */
export function applySampleVisibilityFromPref(): void {
  if (getDemoMode()) showSampleData();
  else hideSampleData(); // mặc định (chưa từng bật demo) = dữ liệu thật
}

/** Lấy các bản ghi mẫu đang bị ẩn để persistAll() gộp lại khi lưu — tránh lưu
 * thiếu dữ liệu mẫu vào localStorage khi đang ở chế độ THẬT. null nếu không ẩn. */
export function getHiddenSampleStash(): SampleStash | null {
  return stash;
}

/** Bỏ stash mà KHÔNG trả lại mảng sống + đặt lại về chế độ DEMO — dùng khi
 * reset toàn bộ về dữ liệu mẫu (resetToSampleData), nơi sẽ tải lại trang và
 * seed lại từ đầu nên không cần khôi phục stash. */
export function dropHiddenSampleStash(): void {
  stash = null;
  setDemoModePref(false);
  setSampleHidden(false);
}
