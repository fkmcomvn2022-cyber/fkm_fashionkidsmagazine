import type { PayType, Staff, StaffContactChannel, StaffRole } from "@/types";
import { nextNumericId } from "@/lib/nextId";
import { orders } from "./orders";
import { concepts } from "./concepts";

export const staff: Staff[] = [
  { id: "s1", name: "Anh Khôi", role: "Photo", phone: "0901234567", zalo: "", payType: "Theo ca", rate: 400000, paidThisMonth: 4800000, owedThisMonth: 800000, active: true, bankBin: "", accountNumber: "", accountName: "", defaultContactChannel: "call" },
  { id: "s2", name: "Chị Linh", role: "Makeup", phone: "0912345678", zalo: "", payType: "Theo ca", rate: 250000, paidThisMonth: 3000000, owedThisMonth: 500000, active: true, bankBin: "", accountNumber: "", accountName: "", defaultContactChannel: "call" },
  { id: "s3", name: "Chị Trang", role: "Stylist", phone: "0923456789", zalo: "", payType: "Theo giờ", rate: 60000, paidThisMonth: 2160000, owedThisMonth: 240000, active: true, bankBin: "", accountNumber: "", accountName: "", defaultContactChannel: "call" },
  { id: "s4", name: "Em Phúc", role: "Retoucher", phone: "0934567890", zalo: "", payType: "Theo tháng", rate: 7000000, paidThisMonth: 7000000, owedThisMonth: 0, active: true, bankBin: "", accountNumber: "", accountName: "", defaultContactChannel: "call" },
  { id: "s5", name: "Anh Tuấn", role: "Photo", phone: "0945678901", zalo: "", payType: "Theo ca", rate: 400000, paidThisMonth: 3200000, owedThisMonth: 400000, active: true, bankBin: "", accountNumber: "", accountName: "", defaultContactChannel: "call" },
  { id: "s6", name: "Chị Hoa", role: "CSKH", phone: "0956789012", zalo: "", payType: "Theo tháng", rate: 6000000, paidThisMonth: 6000000, owedThisMonth: 0, active: true, bankBin: "", accountNumber: "", accountName: "", defaultContactChannel: "call" },
  { id: "s7", name: "Em Vy", role: "Retoucher", phone: "0967890123", zalo: "", payType: "Theo ngày", rate: 350000, paidThisMonth: 4200000, owedThisMonth: 700000, active: true, bankBin: "", accountNumber: "", accountName: "", defaultContactChannel: "call" },
];

export const staffById = (id: string) => staff.find((s) => s.id === id);

export interface CreateStaffInput {
  name: string;
  role?: StaffRole;
  phone?: string;
  zalo?: string;
  payType?: PayType;
  rate?: number;
  bankBin?: string;
  accountNumber?: string;
  accountName?: string;
  defaultContactChannel?: StaffContactChannel;
}

/** Tạo nhân sự mới từ form "Tạo nhân sự" (QuickAdd) — ô bỏ trống dùng mặc định
 * (vai trò Photo, hình thức "Theo ca", lương 0, đang hoạt động, chưa có STK). */
export function createStaff(input: CreateStaffInput): Staff {
  const seq = nextNumericId("s", staff);
  const member: Staff = {
    id: `s${seq}`,
    name: input.name.trim() || `Nhân sự #${seq}`,
    role: input.role ?? "Photo",
    phone: input.phone?.trim() ?? "",
    zalo: input.zalo?.trim() ?? "",
    payType: input.payType ?? "Theo ca",
    rate: input.rate ?? 0,
    paidThisMonth: 0,
    owedThisMonth: 0,
    active: true,
    bankBin: input.bankBin ?? "",
    accountNumber: input.accountNumber?.trim() ?? "",
    accountName: input.accountName?.trim() ?? "",
    defaultContactChannel: input.defaultContactChannel ?? "call",
  };
  staff.push(member);
  return member;
}

/**
 * Sửa thông tin liên lạc (SĐT/Zalo), vai trò, lương, và STK nhận lương của 1
 * nhân sự đã có — điểm ghi dữ liệu duy nhất cho sheet "Sửa nhân sự". Trước đây
 * KHÔNG có hàm này, chỉ tạo được lúc thêm mới (`createStaff`) chứ không sửa lại
 * được sau đó — đây là lý do nhân sự cũ không có chỗ bổ sung SĐT/STK.
 */
export function updateStaff(
  id: string,
  patch: Partial<Pick<Staff, "name" | "role" | "phone" | "zalo" | "facebookLink" | "payType" | "rate" | "bankBin" | "accountNumber" | "accountName" | "defaultContactChannel">>,
): Staff | undefined {
  const member = staffById(id);
  if (!member) return undefined;
  Object.assign(member, patch);
  return member;
}

/** Ngừng/Mở lại hoạt động — nhân sự "ngừng hoạt động" bị ẨN khỏi danh sách
 * chọn (ProfilePage filter theo `active`) nhưng KHÔNG mất lịch sử lương/đơn
 * cũ, vì các đơn cũ vẫn tham chiếu `staffId` của họ để tính quyết toán công
 * thợ đúng. Theo đúng pattern `toggleConceptStatus` (xem data/concepts.ts). */
export function toggleStaffStatus(id: string): Staff | undefined {
  const member = staffById(id);
  if (!member) return undefined;
  member.active = !member.active;
  return member;
}

export interface DeleteStaffResult {
  ok: boolean;
  reason?: string;
}

/**
 * Xóa thật 1 nhân sự khỏi danh sách — CHẶN nếu còn bất kỳ đơn nào (kể cả đơn
 * cũ/đã huỷ, để giữ đúng lịch sử quyết toán công thợ) đang gán nhân sự này ở
 * 1 trong các vai trò sản xuất hoặc vai trò phát sinh. Theo đúng pattern
 * `deleteConcept` (xem data/concepts.ts) — muốn ẨN mà vẫn giữ lịch sử, dùng
 * `toggleStaffStatus` (Ngừng hoạt động) thay vì xóa.
 */
export function deleteStaff(id: string): DeleteStaffResult {
  const member = staffById(id);
  if (!member) return { ok: false, reason: "Không tìm thấy nhân sự." };

  const inUse = orders.some(
    (o) =>
      o.photoStaffId === id ||
      o.makeupStaffId === id ||
      o.stylistStaffId === id ||
      o.retoucherId === id ||
      o.extraRoles?.some((r) => r.staffId === id),
  );
  if (inUse) {
    return {
      ok: false,
      reason: `"${member.name}" đang được gán trong ít nhất 1 đơn hàng (kể cả đơn cũ/đã huỷ) — không thể xóa vì sẽ làm mất lịch sử quyết toán công thợ. Dùng nút Ngừng hoạt động để ẩn khỏi danh sách chọn.`,
    };
  }

  // Ekip mặc định của concept chỉ là auto-fill cho đơn mới, không phải lịch sử
  // cần giữ — tự xoá tham chiếu thay vì chặn xóa, để chủ studio không phải đi
  // tìm từng concept đang trỏ tới nhân sự này.
  for (const c of concepts) {
    if (c.defaultPhotoStaffId === id) c.defaultPhotoStaffId = undefined;
    if (c.defaultMakeupStaffId === id) c.defaultMakeupStaffId = undefined;
    if (c.defaultStylistStaffId === id) c.defaultStylistStaffId = undefined;
  }

  const idx = staff.findIndex((s) => s.id === id);
  if (idx === -1) return { ok: false, reason: "Không tìm thấy nhân sự." };
  staff.splice(idx, 1);
  return { ok: true };
}
