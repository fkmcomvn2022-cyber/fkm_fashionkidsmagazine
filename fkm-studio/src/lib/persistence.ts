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
import { SAMPLE_IDS } from "@/lib/sampleIds";
import { getHiddenSampleStash, showSampleData, dropHiddenSampleStash } from "@/lib/demoView";
import type { Order, Customer, Concept, Staff, InventoryItem, AddonService, Expense, Message, CrewSettlement } from "@/types";

const STORAGE_KEY = "fkm-studio-data-v1";

// Đổi qua biến môi trường Vite (VITE_BACKEND_URL) khi deploy backend thật ở
// 1 domain khác — mặc định trỏ vào server chạy local lúc dev (server/).
// Export ra để các module khác (vd. lib/push.ts) gọi cùng 1 backend, không
// lặp lại logic đọc biến môi trường ở nhiều nơi.
export const BACKEND_URL = import.meta.env.VITE_BACKEND_URL ?? "http://localhost:4000";

export interface PersistedSnapshot {
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
    applySnapshot(snap);
  } catch (err) {
    console.warn("Dữ liệu đã lưu bị lỗi, dùng lại dữ liệu mẫu.", err);
  }
}

/** Ghi 1 snapshot (đã parse) đè lên các mảng/biến dữ liệu sống hiện tại —
 * dùng chung cho loadPersisted() (đọc localStorage lúc khởi động) và
 * restoreSnapshot() (nhập file backup, xem dưới). Field nào không có trong
 * snapshot thì giữ nguyên giá trị hiện tại (replaceArrayContents tự bỏ qua
 * nếu không phải Array). */
function applySnapshot(snap: Partial<PersistedSnapshot>): void {
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
}

/** Gom đúng các mảng/biến dữ liệu thật hiện tại thành 1 snapshot — dùng chung
 * cho persistAll() (lưu localStorage + mirror backend) và downloadBackupFile()
 * (xuất file JSON cho người dùng tự giữ). Tách riêng để 2 nơi luôn lấy đúng
 * cùng 1 bộ dữ liệu, không lặp code. */
function buildSnapshot(): PersistedSnapshot {
  // Khi đang ở chế độ THẬT (ẩn dữ liệu mẫu, xem demoView.ts), các bản ghi mẫu
  // đã bị cắt khỏi mảng sống và cất trong stash. Phải GỘP lại khi lưu, nếu
  // không mỗi lần persistAll() (vd. tạo đơn thật) sẽ ghi đè localStorage thiếu
  // mất dữ liệu mẫu -> tải lại trang sẽ mất mẫu dù chỉ đang "ẩn" chứ chưa xoá.
  const hidden = getHiddenSampleStash();
  const merge = <T>(live: T[], extra: T[] | undefined) => (extra && extra.length ? [...live, ...extra] : live);
  return {
    orders: merge(orders, hidden?.orders),
    customers: merge(customers, hidden?.customers),
    concepts: merge(concepts, hidden?.concepts),
    staff: merge(staff, hidden?.staff),
    inventory: merge(inventory, hidden?.inventory),
    addonServices: merge(addonServices, hidden?.addonServices),
    expenses: merge(expenses, hidden?.expenses),
    messages: merge(messages, hidden?.messages),
    crewSettlements,
    breakWindowSettings,
    vietQRSettings,
    reminderSettings,
    aiAutoReplySettings,
    automationSettings,
  };
}

/**
 * Lưu toàn bộ dữ liệu hiện tại vào trình duyệt — gọi sau MỌI lần ghi dữ liệu
 * thật (hooked vào appState.bumpDataVersion(), xem appState.tsx). Lỗi khi lưu
 * (vd. hết dung lượng localStorage) chỉ cảnh báo ra console, không chặn luồng
 * nghiệp vụ đang chạy (đơn vẫn tạo được dù lưu thất bại).
 */
export function persistAll(): void {
  const snapshot = buildSnapshot();
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch (err) {
    console.warn("Không thể lưu dữ liệu vào trình duyệt (có thể do hết dung lượng).", err);
  }
  mirrorToBackend(snapshot);
}

/**
 * Xuất TOÀN BỘ dữ liệu thật hiện tại ra 1 file .json để người dùng tự lưu giữ
 * (Drive, USB, máy khác...) — đây là cơ chế "backup" THẬT duy nhất hiện có,
 * thay cho danh sách backup giả từng hiển thị ở Trung tâm Dữ liệu. Tải lại
 * file này vào app cần làm thủ công qua loadPersisted (chưa có UI "nhập file"
 * — nếu cần, làm sau, không nằm trong lần sửa này).
 */
export function downloadBackupFile(): void {
  const snapshot = buildSnapshot();
  const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const stamp = new Date().toISOString().slice(0, 10);
  a.href = url;
  a.download = `fkm-studio-backup-${stamp}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Đọc + kiểm tra sơ bộ 1 file backup .json do người dùng chọn (xem
 * downloadBackupFile) — KHÔNG ghi gì cả, chỉ trả về snapshot đã parse để
 * DataCenterPage hiển thị xem trước (bao nhiêu đơn/khách/...) trước khi
 * người dùng bấm xác nhận thật (xem restoreSnapshot). Trả lỗi rõ ràng nếu
 * file không phải JSON hợp lệ hoặc không giống cấu trúc backup của app này.
 */
export async function parseBackupFile(
  file: File,
): Promise<{ ok: true; snapshot: Partial<PersistedSnapshot> } | { ok: false; error: string }> {
  let raw: string;
  try {
    raw = await file.text();
  } catch {
    return { ok: false, error: "Không đọc được file." };
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { ok: false, error: "File không đúng định dạng JSON." };
  }

  if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
    return { ok: false, error: "File không đúng cấu trúc backup của FKM Studio." };
  }

  const snap = parsed as Partial<PersistedSnapshot>;
  const knownKeys: (keyof PersistedSnapshot)[] = [
    "orders",
    "customers",
    "concepts",
    "staff",
    "inventory",
    "addonServices",
    "expenses",
    "messages",
    "crewSettlements",
  ];
  const hasAnyKnownField = knownKeys.some((key) => key in snap);
  if (!hasAnyKnownField) {
    return { ok: false, error: "File không chứa dữ liệu FKM Studio nào nhận ra được." };
  }

  return { ok: true, snapshot: snap };
}

/** Đếm số bản ghi trong 1 snapshot đã parse (xem parseBackupFile) — dùng để
 * hiển thị xem trước cho người dùng trước khi xác nhận nhập, theo đúng style
 * countSampleData() ở dưới. */
export function countSnapshot(snap: Partial<PersistedSnapshot>): { label: string; count: number }[] {
  return [
    { label: "Đơn hàng", count: snap.orders?.length ?? 0 },
    { label: "Khách hàng", count: snap.customers?.length ?? 0 },
    { label: "Concept", count: snap.concepts?.length ?? 0 },
    { label: "Nhân sự", count: snap.staff?.length ?? 0 },
    { label: "Trang phục/kho", count: snap.inventory?.length ?? 0 },
    { label: "Dịch vụ thêm", count: snap.addonServices?.length ?? 0 },
    { label: "Chi phí", count: snap.expenses?.length ?? 0 },
    { label: "Tin nhắn", count: snap.messages?.length ?? 0 },
  ].filter((row) => row.count > 0);
}

/**
 * Ghi đè TOÀN BỘ dữ liệu hiện tại bằng 1 snapshot đã parse từ file backup
 * (xem parseBackupFile) — dùng cho nút "Nhập file backup" ở Trung tâm Dữ
 * liệu. KHÔNG THỂ HOÀN TÁC (mất hết dữ liệu hiện tại trên thiết bị này, thay
 * bằng dữ liệu trong file) — luôn phải để người dùng xem trước (countSnapshot)
 * và xác nhận trước khi gọi hàm này. Sau khi ghi, lưu lại + mirror backend +
 * tải lại trang để mọi màn hình đọc đúng dữ liệu mới từ đầu.
 */
export function restoreSnapshot(snap: Partial<PersistedSnapshot>): void {
  applySnapshot(snap);
  persistAll();
  window.location.reload();
}

const AUTO_BACKUP_KEY = "fkm-studio-autobackup-v1";

export interface AutoBackupSettings {
  /** Số ngày giữa 2 lần tự tải file backup — 0 = tắt. */
  intervalDays: number;
  /** ISO timestamp lần tự backup gần nhất (null = chưa từng tự backup). */
  lastBackupAt: string | null;
}

function readAutoBackupSettings(): AutoBackupSettings {
  try {
    const raw = localStorage.getItem(AUTO_BACKUP_KEY);
    if (raw) return JSON.parse(raw) as AutoBackupSettings;
  } catch {
    // bỏ qua, dùng mặc định
  }
  return { intervalDays: 7, lastBackupAt: null };
}

function writeAutoBackupSettings(settings: AutoBackupSettings): void {
  try {
    localStorage.setItem(AUTO_BACKUP_KEY, JSON.stringify(settings));
  } catch {
    // bỏ qua — không chặn luồng chính
  }
}

/** Đọc cấu hình backup tự động hiện tại — dùng để hiển thị ở Trung tâm Dữ
 * liệu (tần suất đang chọn + lần tự backup gần nhất). */
export function getAutoBackupSettings(): AutoBackupSettings {
  return readAutoBackupSettings();
}

/** Đổi tần suất tự backup (0 = tắt, hoặc số ngày). Không tự backup ngay khi
 * đổi — lần tự backup tiếp theo sẽ tính từ lastBackupAt cũ (hoặc ngay lần mở
 * app kế tiếp nếu trước đó đang tắt/chưa từng chạy). */
export function setAutoBackupIntervalDays(days: number): void {
  writeAutoBackupSettings({ ...readAutoBackupSettings(), intervalDays: days });
}

/**
 * Gọi 1 lần mỗi khi app khởi động (xem main.tsx) — đây là cơ chế "backup tự
 * động theo lịch" THẬT của app: vì là web app/PWA chạy trong trình duyệt,
 * không có cách nào chạy nền lúc app đã tắt hẳn, nên "tự động" ở đây nghĩa
 * là "tự kiểm tra mỗi lần mở app, nếu đã đủ lâu thì tự tải file backup mới" —
 * không phải lịch chạy nền thật ở cấp hệ điều hành. Nếu đã ≥ intervalDays
 * ngày kể từ lần tự backup trước (hoặc chưa từng tự backup), tự tải file
 * .json mới (như bấm nút "Tải file backup" tay) rồi ghi lại thời điểm.
 * intervalDays = 0 (đã tắt) hoặc chưa có dữ liệu thật nào lưu thì không làm
 * gì (tránh tải file backup toàn dữ liệu mẫu vô nghĩa).
 */
export function maybeRunAutoBackup(): void {
  if (!hasPersistedData()) return;
  const settings = readAutoBackupSettings();
  if (!settings.intervalDays || settings.intervalDays <= 0) return;

  // Chưa từng tự backup -> chỉ GHI NHẬN mốc bắt đầu tính, KHÔNG tự tải file
  // ngay lần mở đầu tiên. Trước đây thiếu nhánh này nên `last` mặc định = 0
  // (epoch 1970) bị so với Date.now() (mốc thật, luôn lớn hơn rất nhiều) ->
  // điều kiện "đã đến lúc" luôn đúng ngay từ lần mở đầu, khiến app tự gom
  // TOÀN BỘ dữ liệu thật (đơn/khách/tin nhắn tích lũy nhiều tuần) ra JSON và
  // bắt tải file ngay trên luồng chính MỖI LẦN mở app — với dữ liệu đủ lớn,
  // việc này treo cứng trình duyệt (Chrome tự kill tab "Aw, Snap!"), lặp lại
  // ở mọi máy/mọi mạng vì đây là lỗi logic, không phải lỗi máy/mạng/tiện ích.
  if (!settings.lastBackupAt) {
    writeAutoBackupSettings({ ...settings, lastBackupAt: new Date().toISOString() });
    return;
  }

  const last = new Date(settings.lastBackupAt).getTime();
  const dueAt = last + settings.intervalDays * 24 * 60 * 60 * 1000;
  if (Date.now() < dueAt) return;
  downloadBackupFile();
  writeAutoBackupSettings({ ...settings, lastBackupAt: new Date().toISOString() });
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
  // Quay về chế độ DEMO (hiện dữ liệu mẫu) sau khi reset — bỏ stash đang ẩn (nếu
  // có) và đặt lại cờ ẩn/hiện, để lần tải lại tới hiện đầy đủ dữ liệu mẫu seed.
  dropHiddenSampleStash();
  window.location.reload();
}

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
  // Nếu đang ở chế độ THẬT (mẫu đang bị ẩn trong stash), trả mẫu về mảng sống
  // trước rồi mới lọc — để lọc đúng và xoá hẳn cả phần đang ẩn, không sót.
  showSampleData();
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
