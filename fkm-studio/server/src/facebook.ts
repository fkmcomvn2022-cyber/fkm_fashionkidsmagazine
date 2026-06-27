/**
 * Phase 2 (xem [[fkm-studio-ai-chatbot-roadmap]]) — nhận tin nhắn Facebook
 * Messenger qua webhook + gửi trả lời qua Facebook Send API. Cần 3 biến môi
 * trường (đặt trong file `.env` ở `server/` khi chạy local, hoặc trong
 * dashboard Render/Railway khi deploy — xem README.md):
 *
 *   FB_VERIFY_TOKEN      - chuỗi TỰ ĐẶT (bất kỳ, vd "fkm_xac_minh_2026"),
 *                          dùng khi khai báo webhook trên Meta for Developers.
 *   FB_APP_SECRET        - lấy ở Meta for Developers > App > Cài đặt > Cơ bản.
 *   FB_PAGE_ACCESS_TOKEN - lấy ở Meta for Developers > App > Messenger > Cài
 *                          đặt Messenger > Page Access Token (theo từng Trang).
 *
 * Cùng pattern với orders.ts: type lỏng (interface + index signature) trên
 * state mirror chung (StateSnapshot), KHÔNG import type thật từ frontend (2
 * runtime khác nhau, tránh ràng buộc type giữa 2 project).
 */
import crypto from "node:crypto";
import type { StateSnapshot } from "./store.js";

interface CustomerShape {
  id?: string;
  name?: string;
  phone?: string;
  facebookId?: string;
  tag?: string;
  totalOrders?: number;
  totalSpent?: number;
  [key: string]: unknown;
}

interface MessageShape {
  id: string;
  customerId: string;
  channel: string;
  fromCustomer: boolean;
  text: string;
  time: string;
  read: boolean;
  // Phase 3 — tin này do AI (Gemini) tự soạn + tự gửi, không phải studio gõ
  // tay. Mirror đúng field aiGenerated ở src/types/index.ts (frontend).
  aiGenerated?: boolean;
}

function customersOf(state: StateSnapshot): CustomerShape[] {
  if (!Array.isArray(state.customers)) state.customers = [];
  return state.customers as CustomerShape[];
}

function messagesOf(state: StateSnapshot): MessageShape[] {
  if (!Array.isArray(state.messages)) state.messages = [];
  return state.messages as MessageShape[];
}

function nextId(prefix: string, list: { id?: string }[]): string {
  let max = 0;
  for (const item of list) {
    if (!item.id?.startsWith(prefix)) continue;
    const n = parseInt(item.id.slice(prefix.length), 10);
    if (!Number.isNaN(n) && n > max) max = n;
  }
  return `${prefix}${max + 1}`;
}

/**
 * Tìm khách theo facebookId (PSID — Page-Scoped ID Facebook gửi kèm mỗi tin)
 * — chưa có thì tạo mới (tag "Mới"). Tương đương `findOrCreateCustomer` ở
 * frontend (src/data/customers.ts) nhưng chạy độc lập trên state mirror phía
 * server — 2 runtime khác nhau (Node vs trình duyệt), không gọi lẫn nhau
 * được nên phải viết lại logic tương tự ở đây.
 */
export function findOrCreateCustomerByFacebookId(state: StateSnapshot, psid: string): CustomerShape {
  const customers = customersOf(state);
  const existing = customers.find((c) => c.facebookId === psid);
  if (existing) return existing;
  const customer: CustomerShape = {
    // Tiền tố "fbu" (không phải "u") CỐ Ý — khách mẫu có sẵn trong app dùng id
    // "u1".."u7". Nếu dùng chung tiền tố "u", lần đầu server tạo khách Facebook
    // mới (đặc biệt sau khi Render xóa sạch state.json lúc redeploy) sẽ ra đúng
    // "u1" — trùng thẳng với khách mẫu "Nguyễn Thị Mai", khiến app tưởng đây là
    // 1 bản cập nhật khách cũ chứ không phải khách mới (xem mergeRemoteCustomers
    // ở src/data/customers.ts) — đây là lý do khách Facebook test "biến mất".
    id: nextId("fbu", customers),
    name: "Khách Facebook",
    phone: "",
    facebookId: psid,
    tag: "Mới",
    totalOrders: 0,
    totalSpent: 0,
  };
  customers.push(customer);
  return customer;
}

export function appendMessage(
  state: StateSnapshot,
  input: { customerId: string; channel: string; fromCustomer: boolean; text: string; aiGenerated?: boolean },
): MessageShape {
  const messages = messagesOf(state);
  const message: MessageShape = {
    // Tiền tố "fbm" (không phải "m") — cùng lý do với "fbu" ở
    // findOrCreateCustomerByFacebookId phía trên: tin mẫu có sẵn trong app
    // dùng id "m1".."m5", dùng chung tiền tố "m" sẽ trùng ID, app dedupe theo
    // id sẽ âm thầm bỏ qua tin nhắn thật từ khách (xem mergeRemoteMessages ở
    // src/data/messages.ts).
    id: nextId("fbm", messages),
    customerId: input.customerId,
    channel: input.channel,
    fromCustomer: input.fromCustomer,
    text: input.text,
    time: new Date().toISOString(),
    read: !input.fromCustomer, // tin studio/AI tự gửi coi như "đã đọc" ngay, tin khách gửi vào thì chưa
    ...(input.aiGenerated ? { aiGenerated: true } : {}),
  };
  messages.push(message);
  return message;
}

/**
 * Xác minh request webhook thật từ Facebook — Facebook ký mỗi request bằng
 * HMAC-SHA256 (App Secret) trong header `X-Hub-Signature-256`. Không xác
 * minh được thì PHẢI từ chối — nếu không, ai biết URL webhook cũng có thể
 * giả tin nhắn khách, tạo khách giả, hoặc gây spam push notification.
 */
export function verifyFacebookSignature(rawBody: Buffer, signatureHeader: string | undefined, appSecret: string): boolean {
  if (!signatureHeader || !appSecret) return false;
  const expected = "sha256=" + crypto.createHmac("sha256", appSecret).update(rawBody).digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signatureHeader);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b); // so sánh timing-safe, tránh side-channel timing attack
}

export interface IncomingFacebookMessage {
  psid: string;
  text?: string;
  attachmentUrls: string[];
}

/**
 * Parse payload webhook Messenger thành danh sách tin nhắn khách gửi vào —
 * Facebook gửi cùng 1 webhook cho nhiều loại event (tin nhắn, đã giao, đã
 * đọc, postback nút...), nên phải lọc đúng `entry[].messaging[].message`,
 * bỏ qua các event khác (delivery/read receipt không có nội dung tin nhắn).
 */
export function parseFacebookWebhookPayload(body: unknown): IncomingFacebookMessage[] {
  const result: IncomingFacebookMessage[] = [];
  const entries = (body as { entry?: unknown[] })?.entry ?? [];
  for (const entry of entries) {
    const messaging = (entry as { messaging?: unknown[] })?.messaging ?? [];
    for (const event of messaging) {
      const e = event as {
        sender?: { id?: string };
        message?: { text?: string; attachments?: { type?: string; payload?: { url?: string } }[] };
      };
      const psid = e.sender?.id;
      if (!psid || !e.message) continue;
      const attachmentUrls = (e.message.attachments ?? [])
        .map((a) => a.payload?.url)
        .filter((u): u is string => !!u);
      result.push({ psid, text: e.message.text, attachmentUrls });
    }
  }
  return result;
}

/**
 * Giai đoạn 6 — tải 1 ảnh khách gửi (URL CDN của Facebook, payload.url ở
 * webhook) về server, mã hoá base64 để gửi cho Gemini Vision (REST API của
 * Gemini chỉ nhận ảnh qua `inlineData` base64 hoặc `fileData` URI riêng của
 * Gemini File API — không tự fetch được URL bên ngoài), xem server/src/ai.ts.
 * URL đính kèm Facebook không cần token để GET (đã là URL CDN ký sẵn).
 */
export async function fetchImageAsBase64(url: string): Promise<{ base64: string; mimeType: string } | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const mimeType = res.headers.get("content-type")?.split(";")[0]?.trim() || "image/jpeg";
    const buf = Buffer.from(await res.arrayBuffer());
    if (buf.length === 0) return null;
    return { base64: buf.toString("base64"), mimeType };
  } catch (err) {
    console.error("[facebook] Không tải được ảnh khách gửi:", err);
    return null;
  }
}

/** Gửi trả lời tới 1 khách qua Facebook Send API (Graph API). */
export async function sendFacebookMessage(
  psid: string,
  text: string,
  pageAccessToken: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`https://graph.facebook.com/v19.0/me/messages?access_token=${encodeURIComponent(pageAccessToken)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ recipient: { id: psid }, message: { text } }),
    });
    if (!res.ok) {
      const errText = await res.text();
      return { ok: false, error: errText };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}

/**
 * Gửi 1 ảnh (theo URL công khai, không cần upload) tới khách qua Facebook
 * Send API — dùng để gửi mã QR chuyển khoản (img.vietqr.io trả thẳng URL
 * ảnh, xem [[fkm-studio-data-write-path]] phần VietQR) kèm tin nhắc cọc.
 */
export async function sendFacebookImage(
  psid: string,
  imageUrl: string,
  pageAccessToken: string,
): Promise<{ ok: boolean; error?: string }> {
  try {
    const res = await fetch(`https://graph.facebook.com/v19.0/me/messages?access_token=${encodeURIComponent(pageAccessToken)}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        recipient: { id: psid },
        message: { attachment: { type: "image", payload: { url: imageUrl, is_reusable: true } } },
      }),
    });
    if (!res.ok) {
      const errText = await res.text();
      return { ok: false, error: errText };
    }
    return { ok: true };
  } catch (err) {
    return { ok: false, error: String(err) };
  }
}
