/**
 * Cầu nối giữa "action tạo đơn" do trợ lý AI trả về (xem server/src/assistant.ts
 * — hàm tao_don_hang) và hàm createOrder() THẬT của client. Server chỉ phân
 * tích lời nói thành các trường (tên khách, concept, ngày, giờ...), còn việc
 * tạo + lưu đơn phải làm Ở CLIENT vì dữ liệu thật nằm trong localStorage của
 * client (xem persistence.ts), không phải ở server.
 *
 * Hàm này KHÔNG tự lưu (không gọi bumpDataVersion) — nơi gọi (AssistantPage)
 * sẽ gọi bumpDataVersion() sau khi tạo thành công để persist + làm mới UI.
 */
import { createOrder } from "@/data/orders";
import { concepts, conceptById } from "@/data";
import type { Audience } from "@/types";

export interface AiOrderArgs {
  customerName?: unknown;
  customerPhone?: unknown;
  conceptName?: unknown;
  date?: unknown;
  time?: unknown;
  peopleCount?: unknown;
  audience?: unknown;
  deposit?: unknown;
  notes?: unknown;
}

export interface AiCreateOrderOutcome {
  ok: boolean;
  message: string;
  orderId?: string;
  date?: string;
}

/** Khớp tên concept AI đưa ra với concept thật (khớp đúng trước, rồi khớp 1
 * phần 2 chiều) — trả null nếu không có concept nào hợp. */
function resolveConceptId(name: string): string | null {
  const n = name.trim().toLowerCase();
  if (!n) return null;
  const exact = concepts.find((c) => c.name.toLowerCase() === n);
  if (exact) return exact.id;
  const partial = concepts.find(
    (c) => c.name.toLowerCase().includes(n) || n.includes(c.name.toLowerCase()),
  );
  return partial?.id ?? null;
}

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

export function createOrderFromAi(args: AiOrderArgs): AiCreateOrderOutcome {
  const customerName = str(args.customerName);
  const conceptName = str(args.conceptName);
  const date = str(args.date);
  const time = str(args.time);

  if (!customerName || !conceptName || !date || !time) {
    return {
      ok: false,
      message: "Thiếu thông tin để tạo đơn (cần tên khách, concept, ngày, giờ). Anh/chị nói rõ thêm giúp em nha.",
    };
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{1,2}:\d{2}$/.test(time)) {
    return { ok: false, message: `Ngày/giờ chưa đúng định dạng (ngày YYYY-MM-DD, giờ HH:mm). Nhận được: ${date} ${time}.` };
  }

  const conceptId = resolveConceptId(conceptName);
  if (!conceptId) {
    return {
      ok: false,
      message: `Không tìm thấy concept "${conceptName}". Các concept đang có: ${concepts.map((c) => c.name).join(", ") || "(chưa có concept nào)"}.`,
    };
  }

  const audience: Audience = args.audience === "Người lớn" ? "Người lớn" : "Trẻ em";
  const peopleCountRaw = Number(args.peopleCount);
  const peopleCount = Number.isFinite(peopleCountRaw) && peopleCountRaw >= 1 ? Math.floor(peopleCountRaw) : 1;
  const depositRaw = Number(args.deposit);
  const deposit = Number.isFinite(depositRaw) && depositRaw > 0 ? depositRaw : 0;
  const customerPhone = str(args.customerPhone) || undefined;
  const notes = str(args.notes) || undefined;

  const people = Array.from({ length: peopleCount }, (_, i) => ({
    name: i === 0 ? customerName : `${customerName} #${i + 1}`,
    audience,
    conceptId,
  }));

  try {
    const order = createOrder({
      customerName,
      customerPhone,
      date,
      time,
      primaryConceptId: conceptId,
      people,
      deposit,
      notes,
      allowConflict: true, // chủ studio chọn "AI tự lưu ngay" — bỏ qua chặn trùng ca/concept
    });
    const conceptLabel = conceptById(conceptId)?.name ?? conceptName;
    return {
      ok: true,
      orderId: order.id,
      date,
      message: `✅ Đã tạo & lưu đơn ${order.code}: ${customerName}${peopleCount > 1 ? ` (${peopleCount} người)` : ""} · ${conceptLabel} · ${date} ${time}${deposit > 0 ? ` · cọc ${deposit.toLocaleString("vi-VN")}đ` : ""}.`,
    };
  } catch (err) {
    return { ok: false, message: "Tạo đơn lỗi: " + (err instanceof Error ? err.message : "không rõ nguyên nhân") + "." };
  }
}
