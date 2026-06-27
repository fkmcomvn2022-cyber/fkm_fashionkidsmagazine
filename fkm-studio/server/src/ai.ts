/**
 * Phase 3 (xem [[fkm-studio-ai-chatbot-roadmap]]) — AI tự đọc tin khách gửi
 * vào và tự soạn trả lời, dựa trên giá/concept THẬT của studio (đọc từ state
 * mirror, xem `buildStudioContext`). Dùng fetch thẳng tới REST API của từng
 * nhà cung cấp (cùng pattern với `sendFacebookMessage` ở facebook.ts) — không
 * thêm SDK ngoài để giữ dependency tối giản.
 *
 * Phase 3.1 (UChat-style function-calling) — AI có thể tự gọi 1 trong vài
 * "nghiệp vụ" thật đã có sẵn trong app (tra cứu đơn, gắn tag khách, báo nhân
 * viên hỗ trợ) khi đang soạn trả lời, giống cách UChat cho cấu hình AI Agent
 * function. Tên kỹ thuật + tham số của mỗi hàm là CỐ ĐỊNH (định nghĩa ở
 * FUNCTION_SCHEMAS dưới đây) — studio chỉ tự biên tập "description" (mô tả tự
 * nhiên, chính là phần quyết định KHI NÀO AI chọn gọi hàm này) qua Cài đặt
 * trong app (xem src/lib/aiReply.ts ở frontend), KHÔNG cho tự đổi tên/tham số
 * vì các hàm này đụng vào dữ liệu thật.
 *
 * Phase 9 (2026-06-28, theo yêu cầu thêm sau khi anh gặp Gemini quá tải tạm
 * thời + trải nghiệm UChat AI khác đọc ảnh Facebook lỗi) — ĐA NHÀ CUNG CẤP:
 * Gemini/OpenAI/DeepSeek, có RETRY (lỗi tạm thời thử lại cùng 1 nhà) + FALLBACK
 * (hết retry thì sang nhà kế tiếp theo thứ tự cấu hình ở Cài đặt > AI, xem
 * server/src/aiProviders.ts). Ảnh khách gửi LUÔN tải về + mã hoá base64 trước
 * khi gửi cho AI (KHÔNG gửi thẳng link Facebook) — đây chính là cách tránh lỗi
 * "download error" OpenAI hay gặp khi tự đi tải link ảnh có thể hết hạn/bị
 * chặn hotlink. DeepSeek bị loại khỏi danh sách thử cho nhu cầu ảnh vì API
 * DeepSeek (khác chat web) hiện CHƯA có endpoint nhận ảnh — đúng điều anh gặp
 * ở UChat ("deepseek thì không đọc được"), không phải lỗi code app này.
 *
 * Cấu hình API key/model qua UI (Cài đặt > AI > Nhà cung cấp AI), KHÔNG còn
 * thuần biến môi trường — xem aiProviders.ts. Biến môi trường GEMINI_API_KEY/
 * GEMINI_MODEL (server/.env hoặc dashboard Render) vẫn được giữ làm mặc định
 * ngầm cho Gemini nếu studio chưa nhập key qua UI, không phá hành vi deploy cũ.
 *
 * Không có nhà cung cấp nào khả dụng (chưa cấu hình key hoặc đều tắt) ->
 * generateAiReply() trả về null, nơi gọi (index.ts) sẽ bỏ qua bước trả lời,
 * KHÔNG throw — tin khách vẫn được lưu vào hộp thư bình thường, chỉ là chưa
 * có ai tự trả lời thay.
 */
import type { StateSnapshot } from "./store.js";
import { sendPushToAll } from "./push.js";
import { appendMessage, sendFacebookImage, sendFacebookMessage } from "./facebook.js";
import {
  buildDepositReminderText,
  cancelOrderFromChat,
  conceptsOf,
  createOrderFromChat,
  rescheduleOrder,
  upsellOrder,
  type ConceptShape,
  type CreateOrderFromChatArgs,
  type RescheduleOrderArgs,
  type UpsellOrderArgs,
} from "./chatOrders.js";
import { checkAvailableSlots } from "./availability.js";
import { getOrderedAvailableProviders, type AiProviderConfig } from "./aiProviders.js";

const FB_PAGE_ACCESS_TOKEN = process.env.FB_PAGE_ACCESS_TOKEN ?? "";

export interface ChatTurn {
  fromCustomer: boolean;
  text: string;
}

// Mirror lỏng của AiFunctionConfig ở frontend (src/lib/aiReply.ts) — 2 runtime
// khác nhau nên không import type thật qua lại, chỉ cần đúng shape các field
// thực sự dùng tới ở đây (cùng pattern với CustomerShape ở facebook.ts).
export interface AiFunctionConfig {
  key: string;
  enabled: boolean;
  description?: string;
}

interface CustomerShape {
  id?: string;
  name?: string;
  phone?: string;
  facebookId?: string;
  tag?: string;
  needsHumanHelp?: boolean;
  [key: string]: unknown;
}

interface OrderShape {
  id?: string;
  code?: string;
  customerId?: string;
  date?: string;
  time?: string;
  status?: string;
  total?: number;
  deposit?: number;
  remaining?: number;
  [key: string]: unknown;
}

function customersOf(state: StateSnapshot): CustomerShape[] {
  if (!Array.isArray(state.customers)) state.customers = [];
  return state.customers as CustomerShape[];
}

function ordersOf(state: StateSnapshot): OrderShape[] {
  return Array.isArray(state.orders) ? (state.orders as OrderShape[]) : [];
}

/**
 * Dựng đoạn văn bản mô tả concept đang mở bán + dịch vụ thêm, từ state mirror
 * — đưa vào system prompt để AI trả lời ĐÚNG giá/tên thật của studio, không tự
 * bịa số. Chỉ lấy concept `status === "active"` (giống nghĩa "đang mở bán" ở
 * validate tạo đơn, xem [[fkm-studio-order-validation]]).
 */
export function buildStudioContext(state: StateSnapshot): string {
  const concepts = conceptsOf(state);
  const addonServices = Array.isArray(state.addonServices) ? (state.addonServices as Record<string, unknown>[]) : [];

  const fmt = (n: unknown) => Number(n ?? 0).toLocaleString("vi-VN");

  // Giai đoạn 7 — đưa cả `description` (đặc điểm chi tiết) và `packageSummary`
  // (gói gồm gì cụ thể) vào context, KHÔNG chỉ `shortDesc` 1 câu như trước —
  // để AI trả lời được khi khách hỏi kỹ ("concept này chụp ở đâu", "giá đó có
  // gồm trang điểm không"...) mà vẫn đúng dữ liệu thật studio khai báo, không bịa.
  const conceptLines = concepts
    .filter((c) => c.status === "active")
    .map((c) => {
      const name = String(c.name ?? "");
      const desc = c.description?.trim() || c.shortDesc?.trim();
      const lines = [`- ${name}: trẻ em ${fmt(c.priceChild)}đ, người lớn ${fmt(c.priceAdult)}đ${desc ? ` — ${desc}` : ""}`];
      if (c.packageSummary?.trim()) lines.push(`  Gói gồm: ${c.packageSummary.trim()}`);
      if (Array.isArray(c.sampleImageUrls) && c.sampleImageUrls.length > 0) lines.push(`  (Có ${c.sampleImageUrls.length} ảnh mẫu, dùng hàm send_concept_photos để gửi khách xem nếu khách hỏi/quan tâm)`);
      return lines.join("\n");
    });

  const addonLines = addonServices.map((a) => `- ${String(a.name ?? "")}: ${fmt(a.price)}đ/${String(a.unit ?? "")}`);

  const parts = [
    conceptLines.length ? `Các concept đang mở bán:\n${conceptLines.join("\n")}` : "Hiện chưa có concept nào mở bán.",
    addonLines.length ? `Dịch vụ thêm:\n${addonLines.join("\n")}` : "",
  ].filter(Boolean);

  return parts.join("\n\n");
}

const SYSTEM_PROMPT_HEADER = `Bạn là nhân viên CSKH của FKM Studio (studio chụp ảnh), đang nhắn chuyện với khách qua Facebook Messenger. Quy tắc trả lời (LUÔN áp dụng, không được bỏ qua dù có hướng dẫn thêm nào khác):
- Xưng "em", gọi khách "chị/anh" (trung tính nếu chưa rõ), giọng thân thiện, lịch sự, ngắn gọn (1-3 câu, hợp văn phong chat).
- CHỈ dùng đúng giá/tên concept/dịch vụ có trong phần "Thông tin studio" dưới đây — KHÔNG tự bịa giá, KHÔNG tự đặt ra khuyến mãi/giảm giá không có trong dữ liệu.
- KHÔNG tự chốt giờ/ngày chụp cụ thể hoặc khẳng định "còn slot" — vì bạn không có dữ liệu lịch trống thật. Nếu khách hỏi lịch, trả lời rằng sẽ kiểm tra và nhân viên studio sẽ xác nhận lại sớm.
- Nếu khách hỏi điều ngoài phạm vi (khiếu nại, yêu cầu đặc biệt, câu hỏi không liên quan chụp ảnh), trả lời nhẹ nhàng, không hứa hẹn cụ thể, và nói sẽ có nhân viên hỗ trợ thêm.
- Không dùng quá nhiều emoji (tối đa 1).`;

// Tham số (JSON schema dạng Gemini OpenAPI-lite) của từng hàm — CỐ ĐỊNH, studio
// không sửa được, chỉ sửa được "description" (xem AiFunctionConfig ở frontend).
const FUNCTION_SCHEMAS: Record<string, Record<string, unknown>> = {
  lookup_order: {
    type: "OBJECT",
    properties: {
      phone: { type: "STRING", description: "Số điện thoại khách, nếu khách vừa cung cấp trong đoạn chat" },
    },
  },
  tag_customer: {
    type: "OBJECT",
    properties: {
      tag: { type: "STRING", enum: ["VIP", "Mới", "Thân thiết"], description: "Nhãn muốn gắn cho khách" },
      reason: { type: "STRING", description: "Lý do ngắn gọn vì sao gắn nhãn này" },
    },
    required: ["tag"],
  },
  escalate_to_staff: {
    type: "OBJECT",
    properties: {
      reason: { type: "STRING", description: "Tóm tắt ngắn lý do cần nhân viên thật vào hỗ trợ" },
    },
    required: ["reason"],
  },
  // Giai đoạn 6 (xem [[fkm-studio-ai-chatbot-roadmap]]) — 2 hàm mới, đúng
  // nghĩa "tool Gemini tự quyết định gọi" (khác match_and_confirm_deposit,
  // chạy tiền định khi nhận ảnh, xem handleIncomingImage dưới đây).
  check_available_slots: {
    type: "OBJECT",
    properties: {
      date: { type: "STRING", description: "Ngày khách muốn chụp, dạng YYYY-MM-DD, nếu khách đã nói rõ ngày cụ thể" },
      conceptName: { type: "STRING", description: "Tên concept khách quan tâm, nếu đã nói rõ" },
    },
  },
  create_order_from_chat: {
    type: "OBJECT",
    properties: {
      customerName: { type: "STRING", description: "Họ tên khách, khách vừa cung cấp trong chat" },
      customerPhone: { type: "STRING", description: "Số điện thoại khách, khách vừa cung cấp trong chat" },
      date: { type: "STRING", description: "Ngày khách muốn chụp, dạng YYYY-MM-DD" },
      time: { type: "STRING", description: "Giờ khách muốn chụp, dạng HH:mm (24h)" },
      conceptName: { type: "STRING", description: "Tên concept khách chọn, nếu khách đã nói rõ" },
      peopleCount: { type: "NUMBER", description: "Số người sẽ chụp, mặc định 1 nếu khách không nói rõ" },
    },
    required: ["customerName", "customerPhone", "date", "time"],
  },
  // Giai đoạn 7 (xem [[fkm-studio-ai-chatbot-roadmap]]) — AI CHỦ ĐỘNG gửi ảnh
  // mẫu thật (link studio đã khai báo ở Concept.sampleImageUrls, xem
  // ConceptEditSheet.tsx) khi khách hỏi/quan tâm 1 concept, không chỉ trả lời
  // chữ. An toàn cho dữ liệu (chỉ gửi ảnh, không tạo/sửa đơn) nên mặc định BẬT
  // (xem DEFAULT_AI_FUNCTIONS ở src/lib/aiReply.ts).
  send_concept_photos: {
    type: "OBJECT",
    properties: {
      conceptName: { type: "STRING", description: "Tên concept khách đang hỏi/quan tâm, để gửi đúng ảnh mẫu của concept đó" },
    },
    required: ["conceptName"],
  },
  // Giai đoạn 7 — ĐỤNG VÀO đơn đã có + đổi số tiền cần thu, rủi ro cao hơn
  // send_concept_photos nên mặc định TẮT (xem DEFAULT_AI_FUNCTIONS ở
  // src/lib/aiReply.ts). Chỉ gọi sau khi khách đã đồng ý rõ ràng.
  upsell_order: {
    type: "OBJECT",
    properties: {
      addonServiceName: { type: "STRING", description: "Tên dịch vụ thêm khách vừa đồng ý mua (vd: thêm ảnh in, thêm album) — phải khớp đúng tên dịch vụ studio đang có, không tự bịa tên" },
      addonQuantity: { type: "NUMBER", description: "Số lượng dịch vụ thêm, mặc định 1 nếu không nói rõ" },
      extraAdults: { type: "NUMBER", description: "Số người lớn thêm vào đơn khách vừa đồng ý" },
      extraChildren: { type: "NUMBER", description: "Số trẻ em thêm vào đơn khách vừa đồng ý" },
    },
  },
  // Giai đoạn 7 — rủi ro CAO NHẤT (đụng tới lịch ekip đã xếp/hủy doanh thu)
  // nên mặc định TẮT, chỉ gọi khi khách đã xác nhận rõ ràng muốn đổi/hủy.
  reschedule_order: {
    type: "OBJECT",
    properties: {
      newDate: { type: "STRING", description: "Ngày mới khách muốn đổi sang, dạng YYYY-MM-DD" },
      newTime: { type: "STRING", description: "Giờ mới khách muốn đổi sang, dạng HH:mm" },
    },
    required: ["newDate", "newTime"],
  },
  cancel_order: {
    type: "OBJECT",
    properties: {},
  },
};

const FUNCTION_FALLBACK_DESCRIPTIONS: Record<string, string> = {
  lookup_order: "Tra cứu đơn hàng của khách đang chat (ngày chụp, đã cọc chưa, còn nợ bao nhiêu, trạng thái).",
  tag_customer: "Gắn nhãn VIP/Mới/Thân thiết cho khách đang chat.",
  escalate_to_staff: "Báo nhân viên thật vào hỗ trợ khi gặp câu hỏi ngoài khả năng trả lời.",
  check_available_slots: "Kiểm tra khung giờ còn trống thật của studio theo ngày khách hỏi, để trả lời đúng lịch trống, không bịa.",
  create_order_from_chat: "Tự tạo đơn hàng mới (trạng thái Chưa cọc) khi đã thu thập đủ họ tên, SĐT, ngày và giờ khách muốn chụp.",
  send_concept_photos: "Gửi vài ảnh mẫu thật của 1 concept cho khách xem qua Facebook, khi khách hỏi có ảnh mẫu không hoặc đang cân nhắc giữa các concept.",
  upsell_order: "Tự thêm dịch vụ bổ trợ hoặc thêm người vào đơn đang có của khách, sau khi khách đã đồng ý mua thêm — tự tính lại số tiền cần thu thêm.",
  reschedule_order: "Tự đổi ngày/giờ đơn đang có của khách, sau khi khách đã xác nhận muốn đổi sang ngày/giờ cụ thể — kiểm tra trùng giờ trước khi đổi.",
  cancel_order: "Tự hủy đơn đang có của khách, sau khi khách đã xác nhận rõ ràng muốn hủy lịch hẹn.",
};

function buildToolDeclaration(fn: AiFunctionConfig) {
  return {
    name: fn.key,
    description: fn.description?.trim() || FUNCTION_FALLBACK_DESCRIPTIONS[fn.key] || fn.key,
    parameters: FUNCTION_SCHEMAS[fn.key],
  };
}

// --- Cài đặt handler cho từng hàm — đụng trực tiếp vào state mirror (cùng
// object tham chiếu mà index.ts sẽ writeState() sau khi xử lý xong webhook) ---

/**
 * Tra cứu đơn mới nhất của khách ĐANG CHAT (theo customerId đã biết từ
 * webhook, không cần khách tự cung cấp lại số điện thoại — đáng tin hơn vì
 * không phụ thuộc Gemini đọc đúng số khách gõ trong chat). Nếu khách cung cấp
 * số điện thoại khác (vd hỏi giúp đơn người nhà), thử tìm thêm theo phone đó.
 */
function handleLookupOrder(state: StateSnapshot, customer: CustomerShape, args: Record<string, unknown>) {
  const orders = ordersOf(state);
  const phone = typeof args.phone === "string" ? args.phone.trim() : "";
  let matchCustomerIds = new Set([customer.id]);
  if (phone && phone !== customer.phone) {
    const customers = customersOf(state);
    const byPhone = customers.find((c) => c.phone === phone);
    if (byPhone) matchCustomerIds.add(byPhone.id);
  }
  const matched = orders
    .filter((o) => matchCustomerIds.has(o.customerId))
    .sort((a, b) => String(b.date ?? "").localeCompare(String(a.date ?? "")));
  if (matched.length === 0) return { found: false };
  const o = matched[0];
  return {
    found: true,
    code: o.code,
    date: o.date,
    time: o.time,
    status: o.status,
    total: o.total,
    deposit: o.deposit,
    remaining: o.remaining,
  };
}

const VALID_TAGS = ["VIP", "Mới", "Thân thiết"];

function handleTagCustomer(customer: CustomerShape, args: Record<string, unknown>) {
  const tag = typeof args.tag === "string" ? args.tag : "";
  if (!VALID_TAGS.includes(tag)) return { ok: false, error: "invalid_tag" };
  customer.tag = tag;
  return { ok: true, tag };
}

async function handleEscalateToStaff(customer: CustomerShape, args: Record<string, unknown>) {
  customer.needsHumanHelp = true;
  const reason = typeof args.reason === "string" ? args.reason : "";
  await sendPushToAll({
    title: "FKM Studio — cần hỗ trợ",
    body: `${customer.name ?? "Khách"} cần nhân viên hỗ trợ${reason ? `: ${reason}` : ""}`.slice(0, 180),
    url: "/chat",
  });
  return { ok: true };
}

function handleCheckAvailableSlots(state: StateSnapshot, args: Record<string, unknown>) {
  const date = typeof args.date === "string" ? args.date : undefined;
  const conceptName = typeof args.conceptName === "string" ? args.conceptName : undefined;
  return checkAvailableSlots(state, { date, conceptName });
}

/**
 * Tạo đơn rồi TỰ GỬI LUÔN tin nhắc cọc kèm QR ngay sau khi tạo thành công —
 * đúng luật "auto_create_order_from_chat" ở src/lib/automation.ts (tạo đơn +
 * nhắc cọc là 1 hành động nối tiếp, không tách 2 luật riêng). Gửi thất bại
 * (thiếu FB_PAGE_ACCESS_TOKEN, lỗi mạng...) không huỷ việc tạo đơn — đơn vẫn
 * tạo thật, chỉ là chưa gửi được tin nhắc, studio tự nhắc tay sau ở TaskBoard.
 */
async function handleCreateOrderFromChat(state: StateSnapshot, customer: CustomerShape, args: Record<string, unknown>) {
  const input: CreateOrderFromChatArgs = {
    customerName: String(args.customerName ?? ""),
    customerPhone: String(args.customerPhone ?? ""),
    date: String(args.date ?? ""),
    time: String(args.time ?? ""),
    conceptName: typeof args.conceptName === "string" ? args.conceptName : undefined,
    peopleCount: typeof args.peopleCount === "number" ? args.peopleCount : undefined,
  };
  const result = createOrderFromChat(state, customer, input);
  if (!result.ok || result.alreadyExisted) return result;

  if (customer.facebookId && FB_PAGE_ACCESS_TOKEN) {
    try {
      const orders = ordersOf(state);
      const order = orders.find((o) => o.code === result.code);
      if (order) {
        const { text, qrUrl } = buildDepositReminderText(state, order, customer.name ?? "khách");
        const sent = await sendFacebookMessage(customer.facebookId, text, FB_PAGE_ACCESS_TOKEN);
        if (sent.ok) {
          appendMessage(state, { customerId: customer.id ?? "", channel: "facebook", fromCustomer: false, text, aiGenerated: true });
          if (qrUrl) await sendFacebookImage(customer.facebookId, qrUrl, FB_PAGE_ACCESS_TOKEN);
        }
      }
    } catch (err) {
      console.error("[ai] Tạo đơn thành công nhưng gửi tin nhắc cọc thất bại:", err);
    }
  }
  return result;
}

/**
 * Tìm concept theo tên (khớp gần đúng, không phân biệt hoa thường) trong số
 * concept đang mở bán, gửi tối đa 4 ảnh mẫu đầu (`sampleImageUrls`) cho khách
 * qua Facebook Send API — cùng cách gửi ảnh QR đã có (`sendFacebookImage`).
 * Giới hạn 4 ảnh để không spam khách lúc đang chat.
 */
async function handleSendConceptPhotos(state: StateSnapshot, customer: CustomerShape, args: Record<string, unknown>): Promise<Record<string, unknown>> {
  const wantedName = typeof args.conceptName === "string" ? args.conceptName.trim() : "";
  if (!wantedName) return { ok: false, error: "missing_concept_name" };

  const concepts = conceptsOf(state).filter((c) => c.status === "active");
  const needle = wantedName.toLowerCase();
  const concept: ConceptShape | undefined =
    concepts.find((c) => (c.name ?? "").toLowerCase() === needle) ??
    concepts.find((c) => (c.name ?? "").toLowerCase().includes(needle) || needle.includes((c.name ?? "").toLowerCase()));
  if (!concept) return { ok: false, error: "concept_not_found" };

  const urls = Array.isArray(concept.sampleImageUrls) ? concept.sampleImageUrls.filter((u) => typeof u === "string" && u.trim()).slice(0, 4) : [];
  if (urls.length === 0) return { ok: false, error: "no_sample_images", conceptName: concept.name };
  if (!customer.facebookId || !FB_PAGE_ACCESS_TOKEN) return { ok: false, error: "missing_facebook_channel", conceptName: concept.name };

  let sentCount = 0;
  for (const url of urls) {
    const sent = await sendFacebookImage(customer.facebookId, url, FB_PAGE_ACCESS_TOKEN);
    if (sent.ok) sentCount++;
  }
  return { ok: sentCount > 0, sentCount, conceptName: concept.name };
}

async function handleUpsellOrder(state: StateSnapshot, customer: CustomerShape, args: Record<string, unknown>): Promise<Record<string, unknown>> {
  const upsellArgs: UpsellOrderArgs = {
    addonServiceName: typeof args.addonServiceName === "string" ? args.addonServiceName : undefined,
    addonQuantity: typeof args.addonQuantity === "number" ? args.addonQuantity : undefined,
    extraAdults: typeof args.extraAdults === "number" ? args.extraAdults : undefined,
    extraChildren: typeof args.extraChildren === "number" ? args.extraChildren : undefined,
  };
  return upsellOrder(state, customer, upsellArgs);
}

async function handleRescheduleOrder(state: StateSnapshot, customer: CustomerShape, args: Record<string, unknown>): Promise<Record<string, unknown>> {
  const rescheduleArgs: RescheduleOrderArgs = {
    newDate: typeof args.newDate === "string" ? args.newDate : "",
    newTime: typeof args.newTime === "string" ? args.newTime : "",
  };
  return rescheduleOrder(state, customer, rescheduleArgs);
}

async function handleCancelOrder(state: StateSnapshot, customer: CustomerShape): Promise<Record<string, unknown>> {
  return cancelOrderFromChat(state, customer);
}

async function executeFunction(
  key: string,
  args: Record<string, unknown>,
  state: StateSnapshot,
  customer: CustomerShape,
): Promise<Record<string, unknown>> {
  switch (key) {
    case "lookup_order":
      return handleLookupOrder(state, customer, args);
    case "tag_customer":
      return handleTagCustomer(customer, args);
    case "escalate_to_staff":
      return await handleEscalateToStaff(customer, args);
    case "check_available_slots":
      return handleCheckAvailableSlots(state, args);
    case "create_order_from_chat":
      return await handleCreateOrderFromChat(state, customer, args);
    case "send_concept_photos":
      return await handleSendConceptPhotos(state, customer, args);
    case "upsell_order":
      return await handleUpsellOrder(state, customer, args);
    case "reschedule_order":
      return await handleRescheduleOrder(state, customer, args);
    case "cancel_order":
      return await handleCancelOrder(state, customer);
    default:
      return { ok: false, error: "unknown_function" };
  }
}

// --- Phase 9: lỗi có phân loại "tạm thời hay không" + bộ điều phối retry/
// fallback đa nhà cung cấp -----------------------------------------------

/**
 * Lỗi khi gọi 1 nhà cung cấp AI — `transient` quyết định có nên thử lại CÙNG
 * nhà này không (vd lỗi quá tải/giới hạn tốc độ thì thử lại có ích, lỗi key
 * sai/model không tồn tại thì thử lại vô ích, nên sang nhà khác ngay).
 */
class AiProviderError extends Error {
  transient: boolean;
  constructor(message: string, transient: boolean) {
    super(message);
    this.transient = transient;
  }
}

const RETRY_ATTEMPTS_PER_PROVIDER = 2; // 1 lần gọi + 1 lần thử lại khi lỗi tạm thời, trước khi sang nhà kế tiếp

/**
 * Thử lần lượt các nhà cung cấp AI đang bật + có key (đúng thứ tự ưu tiên
 * studio đã cấu hình ở Cài đặt > AI), mỗi nhà retry ngắn khi gặp lỗi tạm thời
 * (vd "Gemini quá tải" — đúng điều anh hay gặp), hết retry thì sang nhà kế
 * tiếp. `capability: "vision"` lọc sẵn chỉ còn nhà đọc được ảnh (Gemini/OpenAI
 * — DeepSeek API hiện chưa hỗ trợ ảnh, xem aiProviders.ts).
 */
async function withProviderFallback<T>(
  capability: "text" | "vision",
  attempt: (cfg: AiProviderConfig) => Promise<T | null>,
): Promise<T | null> {
  const providers = await getOrderedAvailableProviders(capability === "vision" ? "vision" : undefined);
  if (providers.length === 0) {
    console.error(`[ai] Không có nhà cung cấp AI nào khả dụng cho "${capability}" (chưa cấu hình key hoặc đều tắt ở Cài đặt > AI).`);
    return null;
  }
  for (const cfg of providers) {
    for (let attemptIdx = 0; attemptIdx < RETRY_ATTEMPTS_PER_PROVIDER; attemptIdx++) {
      try {
        const result = await attempt(cfg);
        if (result != null) return result;
        break; // null hợp lệ (model không có gì để trả lời) — không phải lỗi, sang nhà kế tiếp luôn, không retry
      } catch (err) {
        const transient = err instanceof AiProviderError ? err.transient : true;
        console.error(
          `[ai] Nhà "${cfg.provider}" (model ${cfg.model}) lỗi ở lượt ${attemptIdx + 1}/${RETRY_ATTEMPTS_PER_PROVIDER}:`,
          err instanceof Error ? err.message : err,
        );
        if (!transient || attemptIdx === RETRY_ATTEMPTS_PER_PROVIDER - 1) break; // lỗi vĩnh viễn hoặc hết lượt thử -> sang nhà kế tiếp
        await new Promise((r) => setTimeout(r, 400 * (attemptIdx + 1))); // backoff ngắn trước khi thử lại CÙNG nhà này
      }
    }
  }
  console.error(`[ai] Đã thử hết các nhà cung cấp AI khả dụng cho "${capability}", không ai trả lời được.`);
  return null;
}

// --- Gọi Gemini, có hỗ trợ function-calling nhiều lượt -----------------

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

const MAX_FUNCTION_CALL_ROUNDS = 4; // chặn vòng lặp vô hạn nếu AI cứ gọi hàm liên tục

async function callGemini(cfg: AiProviderConfig, body: Record<string, unknown>): Promise<GeminiResponse> {
  let res: Response;
  try {
    res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${cfg.model}:generateContent?key=${encodeURIComponent(cfg.apiKey)}`,
      { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) },
    );
  } catch (err) {
    throw new AiProviderError(`Lỗi mạng khi gọi Gemini: ${err}`, true);
  }
  if (!res.ok) {
    const bodyText = await res.text().catch(() => "");
    // 429 (RESOURCE_EXHAUSTED) và 503 (UNAVAILABLE — đúng "quá tải tạm thời"
    // anh hay gặp) cùng các lỗi 5xx khác đều coi là tạm thời, nên thử lại.
    const transient = res.status === 429 || res.status === 503 || res.status >= 500;
    throw new AiProviderError(`Gemini trả lỗi ${res.status}: ${bodyText.slice(0, 300)}`, transient);
  }
  return (await res.json()) as GeminiResponse;
}

async function runGeminiTextLoop(cfg: AiProviderConfig, ctx: AiReplyContext, systemPrompt: string): Promise<string | null> {
  const enabledFunctions = (ctx.functions ?? []).filter((f) => f.enabled && FUNCTION_SCHEMAS[f.key]);
  const tools = enabledFunctions.length ? [{ functionDeclarations: enabledFunctions.map(buildToolDeclaration) }] : undefined;

  // Gemini yêu cầu role đầu tiên trong `contents` là "user" — cắt từ tin khách
  // gần nhất, bỏ các tin phía trước cùng-role-liên-tiếp ở đầu nếu lịch sử bắt
  // đầu bằng tin studio (hiếm, nhưng tránh lỗi 400 từ API).
  const recent = ctx.history.slice(-12);
  const firstCustomerIdx = recent.findIndex((t) => t.fromCustomer);
  const turns = firstCustomerIdx > 0 ? recent.slice(firstCustomerIdx) : recent;
  if (turns.length === 0) return null;
  const contents: GeminiContent[] = turns.map((t) => ({
    role: t.fromCustomer ? "user" : "model",
    parts: [{ text: t.text }],
  }));

  for (let round = 0; round < MAX_FUNCTION_CALL_ROUNDS; round++) {
    const data = await callGemini(cfg, {
      systemInstruction: { parts: [{ text: systemPrompt }] },
      contents,
      ...(tools ? { tools } : {}),
      generationConfig: { temperature: 0.4, maxOutputTokens: 300 },
    });

    const parts = data.candidates?.[0]?.content?.parts ?? [];
    const functionCallParts = parts.filter((p) => p.functionCall);

    if (functionCallParts.length === 0) {
      const text = parts.map((p) => p.text ?? "").join("").trim();
      return text || null;
    }

    // Ghi lại đúng lượt "model" (có functionCall) rồi nối tiếp lượt
    // "function" (kết quả thực thi) — đúng giao thức multi-turn của Gemini.
    contents.push({ role: "model", parts });
    const responseParts: GeminiPart[] = [];
    for (const part of functionCallParts) {
      const name = part.functionCall!.name;
      const args = part.functionCall!.args ?? {};
      const result = await executeFunction(name, args, ctx.state, ctx.customer);
      responseParts.push({ functionResponse: { name, response: result } });
    }
    contents.push({ role: "function", parts: responseParts });
  }

  console.error("[ai] (gemini) Vượt quá số lượt gọi hàm cho phép, dừng lại không trả lời.");
  return null;
}

// --- Gọi OpenAI/DeepSeek — cùng format API (DeepSeek tương thích OpenAI),
// chỉ khác baseUrl + model. Ảnh (vision) chỉ dùng cho OpenAI (xem VISION_CAPABLE
// ở aiProviders.ts) -------------------------------------------------------

interface OpenAiContentPart {
  type: "text" | "image_url";
  text?: string;
  image_url?: { url: string };
}
interface OpenAiCompatMessage {
  role: "system" | "user" | "assistant" | "tool";
  content?: string | OpenAiContentPart[];
  tool_calls?: { id: string; type: "function"; function: { name: string; arguments: string } }[];
  tool_call_id?: string;
}
interface OpenAiCompatResponse {
  choices?: { message?: OpenAiCompatMessage }[];
}

/** Chuyển schema kiểu Gemini OpenAPI-lite (type "OBJECT"/"STRING" viết hoa)
 * sang JSON Schema chuẩn (viết thường) mà OpenAI/DeepSeek đòi — cùng 1
 * FUNCTION_SCHEMAS định nghĩa 1 lần, dùng lại cho cả 3 nhà cung cấp. */
function toJsonSchemaTypes(schema: unknown): unknown {
  if (Array.isArray(schema)) return schema.map(toJsonSchemaTypes);
  if (schema && typeof schema === "object") {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(schema as Record<string, unknown>)) {
      out[k] = k === "type" && typeof v === "string" ? v.toLowerCase() : toJsonSchemaTypes(v);
    }
    return out;
  }
  return schema;
}

function buildOpenAiTools(enabledFunctions: AiFunctionConfig[]) {
  return enabledFunctions.map((fn) => ({
    type: "function" as const,
    function: {
      name: fn.key,
      description: fn.description?.trim() || FUNCTION_FALLBACK_DESCRIPTIONS[fn.key] || fn.key,
      parameters: toJsonSchemaTypes(FUNCTION_SCHEMAS[fn.key] ?? { type: "OBJECT", properties: {} }),
    },
  }));
}

async function callOpenAiCompatible(
  baseUrl: string,
  cfg: AiProviderConfig,
  messages: OpenAiCompatMessage[],
  tools: ReturnType<typeof buildOpenAiTools> | undefined,
  maxTokens: number,
): Promise<OpenAiCompatMessage> {
  let res: Response;
  try {
    res = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${cfg.apiKey}` },
      body: JSON.stringify({
        model: cfg.model,
        messages,
        ...(tools?.length ? { tools } : {}),
        temperature: 0.4,
        max_tokens: maxTokens,
      }),
    });
  } catch (err) {
    throw new AiProviderError(`Lỗi mạng khi gọi ${cfg.provider}: ${err}`, true);
  }
  if (!res.ok) {
    const bodyText = await res.text().catch(() => "");
    const transient = res.status === 429 || res.status >= 500;
    throw new AiProviderError(`${cfg.provider} trả lỗi ${res.status}: ${bodyText.slice(0, 300)}`, transient);
  }
  const data = (await res.json()) as OpenAiCompatResponse;
  const message = data.choices?.[0]?.message;
  if (!message) throw new AiProviderError(`${cfg.provider} trả về response không có message`, true);
  return message;
}

async function runOpenAiCompatibleTextLoop(baseUrl: string, cfg: AiProviderConfig, ctx: AiReplyContext, systemPrompt: string): Promise<string | null> {
  const enabledFunctions = (ctx.functions ?? []).filter((f) => f.enabled && FUNCTION_SCHEMAS[f.key]);
  const tools = enabledFunctions.length ? buildOpenAiTools(enabledFunctions) : undefined;

  const recent = ctx.history.slice(-12);
  const firstCustomerIdx = recent.findIndex((t) => t.fromCustomer);
  const turns = firstCustomerIdx > 0 ? recent.slice(firstCustomerIdx) : recent;
  if (turns.length === 0) return null;

  const messages: OpenAiCompatMessage[] = [
    { role: "system", content: systemPrompt },
    ...turns.map((t): OpenAiCompatMessage => ({ role: t.fromCustomer ? "user" : "assistant", content: t.text })),
  ];

  for (let round = 0; round < MAX_FUNCTION_CALL_ROUNDS; round++) {
    const message = await callOpenAiCompatible(baseUrl, cfg, messages, tools, 300);
    const toolCalls = message.tool_calls ?? [];
    if (toolCalls.length === 0) {
      const text = typeof message.content === "string" ? message.content.trim() : "";
      return text || null;
    }

    messages.push(message);
    for (const call of toolCalls) {
      let args: Record<string, unknown> = {};
      try {
        args = JSON.parse(call.function.arguments || "{}");
      } catch {
        // Bỏ qua — args rỗng, executeFunction tự xử lý thiếu tham số.
      }
      const result = await executeFunction(call.function.name, args, ctx.state, ctx.customer);
      messages.push({ role: "tool", tool_call_id: call.id, content: JSON.stringify(result) });
    }
  }

  console.error(`[ai] (${cfg.provider}) Vượt quá số lượt gọi hàm cho phép, dừng lại không trả lời.`);
  return null;
}

async function runOpenAiCompatibleVisionText(
  baseUrl: string,
  cfg: AiProviderConfig,
  systemPrompt: string | undefined,
  userText: string,
  base64: string,
  mimeType: string,
  maxTokens: number,
): Promise<string | null> {
  const messages: OpenAiCompatMessage[] = [
    ...(systemPrompt ? [{ role: "system" as const, content: systemPrompt }] : []),
    {
      role: "user",
      content: [
        { type: "text", text: userText },
        // Luôn gửi ảnh dạng base64 data URI, KHÔNG gửi thẳng link CDN Facebook
        // — đây chính là cách tránh lỗi "Error while downloading" OpenAI hay
        // gặp khi link hết hạn/bị chặn hotlink (xem comment đầu file).
        { type: "image_url", image_url: { url: `data:${mimeType};base64,${base64}` } },
      ],
    },
  ];
  const message = await callOpenAiCompatible(baseUrl, cfg, messages, undefined, maxTokens);
  const text = typeof message.content === "string" ? message.content.trim() : "";
  return text || null;
}

const OPENAI_BASE_URL = "https://api.openai.com/v1";
const DEEPSEEK_BASE_URL = "https://api.deepseek.com";

export interface AiReplyContext {
  state: StateSnapshot;
  customer: CustomerShape;
  history: ChatTurn[];
  studioContext: string;
  customPrompt?: string;
  functions: AiFunctionConfig[];
}

export async function generateAiReply(ctx: AiReplyContext): Promise<string | null> {
  const extra = ctx.customPrompt?.trim() ? `\n\nHướng dẫn thêm từ studio:\n${ctx.customPrompt.trim()}` : "";
  const systemPrompt = `${SYSTEM_PROMPT_HEADER}${extra}\n\nThông tin studio:\n${ctx.studioContext}`;

  return withProviderFallback("text", (cfg) => {
    if (cfg.provider === "gemini") return runGeminiTextLoop(cfg, ctx, systemPrompt);
    if (cfg.provider === "openai") return runOpenAiCompatibleTextLoop(OPENAI_BASE_URL, cfg, ctx, systemPrompt);
    return runOpenAiCompatibleTextLoop(DEEPSEEK_BASE_URL, cfg, ctx, systemPrompt);
  });
}

// --- Giai đoạn 6: AI nhìn ảnh khách gửi (xem [[fkm-studio-ai-chatbot-roadmap]]) ---
// 2 việc tách riêng, KHÔNG dùng chung 1 lượt gọi Gemini:
//  1) classifyPaymentImage — chỉ hỏi "có phải ảnh chuyển khoản không + số tiền
//     bao nhiêu", ép trả JSON, dùng cho luồng tiền (match_and_confirm_deposit,
//     xử lý ở index.ts/chatOrders.ts) — KHÔNG để mô hình tự soạn câu trả lời ở
//     bước này, giữ đúng quyết định kiến trúc: tiền phải tiền định, không để
//     model tự do.
//  2) generateImageReply — khi ảnh KHÔNG phải ảnh chuyển khoản, theo quyết
//     định "Tự nhìn ảnh + trả lời tự nhiên" đã chốt với anh, để model tự nhìn
//     + trả lời tự nhiên như 1 tin nhắn thường (cùng SYSTEM_PROMPT_HEADER).

export interface ImageClassifyResult {
  isPayment: boolean;
  amount?: number;
}

function extractJsonBlock(text: string): string | null {
  const match = text.match(/\{[\s\S]*\}/);
  return match ? match[0] : null;
}

export async function classifyPaymentImage(base64: string, mimeType: string): Promise<ImageClassifyResult | null> {
  const prompt =
    `Đây là 1 ảnh khách gửi cho studio chụp ảnh qua Facebook Messenger. Xác định ảnh này CÓ PHẢI là ảnh chụp màn hình ` +
    `chuyển khoản/biên lai/sao kê ngân hàng (chứng minh đã chuyển tiền) hay không. Nếu có, đọc số tiền đã chuyển (chỉ số, ` +
    `đơn vị VNĐ, không gồm chữ "đ"/"VND"). Trả lời DUY NHẤT 1 JSON object, không thêm chữ nào khác, đúng dạng: ` +
    `{"isPayment": true hoặc false, "amount": số hoặc null}`;

  // DeepSeek bị loại tự động ở getOrderedAvailableProviders("vision") — không
  // tới nhánh provider === "deepseek" bao giờ, nhưng vẫn return null cho chắc
  // nếu sau này danh sách capability đổi.
  return withProviderFallback("vision", async (cfg) => {
    let text: string;
    if (cfg.provider === "gemini") {
      const data = await callGemini(cfg, {
        contents: [{ role: "user", parts: [{ inlineData: { mimeType, data: base64 } }, { text: prompt }] }],
        generationConfig: { temperature: 0, maxOutputTokens: 100 },
      });
      text = (data.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? "").join("");
    } else if (cfg.provider === "openai") {
      text = (await runOpenAiCompatibleVisionText(OPENAI_BASE_URL, cfg, undefined, prompt, base64, mimeType, 100)) ?? "";
    } else {
      return null;
    }
    const jsonText = extractJsonBlock(text);
    if (!jsonText) return null;
    const parsed = JSON.parse(jsonText) as { isPayment?: boolean; amount?: number | null };
    return { isPayment: !!parsed.isPayment, amount: typeof parsed.amount === "number" ? parsed.amount : undefined };
  });
}

export interface ImageReplyContext {
  base64: string;
  mimeType: string;
  studioContext: string;
  customPrompt?: string;
}

export async function generateImageReply(ctx: ImageReplyContext): Promise<string | null> {
  const extra = ctx.customPrompt?.trim() ? `\n\nHướng dẫn thêm từ studio:\n${ctx.customPrompt.trim()}` : "";
  const systemPrompt =
    `${SYSTEM_PROMPT_HEADER}${extra}\n\nThông tin studio:\n${ctx.studioContext}\n\n` +
    `Khách vừa gửi 1 ảnh (không phải ảnh chuyển khoản). Hãy nhìn ảnh, hiểu nội dung, và trả lời tự nhiên, phù hợp ngữ cảnh studio chụp ảnh.`;

  return withProviderFallback("vision", async (cfg) => {
    if (cfg.provider === "gemini") {
      const data = await callGemini(cfg, {
        systemInstruction: { parts: [{ text: systemPrompt }] },
        contents: [{ role: "user", parts: [{ inlineData: { mimeType: ctx.mimeType, data: ctx.base64 } }] }],
        generationConfig: { temperature: 0.4, maxOutputTokens: 200 },
      });
      const text = (data.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? "").join("").trim();
      return text || null;
    }
    if (cfg.provider === "openai") {
      return runOpenAiCompatibleVisionText(
        OPENAI_BASE_URL,
        cfg,
        systemPrompt,
        "Hãy nhìn ảnh này và trả lời khách phù hợp ngữ cảnh studio chụp ảnh.",
        ctx.base64,
        ctx.mimeType,
        200,
      );
    }
    return null;
  });
}
