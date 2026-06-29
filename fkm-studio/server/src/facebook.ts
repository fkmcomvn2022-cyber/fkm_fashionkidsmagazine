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
  avatar?: string;
  facebookId?: string;
  tag?: string;
  totalOrders?: number;
  totalSpent?: number;
  // Giai đoạn 7.2 — tạm dừng AI tự trả lời cho riêng khách này (epoch ms),
  // xem comment đầy đủ ở Customer.aiPausedUntil (src/types/index.ts) +
  // AiAutoReplySettings.pauseMinutesAfterStaffReply (src/lib/aiReply.ts).
  aiPausedUntil?: number;
  // ID folder con trong Google Drive đã tự tạo riêng cho khách này (nằm
  // trong folder gốc đã cấu hình ở driveConfig.ts) — set 1 lần ở lần upload
  // ảnh đầu tiên cho khách này (xem googleDrive.ts uploadImageToDrive +
  // POST /api/upload-image ở index.ts), các lần sau tái dùng luôn, KHÔNG tạo
  // folder mới mỗi lần gửi ảnh.
  driveFolderId?: string;
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
  // Tin kèm ảnh (nút "Gửi ảnh" ở ChatPage) — mirror imageUrl ở frontend.
  imageUrl?: string;
}

function customersOf(state: StateSnapshot): CustomerShape[] {
  if (!Array.isArray(state.customers)) state.customers = [];
  return state.customers as CustomerShape[];
}

function messagesOf(state: StateSnapshot): MessageShape[] {
  if (!Array.isArray(state.messages)) state.messages = [];
  return state.messages as MessageShape[];
}

/**
 * Lấy tên + ảnh đại diện thật của khách qua Graph API (Messenger Platform
 * User Profile API) — cần PSID + Page Access Token. Chỉ gọi được trong vòng
 * Facebook cho phép (khách đã từng nhắn cho Trang); nếu Facebook từ chối
 * (hết quyền app review, token sai...) thì trả về null và phía gọi tự fallback
 * về tên mặc định "Khách Facebook" — không để lỗi này làm rớt cả webhook.
 */
async function fetchFacebookProfile(
  psid: string,
  pageAccessToken: string,
): Promise<{ name?: string; avatar?: string } | null> {
  if (!pageAccessToken) return null;
  try {
    const url = `https://graph.facebook.com/v19.0/${psid}?fields=first_name,last_name,profile_pic&access_token=${encodeURIComponent(pageAccessToken)}`;
    const res = await fetch(url);
    if (!res.ok) {
      console.warn("[facebook] Không lấy được thông tin khách (PSID", psid, "):", await res.text());
      return null;
    }
    const data = (await res.json()) as { first_name?: string; last_name?: string; profile_pic?: string };
    const name = [data.first_name, data.last_name].filter(Boolean).join(" ").trim();
    if (!data.profile_pic) {
      // Theo doc Meta (User Profile API, cập nhật 18/03/2026): field
      // `profile_pic` cần Advanced Access riêng cho feature "Business Asset
      // User Profile Access" — tách biệt với quyền đọc tên (first_name/
      // last_name). Vì vậy có thể trả về tên thành công nhưng vẫn thiếu
      // avatar dù request không lỗi (không phải bug code) — log nguyên data
      // trả về để biết Facebook có gửi field này không, hay chỉ rỗng tạm
      // thời ở lần gọi đó (lazy-backfill ở findOrCreateCustomerByFacebookId
      // sẽ tự thử lại ở tin nhắn kế tiếp của khách này).
      console.warn("[facebook] Lấy được tên nhưng thiếu profile_pic (PSID", psid, "):", JSON.stringify(data));
    }
    return { name: name || undefined, avatar: data.profile_pic || undefined };
  } catch (err) {
    console.warn("[facebook] Lỗi khi lấy thông tin khách:", err);
    return null;
  }
}

/**
 * Lấy TÊN khách qua Conversations API — cách lấy tên KHÔNG cần Advanced Access
 * cho app cá nhân (không qua App Review). KHÔNG gọi /{PSID} (Meta chặn nếu
 * chưa duyệt), mà hỏi danh sách hội thoại của CHÍNH Trang mình (`me`) lọc theo
 * `user_id={PSID}`, rồi đọc tên participant trùng PSID. Chạy được với Page
 * Access Token của Trang mình quản lý + quyền pages_messaging (đã có sẵn cho
 * webhook). LƯU Ý: API này trả về TÊN, KHÔNG trả avatar — profile_pic vẫn cần
 * Advanced Access riêng nên app cá nhân gần như không lấy được avatar; ưu tiên
 * "ít nhất có tên khách" theo yêu cầu. Trả null nếu Facebook từ chối/không có.
 */
async function fetchNameFromConversations(psid: string, pageAccessToken: string): Promise<string | null> {
  if (!pageAccessToken) return null;
  try {
    const url = `https://graph.facebook.com/v19.0/me/conversations?platform=messenger&user_id=${encodeURIComponent(psid)}&fields=participants&access_token=${encodeURIComponent(pageAccessToken)}`;
    const res = await fetch(url);
    if (!res.ok) {
      console.warn("[facebook] Conversations API từ chối lấy tên (PSID", psid, "):", await res.text());
      return null;
    }
    const data = (await res.json()) as {
      data?: { participants?: { data?: { id?: string; name?: string }[] } }[];
    };
    for (const convo of data.data ?? []) {
      // participant.id của khách CHÍNH LÀ PSID -> khớp đúng để lấy tên khách,
      // không nhầm sang tên Trang (participant còn lại là id của Trang).
      const me = (convo.participants?.data ?? []).find((p) => p.id === psid);
      const name = (me?.name ?? "").trim();
      if (name) return name;
    }
    return null;
  } catch (err) {
    console.warn("[facebook] Lỗi khi lấy tên qua Conversations API:", err);
    return null;
  }
}

/**
 * Gom các nguồn lấy tên/avatar khách theo thứ tự ƯU TIÊN từ rẻ/dễ tới khó:
 *  1) payloadHint — Facebook thi thoảng kèm sẵn sender.name/profile_pic trong
 *     webhook (đặc biệt kênh standby): dùng luôn, không tốn lượt gọi API.
 *  2) Conversations API — lấy TÊN không cần Advanced Access (xem
 *     fetchNameFromConversations).
 *  3) /{PSID} User Profile API — chỉ thử khi vẫn thiếu; thường bị chặn nếu
 *     chưa App Review, nhưng đôi khi vẫn ra tên/avatar nên vẫn thử cuối cùng.
 * Chỉ gọi tới các bước sau khi bước trước chưa đủ (tiết kiệm lượt gọi API).
 */
async function resolveCustomerProfile(
  psid: string,
  pageAccessToken: string,
  payloadHint?: { name?: string; avatar?: string },
): Promise<{ name?: string; avatar?: string }> {
  let name = payloadHint?.name?.trim() || undefined;
  let avatar = payloadHint?.avatar || undefined;
  if (!name) {
    name = (await fetchNameFromConversations(psid, pageAccessToken)) || undefined;
  }
  if (!name || !avatar) {
    const profile = await fetchFacebookProfile(psid, pageAccessToken);
    if (!name && profile?.name) name = profile.name;
    if (!avatar && profile?.avatar) avatar = profile.avatar;
  }
  return { name, avatar };
}

/**
 * Tìm khách theo facebookId (PSID — Page-Scoped ID Facebook gửi kèm mỗi tin)
 * — chưa có thì tạo mới (tag "Mới"), kèm gọi Graph API lấy tên + avatar thật
 * của khách (xem fetchFacebookProfile). Tương đương `findOrCreateCustomer` ở
 * frontend (src/data/customers.ts) nhưng chạy độc lập trên state mirror phía
 * server — 2 runtime khác nhau (Node vs trình duyệt), không gọi lẫn nhau
 * được nên phải viết lại logic tương tự ở đây.
 */
export async function findOrCreateCustomerByFacebookId(
  state: StateSnapshot,
  psid: string,
  pageAccessToken: string,
  // Tên/avatar lấy TRỰC TIẾP từ payload webhook (entry[].standby hoặc
  // entry[].messaging — xem parseFacebookWebhookPayload) — App cá nhân
  // không qua App Review nên field `profile_pic` của Graph API
  // /{PSID}?fields=... gần như luôn bị Meta chặn (cần Advanced Access riêng,
  // xem comment ở fetchFacebookProfile). Một số payload webhook (đặc biệt
  // kênh standby) Facebook tự gửi kèm sender.name/sender.profile_pic — nếu
  // có thì DÙNG LUÔN, khỏi cần gọi Graph API, né được rào Advanced Access.
  payloadHint?: { name?: string; avatar?: string },
): Promise<CustomerShape> {
  const customers = customersOf(state);
  const existing = customers.find((c) => c.facebookId === psid);
  if (existing) {
    // Khách đã tồn tại nhưng vẫn còn tên/avatar mặc định (vd. được tạo TRƯỚC
    // khi có đoạn gọi Graph API lấy hồ sơ thật, hoặc lần tạo đầu Facebook từ
    // chối lấy hồ sơ) — thử lấy lại mỗi khi khách nhắn tin tiếp, để tự "vá"
    // dần, không bị kẹt vĩnh viễn với "Khách Facebook" như khách tạo trước
    // bản fix này. Ưu tiên payloadHint (free, không qua Graph) trước.
    if (!existing.avatar || existing.name === "Khách Facebook") {
      const profile = await resolveCustomerProfile(psid, pageAccessToken, payloadHint);
      if (profile.name) existing.name = profile.name;
      if (profile.avatar) existing.avatar = profile.avatar;
    }
    return existing;
  }
  const profile = await resolveCustomerProfile(psid, pageAccessToken, payloadHint);
  const customer: CustomerShape = {
    // BUG (2026-06-28, vòng 2): trước đây dùng nextId("fbu", customers) — đếm
    // tăng dần dựa trên DANH SÁCH KHÁCH HIỆN CÓ TRÊN SERVER. Nhưng Render free
    // tier xóa sạch ổ đĩa mỗi lần redeploy -> customers rỗng -> bộ đếm RESET
    // VỀ 1 -> khách Facebook mới đầu tiên sau redeploy lại ra đúng "fbu1" —
    // trùng ID với 1 khách Facebook KHÁC mà app đã lưu trong localStorage từ
    // TRƯỚC lúc redeploy (vì localStorage không bị xóa, chỉ ổ đĩa server bị
    // xóa). App thấy ID trùng -> tưởng là khách cũ -> bỏ qua tin/khách mới,
    // dù /api/chat-sync vẫn trả đúng dữ liệu (đây là lý do "log đúng, app vẫn
    // không nhận tin", lặp lại nhiều lần dù đã đổi tiền tố "fbu"/"fbm" — đổi
    // tiền tố chỉ tránh trùng với SEED tĩnh, không tránh được trùng với ID
    // server tự sinh ở LẦN TRƯỚC).
    //
    // Fix triệt để: bỏ hẳn bộ đếm tăng dần, suy ID trực tiếp từ facebookId
    // (PSID) — PSID không đổi vĩnh viễn cho 1 khách + 1 Trang, nên ID khách
    // luôn giống nhau mỗi lần, không phụ thuộc server còn nhớ được bao nhiêu
    // khách. Tác dụng phụ TỐT: nếu khách này nhắn lại sau khi server bị xóa
    // ổ đĩa, vẫn nhận đúng là "khách cũ" (đúng bản chất), không tạo bản trùng.
    id: `fbu_${psid}`,
    name: profile?.name || "Khách Facebook",
    phone: "",
    avatar: profile?.avatar,
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
  input: { customerId: string; channel: string; fromCustomer: boolean; text: string; aiGenerated?: boolean; imageUrl?: string },
): MessageShape {
  const messages = messagesOf(state);
  const message: MessageShape = {
    // Tin nhắn thì không có gì ổn định để suy ID như facebookId của khách (1
    // khách có thể nhắn nhiều tin), nên dùng crypto.randomUUID() — không phụ
    // thuộc bộ đếm/độ dài danh sách hiện có trên server, do đó không bao giờ
    // trùng dù server bị Render xóa ổ đĩa bao nhiêu lần (xem comment dài ở
    // findOrCreateCustomerByFacebookId phía trên — cùng 1 lớp bug, ID sinh từ
    // bộ đếm tăng dần trên dữ liệu CÓ THỂ MẤT).
    id: `fbm_${crypto.randomUUID()}`,
    customerId: input.customerId,
    channel: input.channel,
    fromCustomer: input.fromCustomer,
    text: input.text,
    time: new Date().toISOString(),
    read: !input.fromCustomer, // tin studio/AI tự gửi coi như "đã đọc" ngay, tin khách gửi vào thì chưa
    ...(input.aiGenerated ? { aiGenerated: true } : {}),
    ...(input.imageUrl ? { imageUrl: input.imageUrl } : {}),
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
  // Tên/avatar Facebook gửi kèm NGAY trong payload webhook (nếu có) — xem
  // comment đầy đủ ở findOrCreateCustomerByFacebookId (payloadHint).
  senderNameHint?: string;
  senderAvatarHint?: string;
}

/**
 * Parse payload webhook Messenger thành danh sách tin nhắn khách gửi vào —
 * Facebook gửi cùng 1 webhook cho nhiều loại event (tin nhắn, đã giao, đã
 * đọc, postback nút...), nên phải lọc đúng `[].message`, bỏ qua các event
 * khác (delivery/read receipt không có nội dung tin nhắn).
 *
 * Đọc CẢ 2 cổng `entry[].messaging` (kênh chính — app đang giữ quyền trả
 * lời) VÀ `entry[].standby` (kênh chờ — Handover Protocol, khi app không
 * phải chủ luồng hội thoại tại thời điểm đó). App cá nhân không qua App
 * Review của anh đã tick quyền nhận cả 2 cổng này trên Facebook Developer —
 * trước đây code chỉ đọc `messaging`, bỏ sót hẳn `standby` nên tin/khách gửi
 * qua cổng đó coi như mất tích, không lỗi gì để thấy.
 */
export function parseFacebookWebhookPayload(body: unknown): IncomingFacebookMessage[] {
  type RawEvent = {
    sender?: { id?: string; name?: string; profile_pic?: string };
    message?: { text?: string; attachments?: { type?: string; payload?: { url?: string } }[] };
  };
  const result: IncomingFacebookMessage[] = [];
  const entries = (body as { entry?: unknown[] })?.entry ?? [];
  for (const entry of entries) {
    const e = entry as { messaging?: unknown[]; standby?: unknown[] };
    // Cùng logic xử lý cho cả 2 cổng — chỉ khác tên field trên payload gốc.
    const channels: RawEvent[] = [...((e.messaging ?? []) as RawEvent[]), ...((e.standby ?? []) as RawEvent[])];
    for (const ev of channels) {
      const psid = ev.sender?.id;
      if (!psid || !ev.message) continue;
      const attachmentUrls = (ev.message.attachments ?? [])
        .map((a) => a.payload?.url)
        .filter((u): u is string => !!u);
      // Facebook không LUÔN gửi sender.name/profile_pic — log nguyên `sender`
      // 1 lần mỗi tin để biết thực tế Tài khoản/App này có được Facebook gửi
      // kèm hay không (xem findOrCreateCustomerByFacebookId dùng làm hint).
      if (ev.sender?.name || ev.sender?.profile_pic) {
        console.log("[facebook webhook] Payload có kèm sender.name/profile_pic:", JSON.stringify(ev.sender));
      }
      result.push({
        psid,
        text: ev.message.text,
        attachmentUrls,
        senderNameHint: ev.sender?.name,
        senderAvatarHint: ev.sender?.profile_pic,
      });
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
