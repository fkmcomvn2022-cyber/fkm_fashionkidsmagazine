/**
 * Sổ quyết toán công thợ — phần học theo từ bản Apps Script
 * (`api_settleCrewPayment_impl` → sheet `Thanh_Toan_Cong_Tho`), gap lớn nhất
 * được ghi lại ở [[fkm-studio-apps-script-reference]]. fkm-studio trước đây
 * chỉ có `Staff.paidThisMonth/owedThisMonth` tự khai báo tay, không có cách
 * tự tính tiền công theo danh sách đơn thật trong 1 khoảng ngày.
 *
 * Mô hình tính tiền công cho 1 đơn + 1 vai trò (`crewCostForOrderRole`):
 * 1. Nếu concept của đơn có set công thợ riêng (`crewCostPhoto`/
 *    `crewCostMakeupChild`/`Adult`/`crewCostStylist`/`crewCostRetouchPerPerson`)
 *    — dùng mức đó (giống Apps Script: công phụ thuộc concept, không phụ
 *    thuộc ai làm).
 * 2. Nếu không, fallback theo `Staff.payType/rate` của nhân sự được gán vai
 *    trò đó trên đơn (mô hình gốc của fkm-studio): "Theo ca" = 1 mức/đơn,
 *    "Theo giờ" = rate × (durationMin/60), "Theo ngày" = 1 mức/ngày làm việc
 *    (gộp nếu nhân sự có nhiều đơn cùng ngày trong đợt quyết toán, tránh tính
 *    trùng), "Theo tháng" = KHÔNG tính theo đơn (lương cố định, bỏ qua những
 *    đơn này khi xem trước).
 */
import type { Concept, CrewSettlement, CrewSettlementItem, CrewSettlementRole, Order, Staff } from "@/types";
import { orders } from "./orders";
import { staff, staffById } from "./staff";
import { conceptById } from "./concepts";
import { nextNumericId } from "@/lib/nextId";

function roleStaffId(order: Order, role: CrewSettlementRole): string | undefined {
  switch (role) {
    case "Photo":
      return order.photoStaffId;
    case "Makeup":
      return order.makeupStaffId;
    case "Stylist":
      return order.stylistStaffId;
    case "Retoucher":
      return order.retoucherId;
  }
}

/** Mức công concept override cho 1 vai trò, nếu concept có set — undefined = chưa set, dùng fallback theo nhân sự. */
function conceptCrewOverride(concept: Concept | undefined, role: CrewSettlementRole, order: Order): number | undefined {
  if (!concept) return undefined;
  if (role === "Makeup" && (concept.crewCostMakeupChild != null || concept.crewCostMakeupAdult != null)) {
    const kids = order.people.filter((p) => p.audience === "Trẻ em").length;
    const adults = order.people.filter((p) => p.audience === "Người lớn").length;
    return kids * (concept.crewCostMakeupChild ?? 0) + adults * (concept.crewCostMakeupAdult ?? 0);
  }
  if (role === "Photo" && concept.crewCostPhoto != null) return concept.crewCostPhoto;
  if (role === "Stylist" && concept.crewCostStylist != null) return concept.crewCostStylist;
  if (role === "Retoucher" && concept.crewCostRetouchPerPerson != null) return concept.crewCostRetouchPerPerson * order.people.length;
  return undefined;
}

/** true nếu nhân sự "Theo tháng" và concept KHÔNG override — nghĩa là đơn
 * này không có tiền công tính riêng (đã nằm trong lương tháng cố định). */
function isMonthlyNoOverride(s: Staff, override: number | undefined): boolean {
  return override == null && s.payType === "Theo tháng";
}

function fallbackRate(s: Staff, order: Order): number {
  switch (s.payType) {
    case "Theo ca":
      return s.rate;
    case "Theo giờ":
      return s.rate * (order.durationMin / 60);
    case "Theo ngày":
      return s.rate; // gộp trùng ngày xử lý ở computeSettlementPreview
    case "Theo tháng":
      return 0;
  }
}

export interface SettlementCandidate {
  order: Order;
  staffId: string;
  amount: number;
  dedupedSameDay: boolean;
}

export interface SettlementPreview {
  role: CrewSettlementRole;
  staffId?: string;
  fromDate: string;
  toDate: string;
  candidates: SettlementCandidate[];
  total: number;
  /** số đơn bị bỏ qua vì nhân sự lương tháng + concept chưa set công riêng — không có gì để tính theo đơn. */
  skippedMonthlyCount: number;
}

/**
 * Xem trước 1 đợt quyết toán: lọc đơn trong khoảng ngày, đúng vai trò, (tuỳ
 * chọn) đúng 1 nhân sự, CHƯA từng quyết toán vai trò này (`crewSettledRoles`),
 * tính tiền công từng đơn, gộp trùng "Theo ngày". Không ghi gì cả — chỉ tính
 * để hiển thị cho người dùng xác nhận trước khi `confirmCrewSettlement`.
 */
export function previewCrewSettlement(input: {
  role: CrewSettlementRole;
  staffId?: string;
  fromDate: string;
  toDate: string;
}): SettlementPreview {
  const { role, staffId, fromDate, toDate } = input;
  let skippedMonthlyCount = 0;

  const raw: SettlementCandidate[] = [];
  for (const order of orders) {
    if (order.status === "cancelled") continue;
    if (order.date < fromDate || order.date > toDate) continue;
    const assignedStaffId = roleStaffId(order, role);
    if (!assignedStaffId) continue;
    if (staffId && assignedStaffId !== staffId) continue;
    if (order.crewSettledRoles?.includes(role)) continue;

    const s = staffById(assignedStaffId);
    if (!s) continue;
    const concept = conceptById(order.conceptId);
    const override = conceptCrewOverride(concept, role, order);

    if (isMonthlyNoOverride(s, override)) {
      skippedMonthlyCount += 1;
      continue;
    }

    const amount = override ?? fallbackRate(s, order);
    raw.push({ order, staffId: assignedStaffId, amount, dedupedSameDay: false });
  }

  // Gộp trùng ngày cho nhân sự "Theo ngày" (không có concept override) — chỉ
  // tính 1 lần/ngày dù nhân sự đó có nhiều đơn cùng ngày trong đợt quyết toán.
  const dayRateSeen = new Set<string>();
  for (const c of raw) {
    const s = staffById(c.staffId);
    const concept = conceptById(c.order.conceptId);
    const override = conceptCrewOverride(concept, role, c.order);
    if (override != null || !s || s.payType !== "Theo ngày") continue;
    const key = `${c.staffId}|${c.order.date}`;
    if (dayRateSeen.has(key)) {
      c.amount = 0;
      c.dedupedSameDay = true;
    } else {
      dayRateSeen.add(key);
    }
  }

  const total = raw.reduce((sum, c) => sum + c.amount, 0);
  raw.sort((a, b) => (a.order.date < b.order.date ? -1 : a.order.date > b.order.date ? 1 : 0));

  return { role, staffId, fromDate, toDate, candidates: raw, total, skippedMonthlyCount };
}

export const crewSettlements: CrewSettlement[] = [];

export const crewSettlementById = (id: string) => crewSettlements.find((c) => c.id === id);

/**
 * Ghi 1 đợt quyết toán thật từ kết quả `previewCrewSettlement` — đánh dấu
 * từng đơn đã trả công vai trò này (`crewSettledRoles`, chặn tính trùng lần
 * sau), và CHUYỂN `owedThisMonth` → `paidThisMonth` cho nhân sự nếu quyết
 * toán cho đúng 1 người (staffId set); quyết toán "tất cả nhân sự có vai trò
 * này" thì không tự trừ nợ từng người vì preview gộp nhiều người vào 1 dòng
 * tổng — sửa nợ từng người vẫn làm được tay qua "Thanh toán" trên StaffCard.
 */
export function confirmCrewSettlement(preview: SettlementPreview, note?: string): CrewSettlement {
  const items: CrewSettlementItem[] = preview.candidates.map((c) => ({
    orderId: c.order.id,
    orderCode: c.order.code,
    date: c.order.date,
    staffId: c.staffId,
    amount: c.amount,
    dedupedSameDay: c.dedupedSameDay || undefined,
  }));

  const seq = nextNumericId("ttct", crewSettlements);
  const settlement: CrewSettlement = {
    id: `ttct${seq}`,
    createdAt: new Date().toISOString(),
    role: preview.role,
    staffId: preview.staffId,
    fromDate: preview.fromDate,
    toDate: preview.toDate,
    items,
    total: preview.total,
    note,
  };
  crewSettlements.push(settlement);

  for (const c of preview.candidates) {
    const roles = c.order.crewSettledRoles ?? [];
    if (!roles.includes(preview.role)) {
      c.order.crewSettledRoles = [...roles, preview.role];
    }
  }

  if (preview.staffId) {
    const s = staffById(preview.staffId);
    if (s) {
      const pay = Math.min(s.owedThisMonth, preview.total);
      s.owedThisMonth = Math.max(0, s.owedThisMonth - pay);
      s.paidThisMonth = s.paidThisMonth + pay;
    }
  }

  return settlement;
}

/** Danh sách nhân sự hợp lệ cho 1 vai trò quyết toán — dùng cho dropdown "Nhân sự" trong UI quyết toán. */
export function staffForCrewRole(role: CrewSettlementRole): Staff[] {
  return staff.filter((s) => s.role === role && s.active);
}
