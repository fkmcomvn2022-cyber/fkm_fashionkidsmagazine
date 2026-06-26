import type { Customer } from "@/types";
import { nextNumericId } from "@/lib/nextId";

export const customers: Customer[] = [
  { id: "u1", name: "Nguyễn Thị Mai", phone: "0987111222", tag: "VIP", totalOrders: 5, totalSpent: 14500000, lastVisit: "2026-06-10", notes: "Khách quen, thích chụp buổi sáng" },
  { id: "u2", name: "Trần Văn Hùng", phone: "0987222333", tag: "Mới", totalOrders: 1, totalSpent: 1990000, lastVisit: "2026-06-20" },
  { id: "u3", name: "Lê Thị Hương", phone: "0987333444", tag: "Thân thiết", totalOrders: 3, totalSpent: 7470000, lastVisit: "2026-05-28" },
  { id: "u4", name: "Phạm Gia Bảo", phone: "0987444555", tag: "Mới", totalOrders: 1, totalSpent: 2490000, lastVisit: "2026-06-22" },
  { id: "u5", name: "Đỗ Thanh Tùng", phone: "0987555666", tag: "VIP", totalOrders: 7, totalSpent: 21000000, lastVisit: "2026-06-24" },
  { id: "u6", name: "Vũ Ngọc Anh", phone: "0987666777", tag: "Thân thiết", totalOrders: 2, totalSpent: 4980000, lastVisit: "2026-06-15" },
  { id: "u7", name: "Bùi Thị Lan", phone: "0987777888", tag: "Mới", totalOrders: 1, totalSpent: 1490000, lastVisit: "2026-06-25" },
];

export const customerById = (id: string) => customers.find((c) => c.id === id);

/**
 * Tìm khách theo SĐT (ưu tiên) hoặc tên trùng khớp; nếu chưa có thì tạo khách
 * mới (tag "Mới", chưa có đơn nào) và thêm vào danh sách khách hàng.
 * Dùng khi tạo đơn hàng thật từ form "Tạo đơn hàng".
 */
export function findOrCreateCustomer(name: string, phone?: string, facebookId?: string): Customer {
  const trimmedName = name.trim();
  const trimmedPhone = phone?.trim();
  const trimmedFb = facebookId?.trim();

  if (trimmedPhone) {
    const byPhone = customers.find((c) => c.phone === trimmedPhone);
    if (byPhone) {
      if (trimmedFb && !byPhone.facebookId) byPhone.facebookId = trimmedFb;
      return byPhone;
    }
  }
  const byName = customers.find((c) => c.name === trimmedName);
  if (byName) {
    if (trimmedFb && !byName.facebookId) byName.facebookId = trimmedFb;
    return byName;
  }

  const seq = nextNumericId("u", customers);
  const customer: Customer = {
    id: `u${seq}`,
    name: trimmedName,
    phone: trimmedPhone ?? "",
    facebookId: trimmedFb,
    tag: "Mới",
    totalOrders: 0,
    totalSpent: 0,
  };
  customers.push(customer);
  return customer;
}

/**
 * Hợp nhất khách mới phát sinh từ backend vào danh sách khách cục bộ (Phase
 * 2, xem [[fkm-studio-ai-chatbot-roadmap]]) — khi khách nhắn Facebook lần
 * đầu, webhook tạo khách mới TRỰC TIẾP trên state mirror của backend (xem
 * server/src/facebook.ts), frontend không hề biết khách này tồn tại vì chưa
 * đọc backend làm nguồn chính lúc khởi động. Chỉ THÊM khách backend báo có mà
 * cục bộ chưa có (theo id) — KHÔNG ghi đè tên/notes của khách đã có ở local,
 * vì studio có thể đã sửa ở app mà bản mirror backend chưa kịp cập nhật.
 *
 * Giai đoạn 3.1: 2 trường NGOẠI LỆ luôn lấy theo backend dù khách đã tồn tại
 * cục bộ — `needsHumanHelp` (chỉ backend đặt/xoá, qua hàm AI "escalate_to_staff"
 * hoặc khi studio gửi tin trả lời tay, xem server/src/index.ts — frontend
 * không có chỗ nào khác tự ghi cờ này nên không sợ đè mất gì) và `tag` (AI có
 * thể tự gán qua hàm "tag_customer" — chấp nhận rủi ro hiếm khi đụng với 1
 * lần studio tự đổi tag cùng lúc, vì backend luôn là bản mới nhất ngay sau
 * lượt webhook/AI vừa xử lý xong).
 * Trả về true nếu có khách mới được thêm HOẶC có cờ nào trong 2 trường trên đổi.
 */
export function mergeRemoteCustomers(remote: Customer[]): boolean {
  const byId = new Map(customers.map((c) => [c.id, c] as const));
  let changed = false;
  for (const c of remote) {
    const local = byId.get(c.id);
    if (!local) {
      customers.push(c);
      byId.set(c.id, c);
      changed = true;
      continue;
    }
    if (local.needsHumanHelp !== c.needsHumanHelp) {
      local.needsHumanHelp = c.needsHumanHelp;
      changed = true;
    }
    if (c.tag && local.tag !== c.tag) {
      local.tag = c.tag;
      changed = true;
    }
  }
  return changed;
}
