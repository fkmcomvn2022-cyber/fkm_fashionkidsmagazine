import type { Audience, ExtraRole, Order, OrderKind, OrderPerson, OrderStatus, PromoType } from "@/types";
import { addonServices } from "./inventory";
import { conceptById } from "./concepts";
import { findOrCreateCustomer, customerById } from "./customers";
import { staffById } from "./staff";
import { nextNumericId } from "@/lib/nextId";

// Week anchored around "today" = 2026-06-25 (Thursday)
export const orders: Order[] = [
  {
    id: "o1",
    code: "FKM-2606-01",
    customerId: "u1",
    conceptId: "c1",
    date: "2026-06-22",
    time: "08:00",
    durationMin: 90,
    people: [{ id: "p1", name: "Nguyễn Thị Mai", audience: "Người lớn", age: 29, outfitSize: "M", conceptId: "c1" }],
    addonServiceIds: ["sv1"],
    total: 2490000,
    deposit: 1000000,
    remaining: 1490000,
    status: "completed",
    photoLinks: { folder: "https://drive.google.com/folder1", raw: "https://drive.google.com/raw1", selected: "https://drive.google.com/sel1", final: "https://drive.google.com/final1" },
    photoStaffId: "s1",
    makeupStaffId: "s2",
    retoucherId: "s4",
    photosToEdit: 0,
  },
  {
    id: "o2",
    code: "FKM-2606-02",
    customerId: "u2",
    conceptId: "c2",
    date: "2026-06-23",
    time: "09:00",
    durationMin: 60,
    people: [{ id: "p2", name: "Bé Tôm", audience: "Trẻ em", age: 5, outfitSize: "S", conceptId: "c2" }],
    addonServiceIds: [],
    total: 1490000,
    deposit: 500000,
    remaining: 990000,
    status: "editing",
    photoStaffId: "s5",
    makeupStaffId: "s3",
    retoucherId: "s7",
    photosToEdit: 18,
  },
  {
    id: "o3",
    code: "FKM-2606-03",
    customerId: "u3",
    conceptId: "c3",
    date: "2026-06-24",
    time: "14:00",
    durationMin: 120,
    people: [{ id: "p3", name: "Lê Thị Hương", audience: "Người lớn", age: 34, outfitSize: "L", conceptId: "c3" }],
    addonServiceIds: ["sv2"],
    total: 2990000,
    deposit: 1500000,
    remaining: 1490000,
    status: "selecting",
    photoStaffId: "s1",
    makeupStaffId: "s2",
    photosToEdit: 0,
  },
  {
    id: "o4",
    code: "FKM-2606-04",
    customerId: "u4",
    conceptId: "c2",
    date: "2026-06-25",
    time: "08:00",
    durationMin: 60,
    people: [{ id: "p4", name: "Bé Gia Bảo", audience: "Trẻ em", age: 6, outfitSize: "S", conceptId: "c2" }],
    addonServiceIds: [],
    total: 1490000,
    deposit: 1490000,
    remaining: 0,
    status: "shooting",
    photoStaffId: "s5",
    makeupStaffId: "s3",
  },
  {
    id: "o5",
    code: "FKM-2606-05",
    customerId: "u5",
    conceptId: "c4",
    date: "2026-06-25",
    time: "10:00",
    durationMin: 90,
    people: [
      { id: "p5a", name: "Đỗ Thanh Tùng", audience: "Người lớn", age: 38, outfitSize: "L", conceptId: "c4" },
      { id: "p5b", name: "Vợ anh Tùng", audience: "Người lớn", age: 35, outfitSize: "M", conceptId: "c4" },
      { id: "p5c", name: "Bé Tũn", audience: "Trẻ em", age: 4, outfitSize: "S", conceptId: "c4" },
    ],
    addonServiceIds: ["sv1", "sv3"],
    total: 3990000,
    deposit: 2000000,
    remaining: 1990000,
    status: "scheduled",
    photoStaffId: "s1",
    makeupStaffId: "s2",
    stylistStaffId: "s3",
  },
  {
    id: "o6",
    code: "FKM-2606-06",
    customerId: "u6",
    conceptId: "c1",
    date: "2026-06-25",
    time: "15:00",
    durationMin: 90,
    people: [{ id: "p6", name: "Vũ Ngọc Anh", audience: "Người lớn", age: 27, outfitSize: "S", conceptId: "c1" }],
    addonServiceIds: [],
    total: 1990000,
    deposit: 0,
    remaining: 1990000,
    status: "deposited",
    notes: "Khách hẹn chuyển cọc trước 16h",
  },
  {
    id: "o7",
    code: "FKM-2606-07",
    customerId: "u7",
    conceptId: "c2",
    date: "2026-06-26",
    time: "09:00",
    durationMin: 60,
    people: [{ id: "p7", name: "Bé Lan Anh", audience: "Trẻ em", age: 3, outfitSize: "S", conceptId: "c2" }],
    addonServiceIds: [],
    total: 1490000,
    deposit: 500000,
    remaining: 990000,
    status: "scheduled",
  },
  {
    id: "o8",
    code: "FKM-2606-08",
    customerId: "u1",
    conceptId: "c3",
    date: "2026-06-26",
    time: "14:00",
    durationMin: 120,
    people: [{ id: "p8", name: "Nguyễn Thị Mai", audience: "Người lớn", age: 29, outfitSize: "M", conceptId: "c3" }],
    addonServiceIds: ["sv2"],
    total: 2990000,
    deposit: 1000000,
    remaining: 1990000,
    status: "new",
    notes: "Trùng giờ với lịch của studio chi nhánh 2 — cần xác nhận lại",
  },
  {
    id: "o9",
    code: "FKM-2606-09",
    customerId: "u3",
    conceptId: "c4",
    date: "2026-06-27",
    time: "08:00",
    durationMin: 90,
    people: [
      { id: "p9a", name: "Lê Thị Hương", audience: "Người lớn", age: 34, outfitSize: "L", conceptId: "c4" },
      { id: "p9b", name: "Con gái", audience: "Trẻ em", age: 8, outfitSize: "M", conceptId: "c4" },
    ],
    addonServiceIds: [],
    total: 2990000,
    deposit: 1500000,
    remaining: 1490000,
    status: "scheduled",
  },
  {
    id: "o10",
    code: "FKM-2606-10",
    customerId: "u5",
    conceptId: "c1",
    date: "2026-06-28",
    time: "09:00",
    durationMin: 90,
    people: [{ id: "p10", name: "Đỗ Thanh Tùng", audience: "Người lớn", age: 38, outfitSize: "L", conceptId: "c1" }],
    addonServiceIds: [],
    total: 1990000,
    deposit: 1990000,
    remaining: 0,
    status: "scheduled",
  },
];

export const ordersByDate = (date: string) => orders.filter((o) => o.date === date);
export const orderById = (id: string) => orders.find((o) => o.id === id);
export const ordersByCustomer = (customerId: string) =>
  orders.filter((o) => o.customerId === customerId);

export interface CreateOrderPersonInput {
  name: string;
  audience: Audience;
  age?: number;
  outfitSize?: string;
  conceptId: string; // concept dùng để tính giá riêng cho người này
}

export interface CreateOrderInput {
  kind?: OrderKind;
  source?: string;
  customerName: string;
  customerPhone?: string;
  socialContact?: string; // Facebook/Zalo
  mainDob?: string; // ngày sinh khách/bé chính
  date: string; // ISO date
  time: string; // HH:mm
  people: CreateOrderPersonInput[];
  /** Concept chính dùng để tính thời lượng chụp/makeup cho lịch (mặc định: concept người đầu tiên). */
  primaryConceptId?: string;
  photoStaffId?: string;
  makeupStaffId?: string;
  stylistStaffId?: string;
  retoucherId?: string;
  extraRoles?: ExtraRole[];
  addonServiceIds?: string[];
  surcharge?: number; // phụ thu nhanh nhập tay
  promoType?: PromoType;
  promoValue?: number; // số tiền (Giảm tiền) hoặc % (Giảm %/Khách VIP nếu có nhập)
  promoNote?: string;
  deposit?: number; // đã thu/cọc
  notes?: string;
  /** true = người dùng đã xem cảnh báo trùng ca/concept chưa mở và xác nhận
   * vẫn muốn tạo — bỏ qua chặn, giống cờ `Allow_Conflict` của bản Apps Script.
   * Mặc định false: có vấn đề thì chặn, ném `OrderValidationError`. */
  allowConflict?: boolean;
}

export interface OrderPricingBreakdown {
  subtotal: number; // tổng giá concept theo từng người (TE/NL)
  addonsTotal: number;
  surcharge: number;
  discount: number;
  total: number; // phải thu
}

/**
 * Tính giá đơn hàng từ danh sách người chụp (mỗi người 1 concept + đối tượng
 * TE/NL riêng) + dịch vụ bổ trợ + phụ thu + ưu đãi nhập tay. Hàm thuần (không
 * ghi dữ liệu) để cả createOrder() và form "Tạo đơn hàng" (hiển thị live
 * "Đang tính: ...") dùng chung, tránh lệch công thức giữa preview và lúc lưu.
 */
export function computeOrderPricing(
  people: CreateOrderPersonInput[],
  addonServiceIds: string[] = [],
  surcharge = 0,
  promoType: PromoType = "Không có",
  promoValue = 0,
): OrderPricingBreakdown {
  const subtotal = people.reduce((sum, p) => {
    const concept = conceptById(p.conceptId);
    if (!concept) return sum;
    const price = p.audience === "Trẻ em" ? concept.priceChild : concept.priceAdult;
    return sum + price;
  }, 0);

  const addonsTotal = addonServiceIds.reduce((sum, id) => {
    const svc = addonServices.find((s) => s.id === id);
    return sum + (svc?.price ?? 0);
  }, 0);

  const baseForPercent = subtotal + addonsTotal + surcharge;
  let discount = 0;
  if (promoType === "Giảm tiền") {
    discount = Math.max(0, promoValue || 0);
  } else if (promoType === "Giảm %" || (promoType === "Khách VIP" && promoValue)) {
    discount = Math.round((baseForPercent * Math.max(0, promoValue || 0)) / 100);
  }

  const total = Math.max(0, baseForPercent - discount);
  return { subtotal, addonsTotal, surcharge, discount, total };
}

// ---------------------------------------------------------------------------
// Validate tạo/sửa đơn chặt hơn — học theo `findOpenConcept_`/
// `orderSlotConflicts_`/`Allow_Conflict` của bản Apps Script (xem
// [[fkm-studio-apps-script-reference]]): KHÔNG cho tạo đơn nếu concept chưa
// mở bán, và báo cụ thể từng ca đang trùng ekip (giờ + tên khách + SĐT)
// trước khi cho người dùng xác nhận đè. Đây là validate Ở TẦNG DỮ LIỆU (data
// layer), không chỉ ở UI — để createOrder/updateOrder luôn là điểm chặn cuối
// cùng dù gọi từ đâu (QuickOrderForm, import hàng loạt sau này...).
// ---------------------------------------------------------------------------

export type OrderValidationIssueKind = "concept_not_open" | "staff_conflict";

export interface OrderValidationIssue {
  kind: OrderValidationIssueKind;
  message: string; // tiếng Việt, đủ chi tiết để hiển thị trực tiếp cho người dùng
}

/** Lỗi chặn tạo/sửa đơn khi có vấn đề validate mà chưa được xác nhận đè
 * (`allowConflict`). UI bắt lỗi này, hiển thị `issues` + nút "Vẫn tạo đơn". */
export class OrderValidationError extends Error {
  issues: OrderValidationIssue[];
  constructor(issues: OrderValidationIssue[]) {
    super(issues.map((i) => i.message).join(" "));
    this.name = "OrderValidationError";
    this.issues = issues;
  }
}

function toMin(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

/** Concept chưa "active" (đang tạm dừng/đã đóng) thì coi như chưa mở bán —
 * fkm-studio chưa có lịch mở bán theo từng ngày như `findOpenConcept_` của
 * bản Apps Script (chỉ có 1 cờ trạng thái chung), nên đây là phần tương đương
 * gần nhất: chặn tạo đơn cho concept không ở trạng thái "active". */
function conceptNotOpenIssue(conceptId: string): OrderValidationIssue | undefined {
  const concept = conceptById(conceptId);
  if (!concept) return undefined;
  if (concept.status === "active") return undefined;
  const label = concept.status === "paused" ? "đang tạm dừng" : "đã đóng";
  return { kind: "concept_not_open", message: `Concept "${concept.name}" ${label}, chưa mở bán — vẫn tạo đơn nếu khách đặc biệt cần.` };
}

/** Quy mô "chiếm ekip" gần đúng của 1 đơn (trang điểm rồi chụp nối tiếp) —
 * dùng riêng cho việc BÁO TRÙNG ca (cảnh báo, không phải lịch thật), nên lấy
 * gần đúng theo concept chính, không chạy lại toàn bộ mô phỏng băng chuyền
 * (`simulateCandidate` ở `lib/scheduling.ts`) để tránh import vòng (orders.ts
 * <-> lib/scheduling.ts đều phụ thuộc "@/data"). */
function approxEngagementMin(conceptId: string, peopleCount: number): number {
  const concept = conceptById(conceptId);
  const people = Math.max(1, peopleCount);
  const makeup = (concept?.makeupMin ?? 30) * people;
  const shoot = concept?.durationMin ?? 60;
  return makeup + shoot;
}

interface StaffSlotInput {
  date: string;
  time: string;
  conceptId: string;
  peopleCount: number;
  photoStaffId?: string;
  makeupStaffId?: string;
  stylistStaffId?: string;
  retoucherId?: string;
  /** Loại khi sửa đơn — không tự báo trùng với chính đơn đang sửa. */
  excludeOrderId?: string;
}

const ROLE_FIELD: Record<"Photo" | "Makeup" | "Stylist" | "Retoucher", keyof Order> = {
  Photo: "photoStaffId",
  Makeup: "makeupStaffId",
  Stylist: "stylistStaffId",
  Retoucher: "retoucherId",
};

/** Báo cụ thể từng ca đang trùng ekip (cùng nhân sự, khoảng giờ chồng lấn,
 * khác đơn) — giờ + tên khách + SĐT, giống cách `orderSlotConflicts_` của bản
 * Apps Script báo lỗi trước khi cho xác nhận đè (`Allow_Conflict`). */
function staffConflictIssues(input: StaffSlotInput): OrderValidationIssue[] {
  const start = toMin(input.time);
  const end = start + approxEngagementMin(input.conceptId, input.peopleCount);
  const roleAssignments: { role: "Photo" | "Makeup" | "Stylist" | "Retoucher"; staffId?: string }[] = [
    { role: "Photo", staffId: input.photoStaffId },
    { role: "Makeup", staffId: input.makeupStaffId },
    { role: "Stylist", staffId: input.stylistStaffId },
    { role: "Retoucher", staffId: input.retoucherId },
  ];

  const issues: OrderValidationIssue[] = [];
  for (const { role, staffId } of roleAssignments) {
    if (!staffId) continue;
    const staffMember = staffById(staffId);
    if (!staffMember) continue;
    const field = ROLE_FIELD[role];

    for (const other of orders) {
      if (other.id === input.excludeOrderId) continue;
      if (other.status === "cancelled") continue;
      if (other.date !== input.date) continue;
      if (other[field] !== staffId) continue;

      const otherStart = toMin(other.time);
      const otherEnd = otherStart + approxEngagementMin(other.conceptId, other.people.length);
      const overlaps = start < otherEnd && end > otherStart;
      if (!overlaps) continue;

      const customer = customerById(other.customerId);
      issues.push({
        kind: "staff_conflict",
        message: `${role === "Photo" ? "Photo" : role === "Makeup" ? "Makeup" : role === "Stylist" ? "Stylist" : "Retoucher"} "${staffMember.name}" đang trùng ca ${other.time} (đơn ${other.code}) của khách ${customer?.name ?? "—"}${customer?.phone ? ` · ${customer.phone}` : ""}.`,
      });
    }
  }
  return issues;
}

interface ValidateOrderInput {
  date: string;
  time: string;
  people: { conceptId: string }[];
  photoStaffId?: string;
  makeupStaffId?: string;
  stylistStaffId?: string;
  retoucherId?: string;
  excludeOrderId?: string;
}

/**
 * Kiểm tra trước khi tạo/sửa đơn — trả về danh sách vấn đề (rỗng = không có
 * gì chặn). Hàm thuần, không ghi gì — cả `createOrder`/`updateOrder` (chặn
 * thật) và UI (xem trước trước khi bấm Lưu) đều gọi hàm này để khỏi lệch luật.
 */
export function previewOrderIssues(input: ValidateOrderInput): OrderValidationIssue[] {
  const issues: OrderValidationIssue[] = [];
  const seenConcepts = new Set<string>();
  for (const p of input.people) {
    if (!p.conceptId || seenConcepts.has(p.conceptId)) continue;
    seenConcepts.add(p.conceptId);
    const issue = conceptNotOpenIssue(p.conceptId);
    if (issue) issues.push(issue);
  }

  const primaryConceptId = input.people[0]?.conceptId ?? "";
  issues.push(
    ...staffConflictIssues({
      date: input.date,
      time: input.time,
      conceptId: primaryConceptId,
      peopleCount: input.people.length,
      photoStaffId: input.photoStaffId,
      makeupStaffId: input.makeupStaffId,
      stylistStaffId: input.stylistStaffId,
      retoucherId: input.retoucherId,
      excludeOrderId: input.excludeOrderId,
    }),
  );

  return issues;
}

/**
 * Tạo 1 đơn hàng thật từ form "Tạo đơn hàng" (QuickAdd): tìm/tạo khách hàng,
 * tính giá theo từng người chụp (TE/NL theo concept riêng), ghi đơn mới vào
 * `orders` và cập nhật thống kê của khách. Đây là điểm ghi dữ liệu duy nhất
 * cho luồng tạo đơn — mọi hàm tính lịch khác (computeStudioTimeline,
 * computeMiniDayCells...) chỉ đọc lại từ `orders` nên sẽ tự thấy đơn mới ở
 * lần render kế tiếp.
 */
export function createOrder(input: CreateOrderInput): Order {
  const customer = findOrCreateCustomer(input.customerName, input.customerPhone, input.socialContact);
  const peopleInput = input.people.length > 0 ? input.people : [{ name: customer.name, audience: "Người lớn" as Audience, conceptId: input.primaryConceptId ?? "" }];

  const primaryConceptId = input.primaryConceptId ?? peopleInput[0]?.conceptId ?? "";
  const primaryConcept = conceptById(primaryConceptId);

  if (!input.allowConflict) {
    const issues = previewOrderIssues({
      date: input.date,
      time: input.time,
      people: peopleInput.map((p) => ({ conceptId: p.conceptId || primaryConceptId })),
      photoStaffId: input.photoStaffId,
      makeupStaffId: input.makeupStaffId,
      stylistStaffId: input.stylistStaffId,
      retoucherId: input.retoucherId,
    });
    if (issues.length > 0) throw new OrderValidationError(issues);
  }

  const seq = nextNumericId("o", orders);
  const people: OrderPerson[] = peopleInput.map((p, i) => ({
    id: `p${seq}_${i}`,
    name: p.name.trim() || `${customer.name} #${i + 1}`,
    audience: p.audience,
    age: p.age,
    outfitSize: p.outfitSize,
    conceptId: p.conceptId || primaryConceptId,
  }));

  const addonServiceIds = input.addonServiceIds ?? [];
  const pricing = computeOrderPricing(peopleInput, addonServiceIds, input.surcharge ?? 0, input.promoType ?? "Không có", input.promoValue ?? 0);
  const deposit = Math.max(0, input.deposit ?? 0);

  if (input.promoType === "Khách VIP") customer.tag = "VIP";

  const order: Order = {
    id: `o${seq}`,
    code: `FKM-${input.date.slice(5).replace("-", "")}-${String(seq).padStart(2, "0")}`,
    customerId: customer.id,
    conceptId: primaryConceptId,
    kind: input.kind ?? "Chụp studio",
    source: input.source,
    socialContact: input.socialContact,
    mainDob: input.mainDob,
    date: input.date,
    time: input.time,
    durationMin: primaryConcept?.durationMin ?? 60,
    people,
    addonServiceIds,
    surcharge: input.surcharge ?? 0,
    promoType: input.promoType ?? "Không có",
    promoValue: input.promoValue ?? 0,
    promoNote: input.promoNote,
    extraRoles: input.extraRoles ?? [],
    total: pricing.total,
    deposit,
    remaining: Math.max(0, pricing.total - deposit),
    status: deposit > 0 ? "deposited" : "new",
    photoStaffId: input.photoStaffId,
    makeupStaffId: input.makeupStaffId,
    stylistStaffId: input.stylistStaffId,
    retoucherId: input.retoucherId,
    notes: input.notes,
  };

  orders.push(order);
  customer.totalOrders += 1;
  customer.totalSpent += pricing.total;
  return order;
}

export interface UpdateOrderInput {
  kind?: OrderKind;
  source?: string;
  date?: string;
  time?: string;
  people?: CreateOrderPersonInput[];
  /** Concept chính — đổi thì cập nhật lại `conceptId`/`durationMin` của đơn. */
  primaryConceptId?: string;
  photoStaffId?: string;
  makeupStaffId?: string;
  stylistStaffId?: string;
  retoucherId?: string;
  extraRoles?: ExtraRole[];
  addonServiceIds?: string[];
  surcharge?: number;
  promoType?: PromoType;
  promoValue?: number;
  promoNote?: string;
  deposit?: number;
  notes?: string;
  /** Xem `CreateOrderInput.allowConflict` — bỏ qua chặn nếu người dùng đã xác nhận. */
  allowConflict?: boolean;
}

/**
 * Sửa 1 đơn hàng đã tồn tại — mutate trực tiếp object trong `orders` (không
 * push/replace), vì mọi nơi đang giữ tham chiếu tới đúng object này (vd.
 * `openOrder` state ở SchedulePage) sẽ tự thấy giá trị mới ngay khi
 * bumpDataVersion() làm component render lại, không cần truyền lại object
 * mới. Không đổi khách hàng (customerId) — sửa khách là việc khác, ngoài
 * phạm vi hàm này. Giá tự tính lại từ people/addon/phụ thu/ưu đãi hiện tại
 * bằng đúng computeOrderPricing() dùng chung với lúc tạo đơn, để không lệch
 * công thức. KHÔNG tự đổi `status` — sửa thông tin đơn không được âm thầm
 * lùi/tiến trạng thái vận hành đã có (xem setOrderStatus/cancelOrder/
 * recordPayment cho việc đổi trạng thái/tiền).
 */
export function updateOrder(id: string, patch: UpdateOrderInput): Order | undefined {
  const order = orderById(id);
  if (!order) return undefined;

  if (!patch.allowConflict) {
    const nextPeople = patch.people ?? order.people.map((p) => ({ conceptId: p.conceptId }));
    const issues = previewOrderIssues({
      date: patch.date ?? order.date,
      time: patch.time ?? order.time,
      people: nextPeople.map((p) => ({ conceptId: p.conceptId || patch.primaryConceptId || order.conceptId })),
      photoStaffId: patch.photoStaffId !== undefined ? patch.photoStaffId || undefined : order.photoStaffId,
      makeupStaffId: patch.makeupStaffId !== undefined ? patch.makeupStaffId || undefined : order.makeupStaffId,
      stylistStaffId: patch.stylistStaffId !== undefined ? patch.stylistStaffId || undefined : order.stylistStaffId,
      retoucherId: patch.retoucherId !== undefined ? patch.retoucherId || undefined : order.retoucherId,
      excludeOrderId: order.id,
    });
    if (issues.length > 0) throw new OrderValidationError(issues);
  }

  if (patch.kind !== undefined) order.kind = patch.kind;
  if (patch.source !== undefined) order.source = patch.source;
  if (patch.date !== undefined) order.date = patch.date;
  if (patch.time !== undefined) order.time = patch.time;
  if (patch.photoStaffId !== undefined) order.photoStaffId = patch.photoStaffId || undefined;
  if (patch.makeupStaffId !== undefined) order.makeupStaffId = patch.makeupStaffId || undefined;
  if (patch.stylistStaffId !== undefined) order.stylistStaffId = patch.stylistStaffId || undefined;
  if (patch.retoucherId !== undefined) order.retoucherId = patch.retoucherId || undefined;
  if (patch.extraRoles !== undefined) order.extraRoles = patch.extraRoles;
  if (patch.promoNote !== undefined) order.promoNote = patch.promoNote;
  if (patch.notes !== undefined) order.notes = patch.notes;

  if (patch.people !== undefined) {
    const seq = id.replace(/^o/, "");
    order.people = patch.people.map((p, i) => ({
      id: order.people[i]?.id ?? `p${seq}_${i}`,
      name: p.name.trim() || `Người chụp #${i + 1}`,
      audience: p.audience,
      age: p.age,
      outfitSize: p.outfitSize,
      conceptId: p.conceptId || order.conceptId,
    }));
  }

  if (patch.primaryConceptId) {
    order.conceptId = patch.primaryConceptId;
    const concept = conceptById(patch.primaryConceptId);
    if (concept) order.durationMin = concept.durationMin;
  }

  if (patch.addonServiceIds !== undefined) order.addonServiceIds = patch.addonServiceIds;
  if (patch.surcharge !== undefined) order.surcharge = patch.surcharge;
  if (patch.promoType !== undefined) order.promoType = patch.promoType;
  if (patch.promoValue !== undefined) order.promoValue = patch.promoValue;

  const peopleForPricing: CreateOrderPersonInput[] = order.people.map((p) => ({
    name: p.name,
    audience: p.audience,
    age: p.age,
    outfitSize: p.outfitSize,
    conceptId: p.conceptId,
  }));
  const pricing = computeOrderPricing(
    peopleForPricing,
    order.addonServiceIds,
    order.surcharge ?? 0,
    order.promoType ?? "Không có",
    order.promoValue ?? 0,
  );
  order.total = pricing.total;

  if (patch.deposit !== undefined) order.deposit = Math.max(0, patch.deposit);
  order.remaining = Math.max(0, order.total - order.deposit);

  return order;
}

/**
 * Đổi trạng thái vận hành của 1 đơn (vd. "Đang chụp" -> "Đã chụp") — chỉ đổi
 * đúng field `status`, không đụng tới tiền/thông tin khác.
 */
export function setOrderStatus(id: string, status: OrderStatus): Order | undefined {
  const order = orderById(id);
  if (!order) return undefined;
  order.status = status;
  return order;
}

/** Huỷ đơn — set status "cancelled". Không xoá đơn khỏi danh sách (vẫn giữ
 * lịch sử), chỉ đổi trạng thái hiển thị. */
export function cancelOrder(id: string): Order | undefined {
  return setOrderStatus(id, "cancelled");
}

/**
 * Phase 5 — studio dán danh sách link ảnh riêng (mỗi ảnh 1 link) để khách
 * chọn qua cổng `/chon-anh/:orderId`. Giữ lại `selectedUrls` cũ nếu có (vd.
 * studio sửa/bổ sung thêm ảnh sau khi khách đã chọn 1 phần).
 */
export function setOrderPhotoSelectionItems(id: string, items: string[]): Order | undefined {
  const order = orderById(id);
  if (!order) return undefined;
  order.photoSelection = { ...order.photoSelection, items, selectedUrls: order.photoSelection?.selectedUrls ?? [] };
  return order;
}

/**
 * Đồng bộ lại kết quả chọn ảnh của khách vào dữ liệu app (chạy trong trình
 * duyệt studio). Khách KHÔNG ghi trực tiếp vào đây — khách nộp lựa chọn lên
 * backend (POST /api/orders/:id/photo-selection, ghi vào JSON mirror riêng
 * của backend), rồi app studio tự fetch lại kết quả mới nhất khi mở chi tiết
 * đơn (xem OrderDetailSheet) và gọi hàm này để cập nhật vào bản dữ liệu cục
 * bộ + lưu lại — vì backend hiện chỉ nhận ghi (Phase 0), chưa phải nguồn đọc
 * chính lúc mở app, nên phải đồng bộ điểm-tới-điểm như vậy cho riêng việc này. */
export function recordPhotoSelectionResult(id: string, selectedUrls: string[]): Order | undefined {
  const order = orderById(id);
  if (!order) return undefined;
  order.photoSelection = { items: order.photoSelection?.items ?? [], selectedUrls, completedAt: new Date().toISOString() };
  return order;
}

/**
 * Ghi nhận 1 khoản thu thật vào đơn (vd. khách chuyển khoản qua VietQR) —
 * cộng vào `deposit`, trừ lại `remaining`. Nếu đơn đang ở trạng thái "new"
 * (chưa cọc gì) thì tự chuyển sang "deposited" giống logic lúc tạo đơn lần
 * đầu; nếu đơn đã ở trạng thái vận hành xa hơn (đang chụp/đang sửa...) thì
 * giữ nguyên trạng thái đó, không lùi lại.
 */
export function recordPayment(id: string, amount: number): Order | undefined {
  const order = orderById(id);
  if (!order || amount <= 0) return order;
  order.deposit = Math.max(0, order.deposit + amount);
  order.remaining = Math.max(0, order.total - order.deposit);
  if (order.status === "new") order.status = "deposited";
  return order;
}
