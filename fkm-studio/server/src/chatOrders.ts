/**
 * Giai đoạn 6 (xem [[fkm-studio-ai-chatbot-roadmap]]) — phần "nghiệp vụ thật"
 * mà AI được tự làm trên đơn hàng, chạy độc lập phía server trên state mirror
 * (cùng pattern type lỏng + logic lặp lại như facebook.ts/ai.ts/orders.ts —
 * KHÔNG import từ frontend vì 2 runtime khác nhau, xem ghi chú đầu các file
 * đó). Gồm 2 việc:
 *   1) createOrderFromChat — AI tự tạo đơn (trạng thái "Chưa cọc") khi đã thu
 *      thập đủ tên + SĐT + ngày/giờ từ hội thoại (function-calling, do Gemini
 *      tự quyết định gọi khi đang trả lời, xem FUNCTION_SCHEMAS ở ai.ts).
 *   2) confirmDepositFromScreenshot — KHÔNG phải 1 "function" Gemini tự chọn
 *      gọi giữa hội thoại chữ, mà là 1 bước xử lý TIỀN ĐỊNH (deterministic)
 *      chạy khi webhook nhận được 1 ảnh được phân loại là ảnh chuyển khoản
 *      (xem classifyImage ở ai.ts + handleIncomingImage ở index.ts) — vì xác
 *      nhận tiền cần chắc chắn, không nên để mô hình tự soạn câu trả lời tự
 *      do, nên dùng đúng pattern template tiền định đã có ở
 *      src/lib/messaging.ts (buildDepositMessage) port lại ở đây.
 */
import type { StateSnapshot } from "./store.js";

export interface ConceptShape {
  id?: string;
  name?: string;
  status?: string;
  priceChild?: number;
  priceAdult?: number;
  durationMin?: number;
  // Giai đoạn 7 — mirror đúng 3 field mới ở Concept (src/types/index.ts) để AI
  // tư vấn khách sâu hơn + chủ động gửi ảnh mẫu (xem buildStudioContext/
  // send_concept_photos ở ai.ts).
  shortDesc?: string;
  description?: string;
  sampleImageUrls?: string[];
  packageSummary?: string;
  [key: string]: unknown;
}

export interface OrderShape {
  id?: string;
  code?: string;
  customerId?: string;
  conceptId?: string;
  date?: string;
  time?: string;
  durationMin?: number;
  people?: { id: string; name: string; audience: string; conceptId: string }[];
  total?: number;
  deposit?: number;
  remaining?: number;
  status?: string;
  source?: string;
  socialContact?: string;
  notes?: string;
  reminders?: { depositReminderSentAt?: string; scheduleReminderSentAt?: string; selectPhotoReminderSentAt?: string };
  photoSelection?: { items?: string[]; selectedUrls?: string[]; completedAt?: string };
  [key: string]: unknown;
}

interface CustomerShape {
  id?: string;
  name?: string;
  phone?: string;
  facebookId?: string;
  totalOrders?: number;
  totalSpent?: number;
  [key: string]: unknown;
}

interface VietQRSettingsShape {
  bankBin?: string;
  accountNumber?: string;
  accountName?: string;
}

function ordersOf(state: StateSnapshot): OrderShape[] {
  if (!Array.isArray(state.orders)) state.orders = [];
  return state.orders as OrderShape[];
}

export function conceptsOf(state: StateSnapshot): ConceptShape[] {
  return Array.isArray(state.concepts) ? (state.concepts as ConceptShape[]) : [];
}

function nextOrderId(orders: OrderShape[]): string {
  let max = 0;
  for (const o of orders) {
    if (!o.id?.startsWith("o")) continue;
    const n = parseInt(o.id.slice(1), 10);
    if (!Number.isNaN(n) && n > max) max = n;
  }
  return `o${max + 1}`;
}

const fmtVND = (n: number) => `${Math.round(n).toLocaleString("vi-VN")}đ`;

const WEEKDAY_LABELS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
function weekdayLabel(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return WEEKDAY_LABELS[d.getDay()] ?? "";
}
function formatDateShort(iso: string): string {
  const d = new Date(`${iso}T00:00:00`);
  return `${String(d.getDate()).padStart(2, "0")}/${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// --- VietQR (port của src/lib/payments.ts — không import được qua 2 runtime) ---

function toVietQRName(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d")
    .toUpperCase()
    .trim();
}

export function buildVietQRUrl(state: StateSnapshot, amount?: number, addInfo?: string): string | null {
  const s = (state.vietQRSettings as VietQRSettingsShape | undefined) ?? {};
  if (!s.bankBin || !s.accountNumber?.trim() || !s.accountName?.trim()) return null;
  const params = new URLSearchParams();
  if (amount && amount > 0) params.set("amount", String(Math.round(amount)));
  if (addInfo) params.set("addInfo", addInfo);
  params.set("accountName", toVietQRName(s.accountName));
  return `https://img.vietqr.io/image/${s.bankBin}-${s.accountNumber.trim()}-compact2.png?${params.toString()}`;
}

// --- Tạo đơn từ hội thoại (function create_order_from_chat) -------------

export interface CreateOrderFromChatArgs {
  customerName: string;
  customerPhone: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  conceptName?: string;
  peopleCount?: number;
}

export interface CreateOrderFromChatResult {
  ok: boolean;
  error?: string;
  code?: string;
  total?: number;
  remaining?: number;
  conceptName?: string;
  alreadyExisted?: boolean;
  [key: string]: unknown;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^\d{1,2}:\d{2}$/;

function findActiveConcept(concepts: ConceptShape[], wantedName?: string): ConceptShape | undefined {
  const active = concepts.filter((c) => c.status === "active");
  if (active.length === 0) return undefined;
  if (!wantedName?.trim()) return active[0];
  const needle = wantedName.trim().toLowerCase();
  return (
    active.find((c) => (c.name ?? "").toLowerCase() === needle) ??
    active.find((c) => (c.name ?? "").toLowerCase().includes(needle) || needle.includes((c.name ?? "").toLowerCase())) ??
    active[0]
  );
}

/**
 * Tạo đơn hàng thật từ thông tin AI thu thập được trong hội thoại Facebook.
 * Đơn giản hoá so với createOrder() đầy đủ ở frontend (1 concept, 1 mức giá
 * người lớn cho mọi người trong nhóm, không addon/ưu đãi) — vì AI khó thu
 * thập đủ chi tiết (tuổi/size đồ từng người) chỉ qua chat; studio luôn sửa
 * lại chi tiết đơn trong app sau, đơn AI tạo chỉ cần ĐỦ ĐỂ BẮT ĐẦU thu cọc.
 * Trạng thái LUÔN "new" (chưa cọc) — việc xác nhận đã cọc chỉ xảy ra qua
 * confirmDepositFromScreenshot() khi khách gửi ảnh chuyển khoản thật.
 */
export function createOrderFromChat(
  state: StateSnapshot,
  customer: CustomerShape,
  args: CreateOrderFromChatArgs,
): CreateOrderFromChatResult {
  const date = args.date?.trim();
  const time = args.time?.trim();
  if (!date || !DATE_RE.test(date)) return { ok: false, error: "invalid_date" };
  if (!time || !TIME_RE.test(time)) return { ok: false, error: "invalid_time" };
  if (!args.customerName?.trim() || !args.customerPhone?.trim()) return { ok: false, error: "missing_contact" };

  const orders = ordersOf(state);

  // Idempotent — khách lặp lại cùng thông tin (vd Gemini gọi hàm 2 lần trong
  // 1 đoạn hội thoại) thì trả lại đúng đơn cũ, không tạo trùng.
  const dup = orders.find((o) => o.customerId === customer.id && o.date === date && o.time === time && o.status !== "cancelled");
  if (dup) return { ok: true, code: dup.code, total: dup.total, remaining: dup.remaining, alreadyExisted: true };

  const concept = findActiveConcept(conceptsOf(state), args.conceptName);
  if (!concept) return { ok: false, error: "no_concept_open" };

  const peopleCount = Math.max(1, Math.min(10, Math.round(args.peopleCount ?? 1)));
  const pricePerPerson = concept.priceAdult ?? concept.priceChild ?? 0;
  const total = pricePerPerson * peopleCount;

  // Cập nhật thông tin khách nếu trước đó chỉ là khách Facebook chưa rõ tên/SĐT.
  if (!customer.name || customer.name === "Khách Facebook") customer.name = args.customerName.trim();
  if (!customer.phone) customer.phone = args.customerPhone.trim();

  const seq = nextOrderId(orders);
  const people = Array.from({ length: peopleCount }, (_, i) => ({
    id: `p${seq.slice(1)}_${i}`,
    name: i === 0 ? args.customerName.trim() : `${args.customerName.trim()} #${i + 1}`,
    audience: "Người lớn",
    conceptId: concept.id ?? "",
  }));

  const order: OrderShape = {
    id: seq,
    code: `FKM-${date.slice(5).replace("-", "")}-${seq.slice(1).padStart(2, "0")}`,
    customerId: customer.id,
    conceptId: concept.id,
    date,
    time,
    durationMin: concept.durationMin ?? 60,
    people,
    total,
    deposit: 0,
    remaining: total,
    status: "new",
    source: "Facebook",
    socialContact: customer.facebookId,
    notes: "Đơn do AI tự tạo từ hội thoại Facebook — studio kiểm tra/bổ sung chi tiết (tuổi, size đồ, ekip...) khi cần.",
  };
  orders.push(order);
  customer.totalOrders = (customer.totalOrders ?? 0) + 1;
  customer.totalSpent = (customer.totalSpent ?? 0) + total;

  return { ok: true, code: order.code, total, remaining: order.remaining, conceptName: concept.name };
}

// --- Upsell: thêm dịch vụ/thêm người vào đơn đang có (function upsell_order) ---
// Giai đoạn 7 — rủi ro cao hơn create_order_from_chat (ĐỤNG VÀO đơn đã có,
// đổi số tiền cần thu) nên mặc định TẮT (xem DEFAULT_AI_FUNCTIONS ở
// src/lib/aiReply.ts). AI chỉ nên gọi khi khách ĐÃ ĐỒNG Ý rõ ràng, không tự ý
// thêm khi mới gợi ý.

export interface UpsellOrderArgs {
  addonServiceName?: string;
  addonQuantity?: number;
  extraAdults?: number;
  extraChildren?: number;
}

export interface UpsellOrderResult {
  ok: boolean;
  error?: string;
  orderCode?: string;
  addedAddonName?: string;
  addedPeopleCount?: number;
  total?: number;
  remaining?: number;
  [key: string]: unknown;
}

/** Đơn "đang hoạt động" gần nhất của khách — dùng chung cho upsell/đổi lịch/
 * hủy lịch (đều cần xác định ĐÚNG 1 đơn đang nói tới trong hội thoại). Ưu
 * tiên đơn có ngày chụp sắp tới (chưa qua), không còn đơn nào sắp tới thì lấy
 * đơn gần nhất theo ngày. Bỏ qua đơn đã huỷ/đã hoàn tất/đã giao ảnh. */
function findActiveOrderForCustomer(orders: OrderShape[], customerId: string): OrderShape | undefined {
  const candidates = orders.filter(
    (o) => o.customerId === customerId && o.status !== "cancelled" && o.status !== "completed" && o.status !== "delivered",
  );
  if (candidates.length === 0) return undefined;
  const today = new Date().toISOString().slice(0, 10);
  const upcoming = candidates
    .filter((o) => (o.date ?? "") >= today)
    .sort((a, b) => String(a.date ?? "").localeCompare(String(b.date ?? "")));
  if (upcoming.length > 0) return upcoming[0];
  return candidates.sort((a, b) => String(b.date ?? "").localeCompare(String(a.date ?? "")))[0];
}

/** Tính lại total/remaining của 1 đơn sau khi sửa người/addon — mirror đơn
 * giản hoá của computeOrderPricing() ở frontend (src/data/orders.ts), GIỮ
 * NGUYÊN surcharge/promoType/promoValue đã có trên đơn (AI không tự đổi ưu
 * đãi, chỉ cộng thêm phần mới). */
function recomputeOrderTotal(state: StateSnapshot, order: OrderShape): void {
  const concepts = conceptsOf(state);
  const addonServices = Array.isArray(state.addonServices) ? (state.addonServices as { id?: string; price?: number }[]) : [];
  const people = Array.isArray(order.people) ? order.people : [];

  const subtotal = people.reduce((sum, p) => {
    const concept = concepts.find((c) => c.id === p.conceptId);
    if (!concept) return sum;
    const price = p.audience === "Trẻ em" ? concept.priceChild ?? 0 : concept.priceAdult ?? 0;
    return sum + price;
  }, 0);

  const addonIds = Array.isArray(order.addonServiceIds) ? (order.addonServiceIds as string[]) : [];
  const addonsTotal = addonIds.reduce((sum, id) => {
    const svc = addonServices.find((s) => s.id === id);
    return sum + (svc?.price ?? 0);
  }, 0);

  const surcharge = typeof order.surcharge === "number" ? order.surcharge : 0;
  const promoType = typeof order.promoType === "string" ? order.promoType : "Không có";
  const promoValue = typeof order.promoValue === "number" ? order.promoValue : 0;

  const baseForPercent = subtotal + addonsTotal + surcharge;
  let discount = 0;
  if (promoType === "Giảm tiền") {
    discount = Math.max(0, promoValue);
  } else if (promoType === "Giảm %" || (promoType === "Khách VIP" && promoValue)) {
    discount = Math.round((baseForPercent * Math.max(0, promoValue)) / 100);
  }

  order.total = Math.max(0, baseForPercent - discount);
  order.remaining = Math.max(0, order.total - (order.deposit ?? 0));
}

/**
 * Thêm dịch vụ bổ trợ (vd. thêm ảnh in, thêm album) và/hoặc thêm người (NL/TE)
 * vào đơn đang có của khách đang chat, rồi tính lại số tiền cần thu thêm. Chỉ
 * gọi khi khách ĐÃ ĐỒNG Ý — Gemini quyết định lúc nào gọi qua description ở
 * Cài đặt AI, hàm này không tự kiểm tra "đã đồng ý chưa".
 */
export function upsellOrder(state: StateSnapshot, customer: CustomerShape, args: UpsellOrderArgs): UpsellOrderResult {
  const orders = ordersOf(state);
  const order = findActiveOrderForCustomer(orders, customer.id ?? "");
  if (!order) return { ok: false, error: "no_active_order" };

  let addedAddonName: string | undefined;
  if (args.addonServiceName?.trim()) {
    const addonServices = Array.isArray(state.addonServices) ? (state.addonServices as { id?: string; name?: string }[]) : [];
    const needle = args.addonServiceName.trim().toLowerCase();
    const svc =
      addonServices.find((s) => (s.name ?? "").toLowerCase() === needle) ??
      addonServices.find((s) => (s.name ?? "").toLowerCase().includes(needle));
    if (!svc?.id) return { ok: false, error: "addon_not_found" };
    const qty = Math.max(1, Math.min(20, Math.round(args.addonQuantity ?? 1)));
    order.addonServiceIds = Array.isArray(order.addonServiceIds) ? order.addonServiceIds : [];
    for (let i = 0; i < qty; i++) (order.addonServiceIds as string[]).push(svc.id);
    addedAddonName = svc.name;
  }

  let addedPeopleCount = 0;
  const extraAdults = Math.max(0, Math.min(10, Math.round(args.extraAdults ?? 0)));
  const extraChildren = Math.max(0, Math.min(10, Math.round(args.extraChildren ?? 0)));
  if (extraAdults + extraChildren > 0) {
    const conceptId = order.conceptId ?? order.people?.[0]?.conceptId ?? "";
    order.people = Array.isArray(order.people) ? order.people : [];
    const baseIdx = order.people.length;
    for (let i = 0; i < extraAdults; i++) {
      order.people.push({ id: `${order.id}_p${baseIdx + i}`, name: `${customer.name ?? "Khách"} #${baseIdx + i + 1}`, audience: "Người lớn", conceptId });
    }
    for (let i = 0; i < extraChildren; i++) {
      order.people.push({ id: `${order.id}_p${baseIdx + extraAdults + i}`, name: `${customer.name ?? "Khách"} #${baseIdx + extraAdults + i + 1}`, audience: "Trẻ em", conceptId });
    }
    addedPeopleCount = extraAdults + extraChildren;
  }

  if (!addedAddonName && addedPeopleCount === 0) return { ok: false, error: "nothing_to_add" };

  recomputeOrderTotal(state, order);
  return { ok: true, orderCode: order.code, addedAddonName, addedPeopleCount, total: order.total, remaining: order.remaining };
}

// --- Đổi lịch / hủy lịch hẹn (function reschedule_order / cancel_order) ---
// Giai đoạn 7 — rủi ro CAO NHẤT trong các hàm tự ý mới (đụng tới lịch ekip đã
// xếp/hủy doanh thu) nên mặc định TẮT, studio cân nhắc kỹ trước khi bật (xem
// DEFAULT_AI_FUNCTIONS ở src/lib/aiReply.ts).

export interface RescheduleOrderArgs {
  newDate: string; // YYYY-MM-DD
  newTime: string; // HH:mm
}

export interface RescheduleOrderResult {
  ok: boolean;
  error?: string;
  orderCode?: string;
  oldDate?: string;
  oldTime?: string;
  newDate?: string;
  newTime?: string;
  [key: string]: unknown;
}

function timeToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return (h || 0) * 60 + (m || 0);
}

function rangesOverlap(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && bStart < aEnd;
}

/**
 * Đổi ngày/giờ đơn đang hoạt động gần nhất của khách. Chặn đổi vào ngày đã
 * qua và chặn đổi đè lên giờ của 1 đơn khác đã có trong ngày đó (kiểm tra đơn
 * giản theo khung [giờ, giờ + thời lượng] toàn studio — KHÔNG phân theo từng
 * nhân sự như suggestionEngine.ts đầy đủ ở frontend, vì AI chỉ cần biết "có
 * trùng giờ với ai không", studio tự xếp lại ekip nếu cần sau khi đổi).
 */
export function rescheduleOrder(state: StateSnapshot, customer: CustomerShape, args: RescheduleOrderArgs): RescheduleOrderResult {
  const newDate = args.newDate?.trim();
  const newTime = args.newTime?.trim();
  if (!newDate || !DATE_RE.test(newDate)) return { ok: false, error: "invalid_date" };
  if (!newTime || !TIME_RE.test(newTime)) return { ok: false, error: "invalid_time" };

  const todayIso = new Date().toISOString().slice(0, 10);
  if (newDate < todayIso) return { ok: false, error: "past_date" };

  const orders = ordersOf(state);
  const order = findActiveOrderForCustomer(orders, customer.id ?? "");
  if (!order) return { ok: false, error: "no_active_order" };

  const durationMin = order.durationMin ?? 60;
  const newStart = timeToMinutes(newTime);
  const newEnd = newStart + durationMin;

  const conflict = orders.some((o) => {
    if (o.id === order.id || o.status === "cancelled" || o.date !== newDate) return false;
    const oStart = timeToMinutes(o.time ?? "00:00");
    const oEnd = oStart + (o.durationMin ?? 60);
    return rangesOverlap(newStart, newEnd, oStart, oEnd);
  });
  if (conflict) return { ok: false, error: "slot_conflict" };

  const oldDate = order.date;
  const oldTime = order.time;
  order.date = newDate;
  order.time = newTime;
  // Không tự đổi `status` — đổi lịch không thay đổi việc đã cọc/chưa cọc.
  return { ok: true, orderCode: order.code, oldDate, oldTime, newDate, newTime };
}

export interface CancelOrderResult {
  ok: boolean;
  error?: string;
  orderCode?: string;
  [key: string]: unknown;
}

/** Hủy đơn đang hoạt động gần nhất của khách — giống cancelOrder() ở frontend
 * (src/data/orders.ts): chỉ đổi status, KHÔNG đụng tới deposit/total (tiền đã
 * cọc thì studio tự xử lý hoàn/giữ theo chính sách riêng, ngoài phạm vi AI). */
export function cancelOrderFromChat(state: StateSnapshot, customer: CustomerShape): CancelOrderResult {
  const orders = ordersOf(state);
  const order = findActiveOrderForCustomer(orders, customer.id ?? "");
  if (!order) return { ok: false, error: "no_active_order" };
  order.status = "cancelled";
  return { ok: true, orderCode: order.code };
}

export function buildDepositReminderText(state: StateSnapshot, order: OrderShape, customerName: string): { text: string; qrUrl: string | null } {
  const qrUrl = buildVietQRUrl(state, order.remaining, `${order.code} ${customerName}`.trim());
  const text =
    `Dạ FKM Studio xin nhắc anh/chị ${customerName}, đơn ${order.code} còn cần đặt cọc ${fmtVND(order.remaining ?? 0)}. ` +
    `Anh/chị quét mã QR đính kèm để chuyển khoản giúp em nha. Em cảm ơn anh/chị!`;
  return { text, qrUrl };
}

export function buildScheduleReminderText(order: OrderShape, customerName: string): string {
  return (
    `Dạ FKM Studio xin nhắc anh/chị ${customerName}, lịch hẹn chụp vào ${weekdayLabel(order.date ?? "")} ngày ` +
    `${formatDateShort(order.date ?? "")} lúc ${order.time}. Anh/chị sắp xếp đến đúng giờ giúp em nha. Em cảm ơn anh/chị!`
  );
}

export function buildSelectPhotoReminderText(order: OrderShape, customerName: string, chonAnhBaseUrl: string): string {
  const linkPart = order.photoSelection?.items?.length ? ` Anh/chị bấm link này để chọn: ${chonAnhBaseUrl}/chon-anh/${order.id}` : "";
  return (
    `Dạ FKM Studio xin nhắc anh/chị ${customerName}, ảnh chụp ngày ${formatDateShort(order.date ?? "")} đã có sẵn để chọn.` +
    `${linkPart} Anh/chị chọn ảnh giúp em để ekip tiến hành chỉnh sửa nha. Em cảm ơn anh/chị!`
  );
}

// --- Xác nhận đã cọc qua ảnh chuyển khoản (deterministic, không qua Gemini text) ---

export interface ConfirmDepositResult {
  ok: boolean;
  reason?: "no_pending_order";
  orderCode?: string;
  amount?: number;
  remaining?: number;
}

/**
 * Tìm đơn "Chưa cọc" GẦN NHẤT của khách đang chat (theo customerId) và đánh
 * dấu đã nhận cọc — số tiền lấy từ kết quả AI vision đọc được trên ảnh
 * (classifyImage ở ai.ts); nếu AI không đọc được số tiền cụ thể, coi như nhận
 * đủ tiền còn thiếu (`remaining`) vì khả năng cao khách chuyển đúng số cần
 * cọc khi đã có ảnh chuyển khoản thật gửi vào đúng lúc đang chờ cọc.
 */
export function confirmDepositFromScreenshot(state: StateSnapshot, customer: CustomerShape, extractedAmount?: number): ConfirmDepositResult {
  const orders = ordersOf(state).filter((o) => o.customerId === customer.id && o.status === "new");
  orders.sort((a, b) => String(b.date ?? "").localeCompare(String(a.date ?? "")));
  const order = orders[0];
  if (!order) return { ok: false, reason: "no_pending_order" };

  const amount = extractedAmount && extractedAmount > 0 ? extractedAmount : order.remaining ?? 0;
  order.deposit = (order.deposit ?? 0) + amount;
  order.remaining = Math.max(0, (order.total ?? 0) - order.deposit);
  order.status = "deposited";

  return { ok: true, orderCode: order.code, amount, remaining: order.remaining };
}
