/**
 * Giai đoạn 8 (xem [[fkm-studio-ai-chatbot-roadmap]]) — trợ lý AI NỘI BỘ, chủ
 * studio tự chat trong app để hỏi nhanh về doanh thu/lịch/nhân sự/khách hàng.
 * KHÁC với AI trả lời khách ở ai.ts:
 *  - Đối tượng nói chuyện là CHỦ STUDIO (đáng tin), không phải khách lạ — nên
 *    không cần các quy tắc an toàn kiểu "không bịa giá, không tự chốt lịch".
 *  - Trợ lý này CHỈ ĐỌC dữ liệu (mọi hàm bên dưới đều không sửa/xoá gì cả) —
 *    nên KHÔNG cần cơ chế bật/tắt từng hàm như AiFunctionConfig (aiReply.ts),
 *    luôn bật cả bộ hàm tra cứu, đơn giản hơn nhiều so với AI trả lời khách.
 *  - Được đọc SÂU hơn: toàn bộ đơn/khách/nhân sự, không giới hạn theo 1 khách
 *    đang chat như ai.ts.
 *
 * Dùng lại đúng pattern gọi Gemini REST (function-calling nhiều lượt) đã có ở
 * ai.ts, chỉ đổi system prompt + bộ hàm — không gộp chung 1 file để tách rõ 2
 * luồng AI có mục đích/đối tượng khác nhau, tránh nhầm lẫn quy tắc.
 */
import type { StateSnapshot } from "./store.js";
import { conceptsOf, type ConceptShape } from "./chatOrders.js";
// Dùng lại đúng helper ngày/giờ thực với ai.ts (2026-06-28, theo phản hồi anh
// "AI rất hay ngáo thời gian thực") — trợ lý nội bộ cũng cần biết đúng "hôm
// nay" để tính "tuần này"/"7 ngày tới" cho đúng, xem currentVietnamTimeLine().
import { currentVietnamTimeLine } from "./ai.js";

const GEMINI_API_KEY = process.env.GEMINI_API_KEY ?? "";
const GEMINI_MODEL = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";

export interface AssistantTurn {
  fromOwner: boolean;
  text: string;
}

interface OrderShape {
  id?: string;
  code?: string;
  customerId?: string;
  conceptId?: string;
  date?: string;
  time?: string;
  status?: string;
  total?: number;
  deposit?: number;
  remaining?: number;
  photoStaffId?: string;
  makeupStaffId?: string;
  stylistStaffId?: string;
  people?: { audience?: string }[];
  [key: string]: unknown;
}

interface CustomerShape {
  id?: string;
  name?: string;
  phone?: string;
  tag?: string;
  totalOrders?: number;
  totalSpent?: number;
  [key: string]: unknown;
}

interface StaffShape {
  id?: string;
  name?: string;
  role?: string;
  [key: string]: unknown;
}

function ordersOf(state: StateSnapshot): OrderShape[] {
  return Array.isArray(state.orders) ? (state.orders as OrderShape[]) : [];
}

function customersOf(state: StateSnapshot): CustomerShape[] {
  return Array.isArray(state.customers) ? (state.customers as CustomerShape[]) : [];
}

function staffOf(state: StateSnapshot): StaffShape[] {
  return Array.isArray(state.staff) ? (state.staff as StaffShape[]) : [];
}

const ACTIVE_STATUSES = new Set(["cancelled"]); // chỉ loại đơn đã hủy khi tính doanh thu/lịch sắp tới

function inRange(date: string | undefined, fromDate?: string, toDate?: string): boolean {
  if (!date) return false;
  if (fromDate && date < fromDate) return false;
  if (toDate && date > toDate) return false;
  return true;
}

const fmt = (n: unknown) => Number(n ?? 0).toLocaleString("vi-VN");

// --- Định nghĩa hàm tra cứu (CỐ ĐỊNH, không cho studio sửa vì đây là tool
// nội bộ riêng cho chủ studio, không phải nghiệp vụ cấu hình được như ai.ts) ---

const FUNCTION_SCHEMAS: Record<string, Record<string, unknown>> = {
  get_revenue_summary: {
    type: "OBJECT",
    properties: {
      fromDate: { type: "STRING", description: "Từ ngày, dạng YYYY-MM-DD. Bỏ trống nếu hỏi không giới hạn ngày bắt đầu." },
      toDate: { type: "STRING", description: "Đến ngày, dạng YYYY-MM-DD. Bỏ trống nếu hỏi không giới hạn ngày kết thúc." },
    },
  },
  get_upcoming_schedule: {
    type: "OBJECT",
    properties: {
      fromDate: { type: "STRING", description: "Từ ngày, dạng YYYY-MM-DD. Mặc định hôm nay nếu không nói rõ." },
      toDate: { type: "STRING", description: "Đến ngày, dạng YYYY-MM-DD. Mặc định 7 ngày sau fromDate nếu không nói rõ." },
    },
  },
  get_unpaid_orders: {
    type: "OBJECT",
    properties: {},
  },
  get_staff_workload: {
    type: "OBJECT",
    properties: {
      fromDate: { type: "STRING", description: "Từ ngày, dạng YYYY-MM-DD." },
      toDate: { type: "STRING", description: "Đến ngày, dạng YYYY-MM-DD." },
    },
  },
  get_customer_info: {
    type: "OBJECT",
    properties: {
      nameOrPhone: { type: "STRING", description: "Tên hoặc số điện thoại khách cần tra" },
    },
    required: ["nameOrPhone"],
  },
  get_concept_performance: {
    type: "OBJECT",
    properties: {
      fromDate: { type: "STRING", description: "Từ ngày, dạng YYYY-MM-DD." },
      toDate: { type: "STRING", description: "Đến ngày, dạng YYYY-MM-DD." },
    },
  },
  tao_don_hang: {
    type: "OBJECT",
    properties: {
      customerName: { type: "STRING", description: "Tên khách hàng (bắt buộc)." },
      customerPhone: { type: "STRING", description: "Số điện thoại khách, nếu có." },
      conceptName: { type: "STRING", description: "Tên concept/gói chụp — PHẢI khớp 1 trong các concept đang có (đã liệt kê trong hướng dẫn)." },
      date: { type: "STRING", description: "Ngày chụp, dạng YYYY-MM-DD. Tự suy ra ngày thật từ 'hôm nay', 'mai', 'thứ 7 này'..." },
      time: { type: "STRING", description: "Giờ chụp, dạng HH:mm 24 giờ (vd 09:30, 14:00)." },
      peopleCount: { type: "NUMBER", description: "Số người chụp. Mặc định 1 nếu không nói." },
      audience: { type: "STRING", description: "'Trẻ em' hoặc 'Người lớn'. Mặc định 'Trẻ em' (studio chụp ảnh thiếu nhi)." },
      deposit: { type: "NUMBER", description: "Tiền cọc đã thu (VND). Mặc định 0 nếu không nói." },
      notes: { type: "STRING", description: "Ghi chú thêm cho đơn, nếu có." },
    },
    required: ["customerName", "conceptName", "date", "time"],
  },
};

const FUNCTION_DESCRIPTIONS: Record<string, string> = {
  get_revenue_summary: "Tính tổng doanh thu (total), tổng đã cọc, tổng còn nợ, số đơn theo từng trạng thái, trong 1 khoảng ngày (theo ngày chụp).",
  get_upcoming_schedule: "Lấy danh sách lịch chụp sắp tới (ngày/giờ, khách, concept, trạng thái) trong 1 khoảng ngày.",
  get_unpaid_orders: "Lấy danh sách đơn còn nợ tiền (remaining > 0), chưa hủy — để nhắc thu cọc/thu nốt.",
  get_staff_workload: "Đếm số ca mỗi nhân sự (Photo/Makeup/Stylist) được phân công trong 1 khoảng ngày — để biết ai đang bận/rảnh.",
  get_customer_info: "Tra cứu 1 khách theo tên hoặc số điện thoại — lịch sử đơn, tổng chi tiêu, nhãn (VIP/Mới/Thân thiết).",
  get_concept_performance: "Tổng hợp doanh thu + số đơn theo từng concept trong 1 khoảng ngày — để biết concept nào bán tốt.",
  tao_don_hang: "TẠO 1 đơn hàng/lịch chụp mới khi chủ studio yêu cầu (vd 'tạo đơn cho chị Lan concept Thu Mơ 9h mai', 'đặt lịch...', 'thêm đơn...'). Chỉ gọi khi đã đủ tối thiểu: tên khách, concept, ngày, giờ — nếu thiếu thì HỎI LẠI chứ đừng tự bịa.",
};

function buildToolDeclaration(key: string) {
  return { name: key, description: FUNCTION_DESCRIPTIONS[key], parameters: FUNCTION_SCHEMAS[key] };
}

const ALL_TOOLS = [{ functionDeclarations: Object.keys(FUNCTION_SCHEMAS).map(buildToolDeclaration) }];

// --- Handlers — chỉ đọc state, không bao giờ gán/ghi gì lại vào state ---

function handleRevenueSummary(state: StateSnapshot, args: Record<string, unknown>) {
  const fromDate = typeof args.fromDate === "string" ? args.fromDate : undefined;
  const toDate = typeof args.toDate === "string" ? args.toDate : undefined;
  const orders = ordersOf(state).filter((o) => !ACTIVE_STATUSES.has(o.status ?? "") && inRange(o.date, fromDate, toDate));

  const byStatus: Record<string, number> = {};
  let totalRevenue = 0;
  let totalDeposit = 0;
  let totalRemaining = 0;
  for (const o of orders) {
    totalRevenue += o.total ?? 0;
    totalDeposit += o.deposit ?? 0;
    totalRemaining += o.remaining ?? 0;
    const st = o.status ?? "unknown";
    byStatus[st] = (byStatus[st] ?? 0) + 1;
  }
  return { orderCount: orders.length, totalRevenue, totalDeposit, totalRemaining, byStatus };
}

function handleUpcomingSchedule(state: StateSnapshot, args: Record<string, unknown>) {
  const today = new Date().toISOString().slice(0, 10);
  const fromDate = typeof args.fromDate === "string" && args.fromDate ? args.fromDate : today;
  let toDate = typeof args.toDate === "string" && args.toDate ? args.toDate : undefined;
  if (!toDate) {
    const d = new Date(fromDate);
    d.setDate(d.getDate() + 7);
    toDate = d.toISOString().slice(0, 10);
  }
  const concepts = conceptsOf(state);
  const customers = customersOf(state);
  const orders = ordersOf(state)
    .filter((o) => o.status !== "cancelled" && inRange(o.date, fromDate, toDate))
    .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));

  const items = orders.map((o) => ({
    code: o.code,
    date: o.date,
    time: o.time,
    status: o.status,
    customerName: customers.find((c) => c.id === o.customerId)?.name ?? "?",
    conceptName: concepts.find((c) => c.id === o.conceptId)?.name ?? "?",
  }));
  return { fromDate, toDate, count: items.length, items };
}

function handleUnpaidOrders(state: StateSnapshot) {
  const customers = customersOf(state);
  const orders = ordersOf(state)
    .filter((o) => o.status !== "cancelled" && (o.remaining ?? 0) > 0)
    .sort((a, b) => String(a.date ?? "").localeCompare(String(b.date ?? "")));
  const items = orders.map((o) => ({
    code: o.code,
    date: o.date,
    customerName: customers.find((c) => c.id === o.customerId)?.name ?? "?",
    total: o.total,
    deposit: o.deposit,
    remaining: o.remaining,
    status: o.status,
  }));
  return { count: items.length, items };
}

function handleStaffWorkload(state: StateSnapshot, args: Record<string, unknown>) {
  const fromDate = typeof args.fromDate === "string" ? args.fromDate : undefined;
  const toDate = typeof args.toDate === "string" ? args.toDate : undefined;
  const staffList = staffOf(state);
  const orders = ordersOf(state).filter((o) => o.status !== "cancelled" && inRange(o.date, fromDate, toDate));

  const countFor = (staffId: string | undefined) => orders.filter((o) => o.photoStaffId === staffId || o.makeupStaffId === staffId || o.stylistStaffId === staffId).length;

  const items = staffList.map((s) => ({ name: s.name, role: s.role, shiftCount: countFor(s.id) })).sort((a, b) => b.shiftCount - a.shiftCount);
  return { fromDate, toDate, items };
}

function handleCustomerInfo(state: StateSnapshot, args: Record<string, unknown>) {
  const needle = typeof args.nameOrPhone === "string" ? args.nameOrPhone.trim().toLowerCase() : "";
  if (!needle) return { found: false };
  const customers = customersOf(state);
  const customer =
    customers.find((c) => (c.phone ?? "") === needle) ??
    customers.find((c) => (c.name ?? "").toLowerCase() === needle) ??
    customers.find((c) => (c.name ?? "").toLowerCase().includes(needle));
  if (!customer) return { found: false };

  const concepts = conceptsOf(state);
  const orders = ordersOf(state)
    .filter((o) => o.customerId === customer.id)
    .sort((a, b) => String(b.date ?? "").localeCompare(String(a.date ?? "")));
  return {
    found: true,
    name: customer.name,
    phone: customer.phone,
    tag: customer.tag,
    totalOrders: orders.length,
    totalSpent: orders.reduce((sum, o) => sum + (o.total ?? 0), 0),
    recentOrders: orders.slice(0, 5).map((o) => ({
      code: o.code,
      date: o.date,
      conceptName: concepts.find((c) => c.id === o.conceptId)?.name ?? "?",
      status: o.status,
      total: o.total,
      remaining: o.remaining,
    })),
  };
}

function handleConceptPerformance(state: StateSnapshot, args: Record<string, unknown>) {
  const fromDate = typeof args.fromDate === "string" ? args.fromDate : undefined;
  const toDate = typeof args.toDate === "string" ? args.toDate : undefined;
  const concepts = conceptsOf(state);
  const orders = ordersOf(state).filter((o) => o.status !== "cancelled" && inRange(o.date, fromDate, toDate));

  const stats = new Map<string, { name: string; orderCount: number; revenue: number }>();
  for (const o of orders) {
    const concept: ConceptShape | undefined = concepts.find((c) => c.id === o.conceptId);
    const key = o.conceptId ?? "unknown";
    const name = concept?.name ?? "Không rõ";
    const entry = stats.get(key) ?? { name, orderCount: 0, revenue: 0 };
    entry.orderCount += 1;
    entry.revenue += o.total ?? 0;
    stats.set(key, entry);
  }
  const items = Array.from(stats.values()).sort((a, b) => b.revenue - a.revenue);
  return { fromDate, toDate, items };
}

function executeAssistantFunction(key: string, args: Record<string, unknown>, state: StateSnapshot): Record<string, unknown> {
  switch (key) {
    case "get_revenue_summary":
      return handleRevenueSummary(state, args);
    case "get_upcoming_schedule":
      return handleUpcomingSchedule(state, args);
    case "get_unpaid_orders":
      return handleUnpaidOrders(state);
    case "get_staff_workload":
      return handleStaffWorkload(state, args);
    case "get_customer_info":
      return handleCustomerInfo(state, args);
    case "get_concept_performance":
      return handleConceptPerformance(state, args);
    default:
      return { ok: false, error: "unknown_function" };
  }
}

// --- Gọi Gemini, cùng giao thức function-calling như ai.ts -------------

interface GeminiPart {
  text?: string;
  functionCall?: { name: string; args?: Record<string, unknown> };
  functionResponse?: { name: string; response: Record<string, unknown> };
}
interface GeminiContent {
  role: "user" | "model" | "function";
  parts: GeminiPart[];
}
interface GeminiResponse {
  candidates?: { content?: { parts?: GeminiPart[] } }[];
}

const MAX_FUNCTION_CALL_ROUNDS = 4;

const SYSTEM_PROMPT_BASE = `Bạn là trợ lý AI nội bộ của FKM Studio, đang chat trực tiếp với CHỦ studio (không phải khách hàng) ngay trong app quản lý. Quy tắc:
- Xưng "em", gọi chủ studio là "anh/chị" (trung tính nếu chưa rõ), trả lời ngắn gọn, rõ số liệu, đi thẳng vào việc — không cần lịch sự khách sáo như khi nói chuyện với khách.
- LUÔN dùng đúng số liệu lấy được từ các hàm tra cứu (get_revenue_summary, get_upcoming_schedule, get_unpaid_orders, get_staff_workload, get_customer_info, get_concept_performance) — KHÔNG tự đoán/bịa số nếu câu hỏi cần dữ liệu thật, hãy gọi hàm phù hợp trước khi trả lời.
- Khi không chắc khoảng ngày chủ studio muốn hỏi, cứ chọn khoảng hợp lý (vd "tuần này" = hôm nay tới 7 ngày sau) rồi nói rõ khoảng đã chọn trong câu trả lời.
- Có thể đưa ra nhận xét/gợi ý ngắn dựa trên số liệu (vd "có 3 đơn còn nợ tiền, nên nhắc cọc trước ngày chụp").
- NGOÀI tra cứu, em CÓ THỂ TẠO ĐƠN HÀNG/LỊCH CHỤP mới giúp chủ studio qua hàm tao_don_hang. Khi chủ studio bảo "tạo đơn/đặt lịch/thêm đơn..." thì:
  · Suy ra ngày thật từ lời nói (hôm nay/mai/thứ 7 này...) ra dạng YYYY-MM-DD, giờ ra HH:mm.
  · conceptName phải khớp 1 trong các concept đang có (xem danh sách bên dưới). Nếu chủ studio nói tên gần đúng, chọn concept gần nhất; nếu không rõ concept nào thì HỎI LẠI.
  · Nếu thiếu tên khách / ngày / giờ thì HỎI LẠI cho đủ rồi mới gọi hàm — KHÔNG tự bịa.
  · Sau khi gọi hàm tạo đơn, app sẽ tự lưu đơn; em chỉ cần xác nhận ngắn gọn.
- Trả lời bằng tiếng Việt, có thể dùng số liệu dạng gạch đầu dòng ngắn nếu nhiều mục, nhưng đừng dài dòng không cần thiết.`;

/** SYSTEM_PROMPT_BASE + danh sách concept (để map tên khi tạo đơn) + dòng
 * ngày/giờ thực (tính lại mỗi lần gọi, để AI suy ra ngày tương đối cho đúng). */
function systemPrompt(state: StateSnapshot): string {
  const conceptNames = conceptsOf(state)
    .map((c) => c.name)
    .filter((n): n is string => typeof n === "string" && n.length > 0);
  const conceptLine = conceptNames.length
    ? `Các concept đang có (dùng đúng tên này khi tạo đơn): ${conceptNames.join(", ")}.`
    : "Hiện chưa có concept nào — nếu chủ studio muốn tạo đơn, hãy báo cần tạo concept trước.";
  return `${SYSTEM_PROMPT_BASE}\n- ${conceptLine}\n- ${currentVietnamTimeLine()}`;
}

export interface AssistantReplyContext {
  state: StateSnapshot;
  history: AssistantTurn[];
}

/** Hành động AI muốn app THỰC THI phía client (server không tự ghi vì dữ liệu
 * thật nằm ở localStorage của client). Hiện chỉ có tạo đơn; sau này có thể
 * thêm các action khác (sửa đơn, nhắc khách...). */
export interface AssistantCreateOrderAction {
  type: "create_order";
  args: Record<string, unknown>;
}
export type AssistantAction = AssistantCreateOrderAction;

export interface AssistantReplyResult {
  reply: string;
  action?: AssistantAction;
}

export async function generateAssistantReply(ctx: AssistantReplyContext): Promise<AssistantReplyResult | null> {
  if (!GEMINI_API_KEY) return null;

  const recent = ctx.history.slice(-20);
  const firstOwnerIdx = recent.findIndex((t) => t.fromOwner);
  const turns = firstOwnerIdx > 0 ? recent.slice(firstOwnerIdx) : recent;
  const contents: GeminiContent[] = turns.map((t) => ({
    role: t.fromOwner ? "user" : "model",
    parts: [{ text: t.text }],
  }));
  if (contents.length === 0) return null;

  for (let round = 0; round < MAX_FUNCTION_CALL_ROUNDS; round++) {
    let data: GeminiResponse;
    try {
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            systemInstruction: { parts: [{ text: systemPrompt(ctx.state) }] },
            contents,
            tools: ALL_TOOLS,
            generationConfig: { temperature: 0.3, maxOutputTokens: 500 },
          }),
        },
      );
      if (!res.ok) {
        console.error("[assistant] Gemini trả lỗi:", res.status, await res.text());
        return null;
      }
      data = (await res.json()) as GeminiResponse;
    } catch (err) {
      console.error("[assistant] Gọi Gemini thất bại:", err);
      return null;
    }

    const parts = data.candidates?.[0]?.content?.parts ?? [];
    const functionCallParts = parts.filter((p) => p.functionCall);

    if (functionCallParts.length === 0) {
      const text = parts.map((p) => p.text ?? "").join("").trim();
      return text ? { reply: text } : null;
    }

    // Nếu AI muốn TẠO ĐƠN: KHÔNG thực thi ở server (dữ liệu thật nằm ở client),
    // mà trả args về để client tự gọi createOrder() + lưu. Dừng vòng tại đây.
    const createCall = functionCallParts.find((p) => p.functionCall!.name === "tao_don_hang");
    if (createCall) {
      const args = createCall.functionCall!.args ?? {};
      const modelText = parts.map((p) => p.text ?? "").join("").trim();
      return {
        reply: modelText || "Em tạo đơn ngay đây ạ.",
        action: { type: "create_order", args },
      };
    }

    contents.push({ role: "model", parts });
    const responseParts: GeminiPart[] = [];
    for (const part of functionCallParts) {
      const name = part.functionCall!.name;
      const args = part.functionCall!.args ?? {};
      const result = executeAssistantFunction(name, args, ctx.state);
      responseParts.push({ functionResponse: { name, response: result } });
    }
    contents.push({ role: "function", parts: responseParts });
  }

  console.error("[assistant] Vượt quá số lượt gọi hàm cho phép, dừng lại không trả lời.");
  return null;
}
